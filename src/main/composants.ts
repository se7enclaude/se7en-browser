/* Composants téléchargés à l'exécution : est-ce qu'ils sont à jour ?
 * - Ollama : version installée comparée à la dernière release GitHub (ollama/ollama) ;
 * - modèles Qwen : manifeste installé comparé à celui du registre d'Ollama (quelques Ko, jamais le modèle) ;
 * - extensions : version installée comparée à celle du Chrome Web Store (service update2, réponse « updatecheck ») ;
 * - listes du bloqueur : renouvelées chaque semaine, l'ancien cache restant utilisé en attendant.
 * Au plus une vérification toutes les 12 heures ; hors-ligne, on garde le dernier état connu. Rien n'est retéléchargé
 * quand c'est à jour. Une nouvelle version trouvée donne un petit bandeau dans l'appli, une seule fois par version. */
import { net } from 'electron'
import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { join } from 'node:path'
import {
  aVerifier,
  comparerManifestes,
  ETAT_COMPOSANTS_VIDE,
  lireUpdatecheck,
  plusRecenteQue,
  cheminModele,
  signalerUneFois,
  urlUpdatecheck,
  versionDeTag,
  type EtatComposants,
  type InfoExtensionMaj,
  type Nouveaute
} from '../shared/composants'
import { modelePresent } from '../shared/ia'
import type { Reglages } from '../shared/reglages'
import type { Bloqueur } from './bloqueur/bloqueur'
import type { ServiceExtensions } from './extensions/extensions'
import { manifesteLocal, versionInstallee, type Ollama } from './ia/ollama'
import { ecrireJson, lireJson } from './stockage/fichierJson'

const RELEASE_OLLAMA = 'https://api.github.com/repos/ollama/ollama/releases/latest'
const REGISTRE_OLLAMA = 'https://registry.ollama.ai/v2'
/** Modèle dont l'état est inconnu (manifeste local introuvable) : re-téléchargement au plus une fois par semaine, comme avant. */
const SEMAINE = 7 * 24 * 3600 * 1000

interface Sauvegarde {
  etat: EtatComposants
  /** Nouveautés déjà signalées (« ollama:0.40.15 »…) : jamais deux fois. */
  signalees: string[]
  /** Dernière passe complète. */
  passe: number | null
  /** Modèles déjà re-téléchargés automatiquement (« nom@empreinte publiée ») : jamais deux fois pour la même version. */
  tentes: string[]
}

const sha256 = (texte: string): string => createHash('sha256').update(texte, 'utf8').digest('hex')

export class ServiceComposants extends EventEmitter<{ change: [EtatComposants] }> {
  private s: Sauvegarde
  private readonly fichier: string
  private readonly fichierModelesAncien: string
  private passeEnCours: Promise<void> | null = null

  constructor(
    dossier: string,
    private readonly d: { ollama: Ollama; extensions: ServiceExtensions; bloqueur: Bloqueur; reglages: () => Reglages }
  ) {
    super()
    this.fichier = join(dossier, 'composants.json')
    this.fichierModelesAncien = join(dossier, 'maj-modeles.json')
    const brut = lireJson(this.fichier) as Partial<Sauvegarde> | undefined
    const e = brut?.etat
    this.s = {
      etat: {
        ...ETAT_COMPOSANTS_VIDE,
        ollama: { ...ETAT_COMPOSANTS_VIDE.ollama, ...(e?.ollama ?? {}) },
        modeles: e?.modeles && typeof e.modeles === 'object' ? e.modeles : {},
        extensions: e?.extensions && typeof e.extensions === 'object' ? e.extensions : {},
        nouveautes: Array.isArray(e?.nouveautes) ? e.nouveautes.slice(-10) : [],
        bloqueur: d.bloqueur.infos(),
        enCours: false
      },
      signalees: Array.isArray(brut?.signalees) ? brut.signalees.filter((x): x is string => typeof x === 'string') : [],
      passe: typeof brut?.passe === 'number' ? brut.passe : null,
      tentes: Array.isArray(brut?.tentes) ? brut.tentes.filter((x): x is string => typeof x === 'string').slice(-50) : []
    }
    d.bloqueur.on('infos', (i) => this.maj({ bloqueur: i }))
    // version d'Ollama installée : dès que le service répond
    let pret = false
    d.ollama.on('change', (o) => {
      if (o.version && o.version !== '?' && o.version !== this.s.etat.ollama.installee) this.majOllama({ installee: o.version })
      // l'IA vient d'être activée : les modèles qui ont changé peuvent être récupérés
      if (o.phase === 'pret' && !o.tache && !pret) {
        pret = true
        this.telechargerModelesChanges()
      } else if (o.phase !== 'pret') pret = false
    })
    d.extensions.on('change', () => this.emit('change', this.etat()))
  }

  etat(): EtatComposants {
    return this.s.etat
  }

  private maj(partiel: Partial<EtatComposants>, sauver = true): void {
    this.s.etat = { ...this.s.etat, ...partiel }
    if (sauver) void ecrireJson(this.fichier, { ...this.s, etat: { ...this.s.etat, enCours: false } }).catch(() => undefined)
    this.emit('change', this.s.etat)
  }

  private majOllama(p: Partial<EtatComposants['ollama']>): void {
    this.maj({ ollama: { ...this.s.etat.ollama, ...p } })
  }

  private signaler(n: Nouveaute): void {
    if (!signalerUneFois(this.s.signalees, n.cle)) return
    this.maj({ nouveautes: [...this.s.etat.nouveautes.filter((x) => x.cle !== n.cle), n].slice(-10) })
  }

  /** Le bandeau a été vu (ou fermé). */
  vu(cle: string): void {
    this.maj({ nouveautes: this.s.etat.nouveautes.filter((n) => n.cle !== cle) })
  }

  /** Vérifie tout, au plus toutes les 12 heures (ou tout de suite avec `forcer`, depuis un bouton). */
  verifier(forcer = false): Promise<void> {
    if (!forcer && !aVerifier(this.s.passe, Date.now())) return Promise.resolve()
    this.passeEnCours ??= this.passe().finally(() => (this.passeEnCours = null))
    return this.passeEnCours
  }

  private async passe(): Promise<void> {
    this.maj({ enCours: true }, false)
    try {
      const resultats = await Promise.allSettled([this.verifierOllama(), this.verifierModeles(), this.verifierExtensions(), this.d.bloqueur.renouveler()])
      // la passe ne compte que si au moins une vérification a abouti (hors-ligne : on réessaiera au prochain tour)
      if (resultats.some((r) => r.status === 'fulfilled' && r.value === true)) this.s.passe = Date.now()
    } finally {
      this.maj({ enCours: false })
    }
  }

  // ---------- Ollama ----------

  private async verifierOllama(): Promise<boolean> {
    const o = this.d.ollama.etat()
    const installee = o.version && o.version !== '?' ? o.version : await versionInstallee()
    if (!installee) {
      if (this.s.etat.ollama.installee) this.majOllama({ installee: null })
      return false
    }
    let derniere: string | null
    try {
      const r = await net.fetch(RELEASE_OLLAMA, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15_000) })
      if (!r.ok) throw new Error(String(r.status))
      derniere = versionDeTag(((await r.json()) as { tag_name?: unknown }).tag_name)
      if (!derniere) throw new Error('tag')
    } catch {
      this.majOllama({ installee }) // hors-ligne : on garde la dernière version publiée connue
      return false
    }
    this.majOllama({ installee, derniere, verifie: Date.now() })
    if (plusRecenteQue(derniere, installee))
      this.signaler({ cle: `ollama:${derniere}`, texte: `Ollama ${derniere} est disponible (tu as la ${installee}).`, page: 'se7en://ia' })
    return true
  }

  /** Après une mise à jour d'Ollama : relit la version installée (sans réseau). */
  async apresMiseAJourOllama(): Promise<void> {
    const v = this.d.ollama.etat().version
    const installee = v && v !== '?' ? v : await versionInstallee()
    if (installee) this.majOllama({ installee })
  }

  /** Une mise à jour d'Ollama est-elle disponible ? (seul cas où le bouton « Mettre à jour » agit) */
  ollamaAMettreAJour(): boolean {
    const o = this.s.etat.ollama
    return plusRecenteQue(o.derniere, this.d.ollama.etat().version ?? o.installee)
  }

  // ---------- modèles ----------

  private nomsModeles(): string[] {
    const r = this.d.reglages()
    return [...new Set([r.modeleTexte, r.modeleVision, r.modeleRapide].map((n) => n.trim()).filter(Boolean))]
  }

  /** Compare le manifeste de chaque modèle installé à celui du registre ; re-télécharge seulement ceux qui ont changé. */
  async verifierModeles(noms = this.nomsModeles(), automatique = true): Promise<boolean> {
    const installes = this.d.ollama.etat().modeles
    let ok = false
    const modeles = { ...this.s.etat.modeles }
    for (const nom of noms) {
      const local = await manifesteLocal(nom)
      if (!local && !modelePresent(nom, installes)) {
        delete modeles[nom]
        continue
      }
      const c = cheminModele(nom)
      if (!c) continue
      try {
        const r = await net.fetch(`${REGISTRE_OLLAMA}/${c.espace}/${c.modele}/manifests/${c.etiquette}`, {
          headers: { Accept: 'application/vnd.docker.distribution.manifest.v2+json' },
          signal: AbortSignal.timeout(15_000)
        })
        if (!r.ok) throw new Error(String(r.status))
        const distant = await r.text()
        const shaD = sha256(distant)
        const shaL = local ? sha256(local) : null
        const etat = comparerManifestes(local, shaL, distant, shaD)
        modeles[nom] = { local: shaL, distant: shaD, etat, verifie: Date.now() }
        ok = true
      } catch {
        /* hors-ligne : on garde le dernier état connu */
      }
    }
    this.maj({ modeles })
    for (const nom of noms) {
      const m = modeles[nom]
      if (m?.etat === 'mise-a-jour' && m.distant)
        this.signaler({ cle: `modele:${nom}:${m.distant}`, texte: `Une nouvelle version du modèle ${nom} est disponible.`, page: 'se7en://ia' })
    }
    if (automatique) this.telechargerModelesChanges()
    return ok
  }

  /** Re-téléchargement automatique (réglage « modèles Qwen ») des seuls modèles qui ont changé, quand l'IA est prête. */
  telechargerModelesChanges(): void {
    const o = this.d.ollama.etat()
    if (!this.d.reglages().modelesAuto || o.phase !== 'pret' || o.tache) return
    const modeles = this.s.etat.modeles
    const changes = this.nomsModeles().filter(
      (n) => modeles[n]?.etat === 'mise-a-jour' && modelePresent(n, o.modeles) && !this.s.tentes.includes(`${n}@${modeles[n].distant}`)
    )
    for (const n of changes) signalerUneFois(this.s.tentes, `${n}@${modeles[n].distant}`)
    if (this.s.tentes.length > 50) this.s.tentes.splice(0, this.s.tentes.length - 50)
    // état inconnu (manifeste introuvable) : comme avant, au plus une fois par semaine
    const ancien = (lireJson(this.fichierModelesAncien) as { date?: number } | undefined)?.date ?? 0
    const inconnus = Date.now() - ancien >= SEMAINE ? this.nomsModeles().filter((n) => modeles[n]?.etat === 'inconnu' && modelePresent(n, o.modeles)) : []
    if (inconnus.length) void ecrireJson(this.fichierModelesAncien, { date: Date.now() }).catch(() => undefined)
    const noms = [...new Set([...changes, ...inconnus])]
    if (noms.length) void this.mettreAJourModeles(noms)
  }

  /** Télécharge les modèles qui ont changé (Ollama ne récupère que les morceaux nouveaux), puis vérifie à nouveau. */
  async mettreAJourModeles(noms: string[]): Promise<void> {
    await this.d.ollama.telecharger(noms)
    await this.verifierModeles(noms, false)
  }

  modeleAMettreAJour(nom: string): boolean {
    return this.s.etat.modeles[nom]?.etat === 'mise-a-jour'
  }

  // ---------- extensions ----------

  private async verifierExtensions(): Promise<boolean> {
    const liste = this.d.extensions.lister()
    if (!liste.length) {
      if (Object.keys(this.s.etat.extensions).length) this.maj({ extensions: {} })
      return false
    }
    let reponse: ReturnType<typeof lireUpdatecheck>
    try {
      const r = await net.fetch(urlUpdatecheck(liste.map((e) => e.id), process.versions.chrome), { signal: AbortSignal.timeout(15_000) })
      if (!r.ok) throw new Error(String(r.status))
      reponse = lireUpdatecheck(await r.text())
    } catch {
      return false
    }
    const extensions: Record<string, InfoExtensionMaj> = {}
    for (const e of liste) {
      const v = reponse[e.id]?.version
      if (v) extensions[e.id] = { disponible: v, verifie: Date.now() }
      else if (this.s.etat.extensions[e.id]) extensions[e.id] = this.s.etat.extensions[e.id]
    }
    this.maj({ extensions })
    for (const e of liste) {
      const dispo = extensions[e.id]?.disponible
      if (plusRecenteQue(dispo, e.version))
        this.signaler({ cle: `extension:${e.id}:${dispo}`, texte: `${e.nom} ${dispo} est disponible (tu as la ${e.version}).`, page: 'se7en://extensions' })
    }
    return true
  }

  /** Met à jour une extension, seulement si le Chrome Web Store a une version plus récente. */
  async mettreAJourExtension(id: string): Promise<{ ok: true } | { erreur: string }> {
    const e = this.d.extensions.lister().find((x) => x.id === id)
    const dispo = this.s.etat.extensions[id]?.disponible
    if (!e) return { erreur: 'Extension introuvable.' }
    if (!plusRecenteQue(dispo, e.version)) return { erreur: `${e.nom} est déjà à jour.` }
    const r = await this.d.extensions.installer(id)
    if ('erreur' in r) return r
    this.vu(`extension:${id}:${dispo}`)
    return { ok: true }
  }
}
