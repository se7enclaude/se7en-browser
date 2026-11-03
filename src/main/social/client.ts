/* Client du serveur se7en social : profil, amis, messages, et connexion directe (WebSocket) pour recevoir
 * les messages en temps réel. Tout passe par le main : l'interface ne parle jamais au serveur elle-même. */
import { safeStorage } from 'electron'
import { EventEmitter } from 'node:events'
import { promises as fs, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Identite } from './identite'
import type { ActionEnsemble, Ami, CibleSocial, StatutSocial, EtatSocial, EvenementSocial, GroupeSocial, MessageSocial, ProfilSocial } from '../../shared/social'

/** Réponse d'erreur du serveur ou du réseau, déjà en français. */
export class ErreurSocial extends Error {
  constructor(
    message: string,
    readonly statut = 0
  ) {
    super(message)
  }
}

const PING = 30_000
const ATTENTE_MAX = 60_000

export class ClientSocial extends EventEmitter<{ etat: [EtatSocial]; evenement: [EvenementSocial] }> {
  private identite: Identite | null = null
  private readonly cheminIdentite: string
  private etatActuel: EtatSocial = { connexion: 'desactive', profil: null, erreur: null }
  private ws: WebSocket | null = null
  private minuteurPing: NodeJS.Timeout | null = null
  private minuteurReconnexion: NodeJS.Timeout | null = null
  private attente = 2000
  private readonly photos = new Map<string, { url: string | null; date: number }>()
  /** Images des messages déjà chargées (data: URL), les plus récentes. */
  private readonly images = new Map<string, string>()
  private generation = 0

  constructor(
    dossier: string,
    private readonly serveur: () => string | null
  ) {
    super()
    this.cheminIdentite = join(dossier, 'identite.bin')
    if (!safeStorage.isEncryptionAvailable()) return
    try {
      this.identite = Identite.depuis(safeStorage.decryptString(readFileSync(this.cheminIdentite)))
    } catch {
      this.identite = null // pas encore de profil sur ce PC
    }
  }

  etat(): EtatSocial {
    return this.etatActuel
  }

  /** (Re)démarre : lit le profil puis ouvre la connexion directe. À appeler au lancement et quand l'adresse du serveur change. */
  async demarrer(): Promise<void> {
    this.couper()
    const gen = ++this.generation
    if (!this.serveur()) return this.changer({ connexion: 'desactive', profil: null, erreur: null })
    if (!this.identite) return this.changer({ connexion: 'hors-ligne', profil: null, erreur: null })
    this.changer({ connexion: 'connexion', erreur: null })
    try {
      const profil = await this.requete<ProfilSocial>('GET', '/api/profil')
      if (gen !== this.generation) return
      this.changer({ profil })
      this.connecterDirect(gen)
    } catch (e) {
      if (gen !== this.generation) return
      const err = e as ErreurSocial
      // profil supprimé côté serveur : on repart de zéro sur ce PC
      if (err.statut === 404) this.changer({ connexion: 'hors-ligne', profil: null, erreur: null })
      else {
        this.changer({ connexion: 'hors-ligne', erreur: err.message })
        this.planifierReconnexion(gen)
      }
    }
  }

  /** Crée le profil (et l'identité du PC la première fois), ou change le pseudo. */
  async enregistrerProfil(pseudo: string): Promise<EtatSocial> {
    if (!this.identite) {
      if (!safeStorage.isEncryptionAvailable()) throw new ErreurSocial('Windows ne permet pas de protéger ta clé sur ce compte.')
      const id = Identite.nouvelle()
      await fs.writeFile(this.cheminIdentite, safeStorage.encryptString(id.exporter()))
      this.identite = id
    }
    const profil = await this.requete<ProfilSocial>('POST', '/api/profil', { pseudo })
    this.changer({ profil })
    if (this.etatActuel.connexion !== 'connecte') await this.demarrer()
    return this.etatActuel
  }

  /** Code de secours du profil de ce PC (pour le retrouver sur un autre PC). */
  codeSecours(): string | null {
    return this.identite?.codeSecours() ?? null
  }

  /** Retrouve un profil existant avec son code de secours : la clé remplace celle de ce PC. */
  async recuperer(code: string): Promise<EtatSocial> {
    const id = Identite.depuisCode(code)
    if (!id) throw new ErreurSocial('Code de secours incorrect : vérifie chaque groupe de lettres.')
    if (!safeStorage.isEncryptionAvailable()) throw new ErreurSocial('Windows ne permet pas de protéger ta clé sur ce compte.')
    const ancienne = this.identite
    this.identite = id
    try {
      const profil = await this.requete<ProfilSocial>('GET', '/api/profil')
      await fs.writeFile(this.cheminIdentite, safeStorage.encryptString(id.exporter()))
      this.photos.clear()
      this.changer({ profil })
      await this.demarrer()
      return this.etatActuel
    } catch (e) {
      this.identite = ancienne
      const err = e as ErreurSocial
      throw err.statut === 404 ? new ErreurSocial('Aucun profil ne correspond à ce code.') : err
    }
  }

  /** Supprime le compte sur le serveur (profil, photo, amis, messages) et la clé de ce PC. */
  async supprimerProfil(): Promise<EtatSocial> {
    await this.requete('DELETE', '/api/profil')
    this.couper()
    this.identite = null
    this.photos.clear()
    await fs.rm(this.cheminIdentite, { force: true })
    this.changer({ connexion: 'hors-ligne', profil: null, erreur: null })
    return this.etatActuel
  }

  async envoyerPhoto(jpeg: Buffer): Promise<void> {
    await this.requete('PUT', '/api/photo', jpeg, 'image/jpeg')
    const p = this.etatActuel.profil
    if (p) {
      this.photos.delete(p.id)
      this.changer({ profil: { ...p, photo: true } })
    }
  }

  /** Photo d'un ami (ou la sienne) en data: URL, gardée 5 minutes. */
  async photo(id: string): Promise<string | null> {
    const enCache = this.photos.get(id)
    if (enCache && Date.now() - enCache.date < 300_000) return enCache.url
    let url: string | null = null
    try {
      const r = await this.brut('GET', `/api/photo/${encodeURIComponent(id)}`)
      const type = r.headers.get('Content-Type') ?? ''
      if (r.ok && /^image\/(jpeg|png|webp)$/.test(type)) url = `data:${type};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`
    } catch {
      url = null
    }
    this.photos.set(id, { url, date: Date.now() })
    return url
  }

  async amis(): Promise<Ami[]> {
    return (await this.requete<{ amis: Ami[] }>('GET', '/api/amis')).amis
  }

  async ajouter(code: string): Promise<{ statut: string }> {
    return this.requete('POST', '/api/amis', { code })
  }

  async accepter(id: string): Promise<void> {
    await this.requete('POST', `/api/amis/${encodeURIComponent(id)}/accepter`)
  }

  /** Refuse une demande, l'annule, ou retire un ami. */
  async retirer(id: string): Promise<void> {
    await this.requete('POST', `/api/amis/${encodeURIComponent(id)}/retirer`)
  }

  async messages(ami: string, avant?: number): Promise<MessageSocial[]> {
    const q = avant ? `?avant=${Math.floor(avant)}` : ''
    return (await this.requete<{ messages: MessageSocial[] }>('GET', `/api/messages/${encodeURIComponent(ami)}${q}`)).messages
  }

  async envoyer(ami: string, contenu: { texte: string; url?: string; titre?: string }): Promise<MessageSocial> {
    return (await this.requete<{ message: MessageSocial }>('POST', `/api/messages/${encodeURIComponent(ami)}`, contenu)).message
  }

  async marquerLu(ami: string): Promise<void> {
    await this.requete('POST', `/api/messages/${encodeURIComponent(ami)}/lu`)
  }

  // ---------- groupes ----------

  async groupes(): Promise<GroupeSocial[]> {
    return (await this.requete<{ groupes: GroupeSocial[] }>('GET', '/api/groupes')).groupes
  }

  async creerGroupe(nom: string, membres: string[]): Promise<string> {
    return (await this.requete<{ id: string }>('POST', '/api/groupes', { nom, membres })).id
  }

  async ajouterMembre(groupe: string, id: string): Promise<void> {
    await this.requete('POST', `/api/groupes/${encodeURIComponent(groupe)}/membres`, { id })
  }

  async renommerGroupe(groupe: string, nom: string): Promise<void> {
    await this.requete('POST', `/api/groupes/${encodeURIComponent(groupe)}/nom`, { nom })
  }

  async quitterGroupe(groupe: string): Promise<void> {
    await this.requete('POST', `/api/groupes/${encodeURIComponent(groupe)}/quitter`)
  }

  // ---------- conversations (ami ou groupe) ----------

  private base(c: CibleSocial): string {
    return c.type === 'ami' ? `/api/messages/${encodeURIComponent(c.id)}` : `/api/groupes/${encodeURIComponent(c.id)}/messages`
  }

  async messagesDe(c: CibleSocial, avant?: number): Promise<MessageSocial[]> {
    const q = avant ? `?avant=${Math.floor(avant)}` : ''
    return (await this.requete<{ messages: MessageSocial[] }>('GET', `${this.base(c)}${q}`)).messages
  }

  async envoyerA(c: CibleSocial, contenu: { texte: string; url?: string; titre?: string }): Promise<MessageSocial> {
    return (await this.requete<{ message: MessageSocial }>('POST', this.base(c), contenu)).message
  }

  async marquerLuDe(c: CibleSocial): Promise<void> {
    await this.requete('POST', c.type === 'ami' ? `/api/messages/${encodeURIComponent(c.id)}/lu` : `/api/groupes/${encodeURIComponent(c.id)}/lu`)
  }

  /** Envoie une image (déjà réduite en JPEG par le main). */
  async envoyerImage(c: CibleSocial, jpeg: Buffer): Promise<MessageSocial> {
    const chemin = c.type === 'ami' ? `/api/messages/${encodeURIComponent(c.id)}/image` : `/api/groupes/${encodeURIComponent(c.id)}/image`
    const m = (await this.requete<{ message: MessageSocial }>('PUT', chemin, jpeg, 'image/jpeg')).message
    this.images.set(m.image!, `data:image/jpeg;base64,${jpeg.toString('base64')}`)
    return m
  }

  /** Image d'un message en data: URL (gardée tant que la session dure, 60 au plus). */
  async image(id: string): Promise<string | null> {
    const enCache = this.images.get(id)
    if (enCache) return enCache
    const r = await this.brut('GET', `/api/image/${encodeURIComponent(id)}`)
    const type = r.headers.get('Content-Type') ?? ''
    if (!r.ok || !/^(image\/(jpeg|png|webp)|audio\/(webm|ogg))$/.test(type)) return null
    const url = `data:${type};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`
    this.images.set(id, url)
    while (this.images.size > 60) this.images.delete(this.images.keys().next().value!)
    return url
  }

  /** Envoie un message vocal (WebM/Opus enregistré par l'interface). */
  async envoyerVocal(c: CibleSocial, son: Buffer, type: string): Promise<MessageSocial> {
    const chemin = c.type === 'ami' ? `/api/messages/${encodeURIComponent(c.id)}/vocal` : `/api/groupes/${encodeURIComponent(c.id)}/vocal`
    const m = (await this.requete<{ message: MessageSocial }>('PUT', chemin, son, type)).message
    if (m.vocal) this.images.set(m.vocal, `data:${type};base64,${son.toString('base64')}`)
    return m
  }

  /** Change son statut ; les amis le voient tout de suite. */
  async changerStatut(s: StatutSocial | null): Promise<EtatSocial> {
    const r = await this.requete<{ statut: StatutSocial | null }>('POST', '/api/statut', s ? { type: s.type, texte: s.texte } : { type: 'dispo' })
    const p = this.etatActuel.profil
    if (p) this.changer({ profil: { ...p, humeur: r.statut } })
    return this.etatActuel
  }

  /** Petit signal relayé en direct (« écrit… », naviguer ensemble) ; ignoré hors connexion. */
  signal(donnees: Record<string, unknown>): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false
    this.ws.send(JSON.stringify(donnees))
    return true
  }

  arreter(): void {
    this.generation++
    this.couper()
  }

  // ---------- réseau ----------

  private async brut(methode: string, chemin: string, donnees?: unknown, type = 'application/json'): Promise<Response> {
    const base = this.serveur()
    if (!base) throw new ErreurSocial('Le serveur se7en social n’est pas configuré.')
    if (!this.identite) throw new ErreurSocial('Crée d’abord ton profil.')
    const corps = donnees === undefined ? Buffer.alloc(0) : Buffer.isBuffer(donnees) ? donnees : Buffer.from(JSON.stringify(donnees))
    const enTetes: Record<string, string> = { ...this.identite.signer(methode, chemin.split('?')[0], corps) }
    if (corps.length) enTetes['Content-Type'] = type
    try {
      return await fetch(base + chemin, {
        method: methode,
        headers: enTetes,
        body: corps.length ? new Uint8Array(corps) : undefined,
        signal: AbortSignal.timeout(15_000),
        redirect: 'error'
      })
    } catch {
      throw new ErreurSocial('Serveur se7en social injoignable (connexion Internet ?).')
    }
  }

  private async requete<T = unknown>(methode: string, chemin: string, donnees?: unknown, type?: string): Promise<T> {
    const r = await this.brut(methode, chemin, donnees, type)
    let json: unknown = null
    try {
      json = await r.json()
    } catch {
      json = null
    }
    if (!r.ok) {
      const message = (json as { erreur?: unknown })?.erreur
      throw new ErreurSocial(typeof message === 'string' ? message.slice(0, 200) : `Erreur du serveur (${r.status}).`, r.status)
    }
    return json as T
  }

  /** Connexion directe : le serveur y pousse messages, demandes d'amis et présence. */
  private connecterDirect(gen: number): void {
    const base = this.serveur()
    if (!base || !this.identite) return
    const s = this.identite.signer('GET', '/api/direct')
    const q = new URLSearchParams({ cle: s['X-Se7en-Cle'], heure: s['X-Se7en-Heure'], nonce: s['X-Se7en-Nonce'], signature: s['X-Se7en-Signature'] })
    let ws: WebSocket
    try {
      ws = new WebSocket(`${base.replace(/^http/, 'ws')}/api/direct?${q}`)
    } catch {
      return this.planifierReconnexion(gen)
    }
    this.ws = ws
    ws.onopen = () => {
      if (gen !== this.generation) return ws.close()
      this.attente = 2000
      this.changer({ connexion: 'connecte', erreur: null })
      this.minuteurPing = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('ping'), PING)
    }
    ws.onmessage = (e) => {
      if (gen !== this.generation || typeof e.data !== 'string' || e.data === 'pong') return
      const ev = lireEvenement(e.data)
      if (ev) this.emit('evenement', ev)
    }
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null
      if (this.minuteurPing) clearInterval(this.minuteurPing)
      if (gen !== this.generation) return
      this.changer({ connexion: 'hors-ligne' })
      this.planifierReconnexion(gen)
    }
  }

  private planifierReconnexion(gen: number): void {
    if (this.minuteurReconnexion) clearTimeout(this.minuteurReconnexion)
    this.minuteurReconnexion = setTimeout(() => gen === this.generation && void this.demarrer(), this.attente)
    this.attente = Math.min(ATTENTE_MAX, this.attente * 2)
  }

  private couper(): void {
    if (this.minuteurReconnexion) clearTimeout(this.minuteurReconnexion)
    if (this.minuteurPing) clearInterval(this.minuteurPing)
    this.minuteurReconnexion = this.minuteurPing = null
    const ws = this.ws
    this.ws = null
    try {
      ws?.close()
    } catch {
      /* déjà fermée */
    }
  }

  private changer(partiel: Partial<EtatSocial>): void {
    this.etatActuel = { ...this.etatActuel, ...partiel }
    this.emit('etat', this.etatActuel)
  }
}

const ACTIONS_ENSEMBLE: ActionEnsemble[] = ['invite', 'accepte', 'refuse', 'url', 'defile', 'main', 'fin']

/** Vérifie la forme d'un évènement reçu (le serveur est distant : on ne lui fait pas confiance aveuglément). */
export function lireEvenement(texte: string): EvenementSocial | null {
  let o: Record<string, unknown>
  try {
    o = JSON.parse(texte) as Record<string, unknown>
  } catch {
    return null
  }
  if (o?.type === 'amis') return { type: 'amis' }
  if (o?.type === 'groupes') return { type: 'groupes' }
  if (o?.type === 'statut' && typeof o.id === 'string') return { type: 'statut', id: o.id, statut: lireStatut(o.statut) }
  if (o?.type === 'presence' && typeof o.id === 'string' && typeof o.enLigne === 'boolean') return { type: 'presence', id: o.id, enLigne: o.enLigne }
  if (o?.type === 'lu' && typeof o.id === 'string') return { type: 'lu', id: o.id }
  if (o?.type === 'ecrit' && typeof o.id === 'string') return { type: 'ecrit', id: o.id, ...(typeof o.groupe === 'string' ? { groupe: o.groupe } : {}) }
  if (o?.type === 'ensemble' && typeof o.de === 'string' && typeof o.action === 'string' && ACTIONS_ENSEMBLE.includes(o.action as ActionEnsemble)) {
    const url = typeof o.url === 'string' && /^https?:\/\//i.test(o.url) ? o.url.slice(0, 2000) : undefined
    return {
      type: 'ensemble',
      de: o.de,
      action: o.action as ActionEnsemble,
      ...(url ? { url } : {}),
      ...(typeof o.titre === 'string' ? { titre: o.titre.slice(0, 200) } : {}),
      ...(typeof o.pseudo === 'string' ? { pseudo: o.pseudo.slice(0, 24) } : {}),
      ...(typeof o.y === 'number' && o.y >= 0 && o.y <= 1 ? { y: o.y } : {})
    }
  }
  const m = o?.message as Record<string, unknown> | undefined
  if (o?.type === 'message' && m && typeof m.id === 'string' && typeof m.de === 'string' && typeof m.texte === 'string' && typeof m.date === 'number') {
    let url: string | null = null
    if (typeof m.url === 'string' && /^https?:\/\//i.test(m.url)) url = m.url
    return {
      type: 'message',
      pseudo: typeof o.pseudo === 'string' ? o.pseudo.slice(0, 24) : '?',
      message: {
        id: m.id,
        de: m.de,
        a: typeof m.a === 'string' ? m.a : '',
        type: url ? 'lien' : 'texte',
        texte: m.texte.slice(0, 2000),
        url,
        titre: url && typeof m.titre === 'string' ? m.titre.slice(0, 200) : null,
        groupe: typeof m.groupe === 'string' ? m.groupe : null,
        image: typeof m.image === 'string' && /^[\w-]{8,64}$/.test(m.image) ? m.image : null,
        vocal: typeof m.vocal === 'string' && /^[\w-]{8,64}$/.test(m.vocal) ? m.vocal : null,
        date: m.date,
        lu: 0
      }
    }
  }
  return null
}

/** Statut reçu du serveur, vérifié. */
function lireStatut(v: unknown): StatutSocial | null {
  const o = v as { type?: unknown; texte?: unknown } | null
  if (!o || (o.type !== 'occupe' && o.type !== 'jeu' && o.type !== 'absent')) return null
  return { type: o.type, texte: typeof o.texte === 'string' ? o.texte.slice(0, 60) : '' }
}
