/* Recherche approfondie en local : l'IA prépare des recherches, lit plusieurs sources (onglets ouverts, Wikipédia,
 * recherche web par l'API officielle de Brave si tu as mis ta clé, liens suivis), en tire les faits utiles, puis écrit
 * un rapport où chaque affirmation renvoie à sa source. Lecture et rédaction sur ton PC. */

export type EtapeRecherche = 'plan' | 'sources' | 'lecture' | 'notes' | 'synthese' | 'fini' | 'erreur' | 'arretee'

export interface SourceRecherche {
  /** Numéro cité dans le rapport : [1], [2]… */
  n: number
  url: string
  titre: string
  origine: 'onglet' | 'wikipedia' | 'web' | 'lien'
  /** Faits utiles tirés de la source (vide : rien de pertinent). */
  notes: string
  erreur?: string
}

export interface Recherche {
  id: string
  question: string
  date: number
  etape: EtapeRecherche
  /** Journal lisible de ce qui se passe (« Lecture de Wikipédia : OLED »). */
  journal: string[]
  sources: SourceRecherche[]
  rapport: string
  erreur?: string
  /** Durée totale, en secondes, une fois fini. */
  duree?: number
}

export const MAX_SOURCES = 10
export const MAX_RECHERCHES = 20

export const LIBELLES_ETAPES: Record<EtapeRecherche, string> = {
  plan: 'Préparation des recherches',
  sources: 'Recherche des sources',
  lecture: 'Lecture des pages',
  notes: 'Extraction des faits utiles',
  synthese: 'Rédaction du rapport',
  fini: 'Terminé',
  erreur: 'Erreur',
  arretee: 'Arrêtée'
}

/** « /recherche … », « recherche approfondie sur … », « fais une recherche approfondie : … » → la question, ou null. */
export function questionDeRecherche(texte: string): string | null {
  const m = /^\s*(?:\/recherche|(?:fais(?:[- ]moi)? une |lance une )?recherche approfondie(?: sur| :|:)?)\s+([\s\S]{3,})$/i.exec(texte)
  return m ? m[1].trim() : null
}

/** Mots significatifs d'un texte (pour juger si un onglet parle du sujet). */
export function motsCles(texte: string): Set<string> {
  const vides = new Set(['les', 'des', 'une', 'pour', 'avec', 'dans', 'est', 'que', 'qui', 'sur', 'pas', 'plus', 'par', 'mon', 'mes', 'quel', 'quelle', 'quels', 'quelles', 'comment', 'pourquoi', 'entre', 'and', 'the', 'for', 'what', 'how', 'meilleur', 'meilleure'])
  return new Set(
    texte
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((m) => m.length > 2 && !vides.has(m))
  )
}

/** Proportion des mots de la question présents dans un titre (0 à 1). */
export function pertinence(question: string, titre: string): number {
  const q = motsCles(question)
  if (!q.size) return 0
  const t = motsCles(titre)
  let n = 0
  for (const m of q) if (t.has(m)) n++
  return n / q.size
}

/** Ajoute des sources sans doublon d'adresse (ni plus d'une page par site pour les liens suivis), numérotées dans l'ordre. */
export function ajouterSources(existantes: SourceRecherche[], nouvelles: Omit<SourceRecherche, 'n' | 'notes'>[]): SourceRecherche[] {
  const res = [...existantes]
  const urls = new Set(res.map((s) => s.url.replace(/#.*$/, '')))
  for (const s of nouvelles) {
    if (res.length >= MAX_SOURCES) break
    const u = s.url.replace(/#.*$/, '')
    if (urls.has(u)) continue
    urls.add(u)
    res.push({ ...s, n: res.length + 1, notes: '' })
  }
  return res
}

/** Garde dans le rapport seulement les citations [n] qui existent (une IA peut inventer [12]). */
export function nettoyerCitations(rapport: string, sources: SourceRecherche[]): string {
  const valides = new Set(sources.filter((s) => s.notes).map((s) => s.n))
  return rapport.replace(/\[(\d{1,2})\]/g, (tout, n) => (valides.has(Number(n)) ? tout : ''))
}

/** Lien qui mérite d'être suivi : pas une autre langue de Wikipédia, ni une page technique (aide, catégorie, connexion, don…). */
export function lienUtile(url: string): boolean {
  try {
    const u = new URL(url)
    const wiki = /^([a-z]{2,3}(?:-[a-z]+)?)(?:\.m)?\.(wikipedia|wiktionary|wikiquote|wikibooks)\.org$/.exec(u.hostname)
    if (wiki && !['fr', 'en'].includes(wiki[1])) return false
    if (/(^|\.)(wikidata|wikimedia|mediawiki|wikimediafoundation)\.org$/.test(u.hostname)) return false
    if (/\/w\/index\.php/.test(u.pathname)) return false
    if (/\/wiki\/(Sp[ée]cial|Special|Aide|Help|Wikip[ée]dia|Fichier|File|Cat[ée]gorie|Category|Portail|Portal|Discussion|Talk|Mod[eè]le|Template|Utilisateur|User)(:|%3A)/i.test(u.pathname)) return false
    if (/login|signin|signup|register|connexion|inscription|donate|don\b|account|compte|privacy|cookies|cgu|mentions-legales/i.test(u.pathname)) return false
    return true
  } catch {
    return false
  }
}
