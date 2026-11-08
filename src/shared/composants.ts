/* Composants téléchargés à l'exécution (Ollama, modèles Qwen, extensions, listes du bloqueur) :
 * état « à jour / mise à jour disponible », partagé entre le main et l'interface, et la logique pure
 * (comparaison de versions, lecture de la réponse du Chrome Web Store, comparaison des manifestes Ollama). */

/** Au plus une vérification toutes les 12 heures. */
export const INTERVALLE_VERIFICATION = 12 * 3600 * 1000

export type Fraicheur = 'a-jour' | 'mise-a-jour' | 'inconnu'

export interface InfoOllamaMaj {
  /** Dernière version installée connue. */
  installee: string | null
  /** Dernière version publiée (release GitHub ollama/ollama). */
  derniere: string | null
  /** Date de la dernière vérification réussie. */
  verifie: number | null
}

export interface InfoModeleMaj {
  /** Empreinte (sha256) du manifeste installé, ou null s'il est introuvable. */
  local: string | null
  /** Empreinte (sha256) du manifeste publié sur le registre d'Ollama. */
  distant: string | null
  etat: Fraicheur
  verifie: number
}

export interface InfoExtensionMaj {
  /** Version publiée sur le Chrome Web Store. */
  disponible: string
  verifie: number
}

export interface InfoBloqueurMaj {
  /** Date du dernier téléchargement des listes de filtres. */
  listes: number | null
  /** Dernière tentative de renouvellement (réussie ou non). */
  essai: number | null
}

/** Nouvelle version trouvée : petit bandeau dans l'appli, une seule fois par version. */
export interface Nouveaute {
  cle: string
  texte: string
  /** Page interne à ouvrir (« se7en://ia », « se7en://extensions »). */
  page: string
}

export interface EtatComposants {
  ollama: InfoOllamaMaj
  /** Par nom de modèle (« qwen3:8b »). */
  modeles: Record<string, InfoModeleMaj>
  /** Par identifiant d'extension. */
  extensions: Record<string, InfoExtensionMaj>
  bloqueur: InfoBloqueurMaj
  /** Nouveautés pas encore vues. */
  nouveautes: Nouveaute[]
  /** Une vérification est en cours. */
  enCours: boolean
}

export const ETAT_COMPOSANTS_VIDE: EtatComposants = {
  ollama: { installee: null, derniere: null, verifie: null },
  modeles: {},
  extensions: {},
  bloqueur: { listes: null, essai: null },
  nouveautes: [],
  enCours: false
}

// ---------- versions ----------

/** Compare deux versions (« v0.12.3 », « 0.13.0-rc1 », « 4.9.135.0 ») : négatif si a < b, 0 si égales, positif si a > b.
 * Une préversion (« -rc1 ») passe avant la version finale. */
export function comparerVersions(a: string, b: string): number {
  const decouper = (v: string): { n: number[]; pre: string } => {
    const [base, ...reste] = v.trim().replace(/^v/i, '').split('-')
    return { n: base.split('.').map((x) => Number.parseInt(x, 10) || 0), pre: reste.join('-') }
  }
  const x = decouper(a)
  const y = decouper(b)
  for (let i = 0; i < Math.max(x.n.length, y.n.length); i++) {
    const d = (x.n[i] ?? 0) - (y.n[i] ?? 0)
    if (d !== 0) return d
  }
  if (x.pre === y.pre) return 0
  if (!x.pre) return 1
  if (!y.pre) return -1
  return x.pre.localeCompare(y.pre, 'en', { numeric: true })
}

export function plusRecenteQue(candidate: string | null | undefined, actuelle: string | null | undefined): boolean {
  return !!candidate && !!actuelle && comparerVersions(candidate, actuelle) > 0
}

/** « v0.40.15 » → « 0.40.15 » ; null si ce n'est pas une version. */
export function versionDeTag(tag: unknown): string | null {
  if (typeof tag !== 'string') return null
  const v = tag.trim().replace(/^v/i, '')
  return /^\d+(\.\d+)*(-[\w.]+)?$/.test(v) ? v : null
}

/** Version dans la sortie de « ollama --version » (« ollama version is 0.12.3 » ou « client version is 0.12.3 »). */
export function versionDeSortieOllama(sortie: string): string | null {
  const m = [...sortie.matchAll(/version is\s+v?(\d+(?:\.\d+)+(?:-[\w.]+)?)/gi)]
  return m.length ? m[m.length - 1][1] : null
}

/** Faut-il vérifier à nouveau ? (jamais vérifié, ou dernière vérification il y a plus de 12 h) */
export function aVerifier(derniere: number | null | undefined, maintenant: number, intervalle = INTERVALLE_VERIFICATION): boolean {
  return !derniere || maintenant - derniere >= intervalle || derniere > maintenant
}

// ---------- Chrome Web Store ----------

export interface ReponseUpdatecheck {
  version: string | null
  /** « ok », « noupdate », « error-unknownApplication »… */
  statut: string
}

function attributs(balise: string): Record<string, string> {
  const res: Record<string, string> = {}
  for (const m of balise.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) res[m[1]] = m[2]
  return res
}

/** Lit la réponse XML du service update2 de Google (`response=updatecheck`) : version publiée de chaque extension. */
export function lireUpdatecheck(xml: string): Record<string, ReponseUpdatecheck> {
  const res: Record<string, ReponseUpdatecheck> = {}
  for (const m of xml.matchAll(/<app\b([^>]*)>([\s\S]*?)<\/app>|<app\b([^>]*)\/>/g)) {
    const app = attributs(m[1] ?? m[3] ?? '')
    const id = app.appid
    if (!id || !/^[a-p]{32}$/.test(id)) continue
    const uc = /<updatecheck\b([^>]*)\/?>/.exec(m[2] ?? '')
    const a = uc ? attributs(uc[1]) : {}
    const version = a.version && /^\d+(\.\d+){0,3}$/.test(a.version) ? a.version : null
    res[id] = { version, statut: a.status ?? app.status ?? 'inconnu' }
  }
  return res
}

/** Adresse de la vérification groupée (une seule requête pour toutes les extensions installées). */
export function urlUpdatecheck(ids: string[], versionChrome: string): string {
  const x = ids.map((id) => `&x=${encodeURIComponent(`id=${id}&v=0.0.0.0&uc`)}`).join('')
  return `https://clients2.google.com/service/update2/crx?response=updatecheck&acceptformat=crx2,crx3&prodversion=${encodeURIComponent(versionChrome)}${x}`
}

// ---------- modèles Ollama ----------

/** « qwen3:8b » → chemin sur le registre d'Ollama ; null pour un modèle d'un autre registre (hf.co/…). */
export function cheminModele(nom: string): { espace: string; modele: string; etiquette: string } | null {
  const [base, etiquette = 'latest'] = nom.trim().toLowerCase().split(':')
  const parts = base.split('/')
  // jamais « . » ni « .. » : le nom sert aussi de chemin vers le manifeste installé
  const segment = (p: string): boolean => /^[\w][\w.-]*$/.test(p)
  if (parts.length > 2 || !parts.every(segment) || !segment(etiquette)) return null
  return parts.length === 2 ? { espace: parts[0], modele: parts[1], etiquette } : { espace: 'library', modele: parts[0], etiquette }
}

interface Manifeste {
  config?: { digest?: string }
  layers?: { mediaType?: string; digest?: string }[]
}
const TYPE_MANIFESTE = 'application/vnd.docker.distribution.manifest.v2+json'

function lireManifeste(texte: string | null): Manifeste | null {
  if (!texte) return null
  try {
    const m = JSON.parse(texte) as Manifeste
    return m && typeof m === 'object' ? m : null
  } catch {
    return null
  }
}

/**
 * Le modèle installé est-il le même que celui publié ?
 * 1. même manifeste (même empreinte) ; 2. les versions récentes d'Ollama gardent l'empreinte du manifeste publié parmi
 * les couches ; 3. sinon, mêmes couches (config + fichiers).
 */
export function comparerManifestes(local: string | null, shaLocal: string | null, distant: string, shaDistant: string): Fraicheur {
  if (shaLocal && shaLocal === shaDistant) return 'a-jour'
  const l = lireManifeste(local)
  const d = lireManifeste(distant)
  if (!l || !d || !Array.isArray(d.layers)) return 'inconnu'
  const couchesL = (l.layers ?? []).filter((c) => c && typeof c.digest === 'string')
  if (couchesL.some((c) => c.mediaType === TYPE_MANIFESTE && c.digest === `sha256:${shaDistant}`)) return 'a-jour'
  const signature = (m: Manifeste, couches: { mediaType?: string; digest?: string }[]): string =>
    [m.config?.digest ?? '', ...couches.filter((c) => c.mediaType !== TYPE_MANIFESTE).map((c) => c.digest ?? '').sort()].join('|')
  return signature(l, couchesL) === signature(d, d.layers) ? 'a-jour' : 'mise-a-jour'
}

// ---------- affichage ----------

/** « 9 novembre 2026 à 14:05 » */
export function dateFr(ms: number): string {
  const d = new Date(ms)
  const jour = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${jour} à ${heure}`
}

export interface TexteEtat {
  texte: string
  etat: Fraicheur
}

export function texteOllama(info: InfoOllamaMaj, installee: string | null): TexteEtat {
  const v = installee ?? info.installee
  if (!v) return { texte: '', etat: 'inconnu' }
  if (!info.derniere || !info.verifie) return { texte: `Version ${v} · pas encore vérifiée`, etat: 'inconnu' }
  if (plusRecenteQue(info.derniere, v)) return { texte: `Mise à jour disponible : ${v} → ${info.derniere}`, etat: 'mise-a-jour' }
  return { texte: `À jour (version ${v}, vérifié le ${dateFr(info.verifie)})`, etat: 'a-jour' }
}

export function texteModele(info: InfoModeleMaj | undefined): TexteEtat {
  if (!info) return { texte: 'Pas encore vérifié', etat: 'inconnu' }
  const quand = `vérifié le ${dateFr(info.verifie)}`
  if (info.etat === 'a-jour') return { texte: `À jour${info.distant ? ` (empreinte ${info.distant.slice(0, 8)})` : ''}, ${quand}`, etat: 'a-jour' }
  if (info.etat === 'mise-a-jour') return { texte: `Mise à jour disponible (${info.local?.slice(0, 8) ?? '?'} → ${info.distant?.slice(0, 8) ?? '?'}), ${quand}`, etat: 'mise-a-jour' }
  return { texte: `État inconnu, ${quand}`, etat: 'inconnu' }
}

export function texteExtension(installee: string, info: InfoExtensionMaj | undefined): TexteEtat {
  if (!info) return { texte: `Version ${installee} · pas encore vérifiée`, etat: 'inconnu' }
  if (plusRecenteQue(info.disponible, installee)) return { texte: `Mise à jour disponible : ${installee} → ${info.disponible}`, etat: 'mise-a-jour' }
  return { texte: `À jour (version ${installee}, vérifié le ${dateFr(info.verifie)})`, etat: 'a-jour' }
}

export function texteBloqueur(info: InfoBloqueurMaj): string {
  if (!info.listes) return 'Listes de filtres pas encore téléchargées (il faut une connexion à Internet).'
  return `Listes de filtres mises à jour le ${dateFr(info.listes)} (renouvelées chaque semaine).`
}

/** Ajoute une nouveauté si elle n'a jamais été signalée ; renvoie vrai si elle est nouvelle. */
export function signalerUneFois(deja: string[], cle: string): boolean {
  if (deja.includes(cle)) return false
  deja.push(cle)
  if (deja.length > 200) deja.splice(0, deja.length - 200)
  return true
}
