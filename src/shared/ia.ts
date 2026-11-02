/* IA locale (Ollama) : état partagé entre le main et l'interface. */

export type PhaseOllama =
  /** on regarde si Ollama est là */
  | 'verification'
  /** Ollama n'est pas installé */
  | 'absent'
  /** installé mais pas lancé */
  | 'arrete'
  /** le service répond sur 127.0.0.1:11434 */
  | 'pret'

export interface TacheOllama {
  type: 'installeur' | 'installation' | 'demarrage' | 'modele'
  /** Nom du modèle téléchargé, ou du fichier. */
  nom: string
  recus: number
  /** 0 si la taille n'est pas encore connue. */
  total: number
}

export interface EtatOllama {
  phase: PhaseOllama
  version: string | null
  /** Modèles déjà téléchargés (noms complets, ex. « qwen3:8b »). */
  modeles: string[]
  tache: TacheOllama | null
  erreur: string | null
  /** Vrai si c'est le navigateur qui a lancé Ollama (il l'arrêtera en se fermant). */
  lanceParNavigateur: boolean
}

/** Taille approximative des modèles proposés, pour prévenir avant le téléchargement. */
export const TAILLES_CONNUES: Record<string, number> = {
  'qwen3:8b': 5.2e9,
  'qwen3:4b': 2.5e9,
  'qwen3:14b': 9.3e9,
  'qwen3-vl:8b': 6.1e9,
  'qwen3-vl:4b': 3.3e9,
  'qwen2.5vl:7b': 6.0e9
}

/** « qwen3 » et « qwen3:latest » désignent le même modèle. */
export function nomComplet(nom: string): string {
  return nom.includes(':') ? nom : `${nom}:latest`
}

export function modelePresent(nom: string, installes: string[]): boolean {
  const cible = nomComplet(nom.trim().toLowerCase())
  return installes.some((m) => nomComplet(m.toLowerCase()) === cible)
}

export const RE_NOM_MODELE = /^[\w.:\-/]{1,100}$/
