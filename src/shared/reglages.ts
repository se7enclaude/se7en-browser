/* Réglages de l'utilisateur : types et valeurs par défaut, partagés entre le main et l'interface. */

export type Theme = 'clair' | 'sombre' | 'auto'
export type Disposition = 'haut' | 'gauche' | 'les-deux'
/** Teinte du verre (thèmes de couleur). */
export type Teinte = 'argent' | 'soleil' | 'ocean' | 'rose' | 'menthe' | 'lavande'

export interface Reglages {
  /** Version du format, pour migrer plus tard sans perdre les réglages. */
  version: 1
  theme: Theme
  teinte: Teinte
  disposition: Disposition
  /** Faux tant que l'écran d'accueil du premier lancement n'a pas été validé. */
  accueilTermine: boolean
  moteurRecherche: string
  modeleTexte: string
  modeleVision: string
}

export const REGLAGES_DEFAUT: Reglages = {
  version: 1,
  theme: 'auto',
  teinte: 'argent',
  disposition: 'les-deux',
  accueilTermine: false,
  moteurRecherche: 'https://www.google.com/search?q=%s',
  modeleTexte: 'qwen3:8b',
  modeleVision: 'qwen2.5vl:7b'
}

const THEMES: readonly Theme[] = ['clair', 'sombre', 'auto']
const DISPOSITIONS: readonly Disposition[] = ['haut', 'gauche', 'les-deux']
export const TEINTES: readonly Teinte[] = ['argent', 'soleil', 'ocean', 'rose', 'menthe', 'lavande']

/**
 * Fusionne une valeur inconnue (fichier sur disque, message de l'interface) avec les réglages actuels.
 * Chaque champ est vérifié : un champ invalide est ignoré, jamais propagé.
 */
export function fusionnerReglages(base: Reglages, brut: unknown): Reglages {
  const r: Reglages = { ...base }
  if (!brut || typeof brut !== 'object') return r
  const o = brut as Record<string, unknown>
  if (THEMES.includes(o.theme as Theme)) r.theme = o.theme as Theme
  if (TEINTES.includes(o.teinte as Teinte)) r.teinte = o.teinte as Teinte
  if (DISPOSITIONS.includes(o.disposition as Disposition)) r.disposition = o.disposition as Disposition
  if (typeof o.accueilTermine === 'boolean') r.accueilTermine = o.accueilTermine
  if (typeof o.moteurRecherche === 'string' && /^https:\/\/[^\s]+%s/.test(o.moteurRecherche)) r.moteurRecherche = o.moteurRecherche
  if (typeof o.modeleTexte === 'string' && /^[\w.:\-/]{1,100}$/.test(o.modeleTexte)) r.modeleTexte = o.modeleTexte
  if (typeof o.modeleVision === 'string' && /^[\w.:\-/]{1,100}$/.test(o.modeleVision)) r.modeleVision = o.modeleVision
  return r
}
