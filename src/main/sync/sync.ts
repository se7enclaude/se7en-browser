/* Synchronisation chiffrée de bout en bout entre les PC de l'utilisateur.
 * - la clé (32 octets) est créée sur ce PC, gardée chiffrée avec le compte Windows, et ne part jamais ;
 * - le serveur reçoit un paquet chiffré (AES-256-GCM) rangé sous un identifiant dérivé de la clé, et un jeton
 *   d'écriture lui aussi dérivé de la clé : il ne peut ni lire le paquet, ni le relier au profil social ;
 * - pour relier un autre PC, on y tape le code de liaison (la clé écrite en base 32).
 * Toutes les 3 minutes (et à chaque changement) : lire, déchiffrer, fusionner, appliquer, réécrire si besoin. */
import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { join } from 'node:path'
import { deflateRawSync, inflateRawSync } from 'node:zlib'
import { net, safeStorage } from 'electron'
import type { Skill } from '../../shared/chat'
import type { Reglages } from '../../shared/reglages'
import { SERVEUR_SOCIAL_OFFICIEL } from '../../shared/social'
import {
  cleDeCode,
  codeDeCle,
  fusionnerPaquets,
  lirePaquet,
  PAQUET_VIDE,
  REGLAGES_SYNCHRONISES,
  type CategorieSync,
  type EtatSync,
  type OngletDistant,
  type PaquetSync
} from '../../shared/sync'
import type { Skills } from '../ia/conversations'
import type { Favoris } from '../stockage/favoris'
import { lireJson, ecrireJson } from '../stockage/fichierJson'
import type { MagasinReglages } from '../stockage/reglages'

const b64url = (b: Buffer): string => b.toString('base64url')

/** Dérivations de la clé : identifiant de l'espace, jeton d'écriture, clé de chiffrement. */
export function deriver(cle: Buffer): { id: string; jeton: string; chiffrement: Buffer } {
  return {
    id: b64url(createHash('sha256').update('se7en-sync:id:').update(cle).digest()),
    jeton: b64url(createHmac('sha256', cle).update('se7en-sync:auth').digest()),
    chiffrement: Buffer.from(hkdfSync('sha256', cle, Buffer.alloc(0), 'se7en-sync:chiffrement', 32))
  }
}

export function chiffrer(cleChiffrement: Buffer, paquet: PaquetSync): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', cleChiffrement, iv)
  const corps = Buffer.concat([c.update(deflateRawSync(Buffer.from(JSON.stringify(paquet)))), c.final()])
  return Buffer.concat([iv, c.getAuthTag(), corps]).toString('base64')
}

export function dechiffrer(cleChiffrement: Buffer, texte: string): PaquetSync {
  const b = Buffer.from(texte, 'base64')
  const d = createDecipheriv('aes-256-gcm', cleChiffrement, b.subarray(0, 12))
  d.setAuthTag(b.subarray(12, 28))
  const clair = Buffer.concat([d.update(b.subarray(28)), d.final()])
  return lirePaquet(JSON.parse(inflateRawSync(clair).toString('utf8')))
}

const empreinte = (v: unknown): string => createHash('sha256').update(JSON.stringify(v ?? null)).digest('hex').slice(0, 24)

interface EtatLocal {
  appareil: string
  nom: string
  /** Empreinte de chaque catégorie lors de la dernière synchro, et date de sa dernière modification connue. */
  empreintes: Partial<Record<CategorieSync, string>>
  modifs: Partial<Record<CategorieSync, number>>
  ongletsEmpreinte?: string
}

export class ServiceSync extends EventEmitter<{ etat: [EtatSync] }> {
  private readonly cheminCle: string
  private readonly cheminEtat: string
  private local: EtatLocal
  private valeur: EtatSync
  private minuteur: NodeJS.Timeout | null = null
  private relance: NodeJS.Timeout | null = null
  private enCours = false

  constructor(
    dossier: string,
    private readonly favoris: Favoris,
    private readonly skills: Skills,
    private readonly reglages: MagasinReglages,
    private readonly onglets: () => OngletDistant[]
  ) {
    super()
    this.cheminCle = join(dossier, 'sync-cle.bin')
    this.cheminEtat = join(dossier, 'sync-etat.json')
    const brut = lireJson(this.cheminEtat) as Partial<EtatLocal> | undefined
    this.local = {
      appareil: typeof brut?.appareil === 'string' ? brut.appareil : randomUUID().slice(0, 18),
      nom: typeof brut?.nom === 'string' ? brut.nom : hostname().slice(0, 60),
      empreintes: brut?.empreintes ?? {},
      modifs: brut?.modifs ?? {},
      ongletsEmpreinte: brut?.ongletsEmpreinte
    }
    this.valeur = { active: !!this.cle(), appareil: this.local.nom, derniere: null, erreur: null, enCours: false, autres: [] }
    // un changement local part vite (après 20 s de calme), sans attendre le prochain tour
    const bientot = (): void => {
      if (!this.valeur.active) return
      if (this.relance) clearTimeout(this.relance)
      this.relance = setTimeout(() => void this.synchroniser(), 20_000)
    }
    favoris.on('change', bientot)
    reglages.on('change', bientot)
  }

  etat(): EtatSync {
    return this.valeur
  }

  demarrer(): void {
    if (this.minuteur) return
    setTimeout(() => void this.synchroniser(), 15_000)
    this.minuteur = setInterval(() => void this.synchroniser(), 3 * 60_000)
  }

  arreter(): void {
    if (this.minuteur) clearInterval(this.minuteur)
    this.minuteur = null
  }

  /** Crée un nouvel espace de synchronisation (premier PC) ; renvoie le code de liaison. */
  async activer(): Promise<string | { erreur: string }> {
    if (!safeStorage.isEncryptionAvailable()) return { erreur: 'Le chiffrement de Windows n’est pas disponible.' }
    const cle = randomBytes(32)
    writeFileSync(this.cheminCle, safeStorage.encryptString(cle.toString('base64')))
    this.local.empreintes = {}
    this.local.modifs = {}
    this.changer({ active: true, erreur: null })
    await this.synchroniser()
    return codeDeCle(cle)
  }

  /** Relie ce PC à un espace existant avec le code de liaison. */
  async relier(code: string): Promise<{ ok: true } | { erreur: string }> {
    const cle = cleDeCode(code)
    if (!cle) return { erreur: 'Code de liaison incorrect : vérifie-le (14 groupes, une faute est détectée).' }
    if (!safeStorage.isEncryptionAvailable()) return { erreur: 'Le chiffrement de Windows n’est pas disponible.' }
    writeFileSync(this.cheminCle, safeStorage.encryptString(Buffer.from(cle).toString('base64')))
    // ce PC n'impose rien : ce qui est déjà synchronisé l'emporte, ses catégories à lui ne partent que si l'espace est vide
    this.local.empreintes = {}
    this.local.modifs = {}
    this.changer({ active: true, erreur: null })
    await this.synchroniser(true)
    return this.valeur.erreur ? { erreur: this.valeur.erreur } : { ok: true }
  }

  codeLiaison(): string | null {
    const c = this.cle()
    return c ? codeDeCle(c) : null
  }

  /** Arrête la synchronisation sur ce PC ; avec `effacer`, supprime aussi le paquet chiffré du serveur (pour tous les PC). */
  async desactiver(effacer: boolean): Promise<void> {
    const c = this.cle()
    if (c && effacer) {
      const { id, jeton } = deriver(c)
      await net.fetch(`${this.serveur()}/sync/${id}`, { method: 'DELETE', headers: { 'X-Sync-Auth': jeton } }).catch(() => undefined)
    }
    rmSync(this.cheminCle, { force: true })
    this.changer({ active: false, autres: [], derniere: null, erreur: null })
  }

  renommer(nom: string): void {
    this.local.nom = nom.trim().slice(0, 60) || hostname()
    this.sauverLocal()
    this.changer({ appareil: this.local.nom })
  }

  private cle(): Buffer | null {
    try {
      return Buffer.from(safeStorage.decryptString(readFileSync(this.cheminCle)), 'base64')
    } catch {
      return null
    }
  }

  private serveur(): string {
    return this.reglages.get().serveurSocial || SERVEUR_SOCIAL_OFFICIEL
  }

  private changer(p: Partial<EtatSync>): void {
    this.valeur = { ...this.valeur, ...p }
    this.emit('etat', this.valeur)
  }

  private sauverLocal(): void {
    void ecrireJson(this.cheminEtat, this.local).catch(() => undefined)
  }

  /** Valeurs locales de chaque catégorie. */
  private valeursLocales(): Record<CategorieSync, unknown> {
    const r = this.reglages.get()
    return {
      favoris: this.favoris.lire(),
      skills: this.skills.lire(),
      reglages: Object.fromEntries(REGLAGES_SYNCHRONISES.map((k) => [k, r[k as keyof Reglages]]))
    }
  }

  private appliquer(c: CategorieSync, valeur: unknown): void {
    if (c === 'favoris') this.favoris.remplacer(valeur)
    else if (c === 'skills') this.skills.sauver(valeur as Skill[])
    else if (c === 'reglages' && valeur && typeof valeur === 'object') {
      const permis = Object.fromEntries(Object.entries(valeur).filter(([k]) => (REGLAGES_SYNCHRONISES as readonly string[]).includes(k)))
      void this.reglages.modifier(permis)
    }
  }

  async synchroniser(rejoindre = false, essai = 0): Promise<void> {
    const cle = this.cle()
    if (!cle || this.enCours) return
    this.enCours = true
    this.changer({ enCours: true })
    try {
      const { id, jeton, chiffrement } = deriver(cle)
      const url = `${this.serveur()}/sync/${id}`
      const rep = await net.fetch(url, { headers: { 'X-Sync-Auth': jeton } })
      if (rep.status === 404) throw new Error('Le serveur ne connaît pas encore la synchronisation (mise à jour du serveur nécessaire).')
      if (!rep.ok) throw new Error(rep.status === 403 ? 'Le serveur a refusé le jeton : relie ce PC à nouveau.' : `Le serveur a répondu ${rep.status}.`)
      const d = (await rep.json()) as { version: number; donnees: string | null }
      const distant = d.donnees ? dechiffrer(chiffrement, d.donnees) : PAQUET_VIDE

      // ce que ce PC apporte : chaque catégorie, avec la date de sa dernière modification locale
      const maintenant = Date.now()
      const valeurs = this.valeursLocales()
      const local: PaquetSync = { v: 1, categories: {}, appareils: {} }
      for (const c of Object.keys(valeurs) as CategorieSync[]) {
        const e = empreinte(valeurs[c])
        if (this.local.empreintes[c] !== e) this.local.modifs[c] = rejoindre && distant.categories[c] ? 0 : maintenant
        local.categories[c] = { modif: this.local.modifs[c] ?? 0, valeur: valeurs[c] }
      }
      const onglets = this.onglets().slice(0, 100)
      const ongletsChanges = empreinte(onglets) !== this.local.ongletsEmpreinte
      const ancien = distant.appareils[this.local.appareil]
      local.appareils[this.local.appareil] = { nom: this.local.nom, maj: ongletsChanges || !ancien || ancien.nom !== this.local.nom ? maintenant : ancien.maj, onglets }

      const fusion = fusionnerPaquets(local, distant, maintenant)
      // appliquer ici ce qui vient des autres PC
      for (const c of Object.keys(valeurs) as CategorieSync[]) {
        const f = fusion.categories[c]
        if (f && empreinte(f.valeur) !== empreinte(valeurs[c])) this.appliquer(c, f.valeur)
        if (f) {
          this.local.empreintes[c] = empreinte(f.valeur)
          this.local.modifs[c] = f.modif
        }
      }
      this.local.ongletsEmpreinte = empreinte(onglets)
      this.sauverLocal()

      // réécrire seulement si le paquet a changé
      if (!d.donnees || empreinte(fusion) !== empreinte(distant)) {
        const put = await net.fetch(url, {
          method: 'PUT',
          headers: { 'X-Sync-Auth': jeton, 'content-type': 'application/json' },
          body: JSON.stringify({ version: d.version, donnees: chiffrer(chiffrement, fusion) })
        })
        if (put.status === 409 && essai < 2) {
          // un autre PC a écrit entre-temps : on recommence avec sa version
          this.enCours = false
          return await this.synchroniser(rejoindre, essai + 1)
        }
        if (!put.ok) throw new Error(`Le serveur a refusé l'envoi (${put.status}).`)
      }
      const autres = Object.entries(fusion.appareils)
        .filter(([i]) => i !== this.local.appareil)
        .map(([i, a]) => ({ id: i, ...a }))
        .sort((a, b) => b.maj - a.maj)
      this.changer({ derniere: Date.now(), erreur: null, autres })
    } catch (e) {
      this.changer({ erreur: e instanceof Error ? e.message : 'La synchronisation a échoué.' })
    } finally {
      this.enCours = false
      this.changer({ enCours: false })
    }
  }
}
