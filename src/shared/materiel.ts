/* Le bon modèle selon le PC : à partir de la mémoire vive et de la carte graphique, on propose le trio de modèles
 * (texte, vision, rapide) le plus capable qui tourne vite sur ce PC. Logique pure, testée. */

export interface Materiel {
  /** Mémoire vive, en Go. */
  ramGo: number
  /** Cœurs logiques du processeur. */
  coeurs: number
  /** Nom de la carte graphique principale (la plus grosse mémoire vidéo), ou null si aucune n'est détectée. */
  gpu: string | null
  /** Mémoire vidéo dédiée de cette carte, en Go (0 si carte intégrée ou inconnue). */
  vramGo: number
}

export type NiveauPc = 'tres-puissant' | 'puissant' | 'standard' | 'modeste' | 'tres-modeste'

export interface Recommandation {
  niveau: NiveauPc
  /** Libellé lisible du niveau (« PC puissant »). */
  titre: string
  /** Pourquoi ce choix, en une phrase. */
  raison: string
  texte: string
  /** null : pas de modèle vision conseillé (trop lourd pour ce PC). */
  vision: string | null
  rapide: string
}

const NIVEAUX: Record<NiveauPc, Omit<Recommandation, 'raison' | 'niveau'>> = {
  'tres-puissant': { titre: 'PC très puissant', texte: 'qwen3:30b', vision: 'qwen3-vl:8b', rapide: 'qwen3:4b' },
  puissant: { titre: 'PC puissant', texte: 'qwen3:14b', vision: 'qwen3-vl:8b', rapide: 'qwen3:1.7b' },
  standard: { titre: 'PC standard', texte: 'qwen3:8b', vision: 'qwen3-vl:8b', rapide: 'qwen3:1.7b' },
  modeste: { titre: 'PC modeste', texte: 'qwen3:4b', vision: 'qwen3-vl:4b', rapide: 'qwen3:1.7b' },
  'tres-modeste': { titre: 'PC très modeste', texte: 'qwen3:1.7b', vision: null, rapide: 'qwen3:0.6b' }
}

/** Les modèles qui tiennent dans la mémoire vidéo tournent bien plus vite : c'est elle qui décide d'abord. */
export function recommander(m: Materiel): Recommandation {
  const go = (n: number): string => `${Math.round(n)} Go`
  const carte = m.gpu && m.vramGo > 0 ? `${m.gpu} (${go(m.vramGo)} de mémoire vidéo)` : null
  let niveau: NiveauPc
  let raison: string
  if (m.vramGo >= 20 && m.ramGo >= 32) {
    niveau = 'tres-puissant'
    raison = `${carte} et ${go(m.ramGo)} de mémoire : le gros modèle Qwen3 30B (MoE, rapide) tient en entier dans la carte graphique.`
  } else if (m.vramGo >= 11 && m.ramGo >= 16) {
    niveau = 'puissant'
    raison = `${carte} : Qwen3 14B, nettement plus fin que le 8B, tient dans la carte graphique.`
  } else if (m.vramGo >= 6 || (m.ramGo >= 16 && m.coeurs >= 8)) {
    niveau = 'standard'
    raison = carte ? `${carte} : Qwen3 8B tourne vite.` : `${go(m.ramGo)} de mémoire et ${m.coeurs} cœurs : Qwen3 8B tourne correctement sur le processeur.`
  } else if (m.ramGo >= 8) {
    niveau = 'modeste'
    raison = `${go(m.ramGo)} de mémoire${carte ? ` et ${carte}` : ', sans carte graphique dédiée'} : Qwen3 4B reste fluide.`
  } else {
    niveau = 'tres-modeste'
    raison = `Seulement ${go(m.ramGo)} de mémoire : un petit modèle évite de ralentir tout le PC.`
  }
  return { niveau, raison, ...NIVEAUX[niveau] }
}

/** Taille approximative des modèles qu'on peut recommander (en octets). */
export const TAILLES_RECOMMANDES: Record<string, number> = {
  'qwen3:30b': 19e9,
  'qwen3:14b': 9.3e9,
  'qwen3:8b': 5.2e9,
  'qwen3:4b': 2.5e9,
  'qwen3:1.7b': 1.4e9,
  'qwen3:0.6b': 0.52e9,
  'qwen3-vl:8b': 6.1e9,
  'qwen3-vl:4b': 3.3e9
}

/** Verdict d'un test de vitesse (jetons générés par seconde). */
export function verdictVitesse(jetonsParSeconde: number): { niveau: 'rapide' | 'correct' | 'lent'; texte: string } {
  const v = Math.round(jetonsParSeconde)
  if (jetonsParSeconde >= 25) return { niveau: 'rapide', texte: `${v} mots/s environ : réponses quasi instantanées.` }
  if (jetonsParSeconde >= 8) return { niveau: 'correct', texte: `${v} mots/s environ : confortable pour lire en même temps.` }
  return { niveau: 'lent', texte: `${v} mots/s environ : lent. Un modèle plus petit serait plus agréable.` }
}

/** Lit une valeur dans chaque sous-clé des cartes graphiques : { « 0000 » → valeur }. */
export function analyserReg(sortie: string, valeur: string): Map<string, string> {
  const res = new Map<string, string>()
  let cle = ''
  for (const ligne of sortie.split(/\r?\n/)) {
    const k = /\\(\d{4})\s*$/.exec(ligne)
    if (k) cle = k[1]
    const v = new RegExp(`^\\s+${valeur.replace(/\./g, '\\.')}\\s+REG_\\w+\\s+(.+?)\\s*$`).exec(ligne)
    if (v && cle) res.set(cle, v[1])
  }
  return res
}
