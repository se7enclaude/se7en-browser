/* Réglages de l'utilisateur : types et valeurs par défaut, partagés entre le main et l'interface. */
import { adresseServeur } from './social'

export type Theme = 'clair' | 'sombre' | 'auto'
export type Disposition = 'haut' | 'gauche' | 'les-deux'
/** Teinte du verre (thèmes de couleur). */
/** Activer l'IA locale à l'ouverture du navigateur : demander à chaque fois, toujours, ou jamais. */
export type DemarrageIA = 'demander' | 'toujours' | 'jamais'
export type Teinte = 'argent' | 'soleil' | 'ocean' | 'rose' | 'menthe' | 'lavande'

export interface Reglages {
  /** Version du format, pour migrer plus tard sans perdre les réglages. */
  version: 2
  theme: Theme
  teinte: Teinte
  disposition: Disposition
  /** Barre latérale affichée (Ctrl+B). */
  barreLaterale: boolean
  /** Faux tant que l'écran d'accueil du premier lancement n'a pas été validé. */
  accueilTermine: boolean
  moteurRecherche: string
  modeleTexte: string
  modeleVision: string
  iaDemarrage: DemarrageIA
  /** Bloqueur de pubs et de traqueurs. */
  bloqueur: boolean
  /** Sites où le bloqueur est désactivé (noms d'hôte sans www). */
  bloqueurExceptions: string[]
  /** L'IA se souvient de ce qu'on lui demande de retenir. */
  memoire: boolean
  /** Mémoire de navigation : le texte des pages visitées, gardé 30 jours sur ce PC pour que l'IA les retrouve. */
  memoireNavigation: boolean
  /** Le navigateur se met à jour tout seul (téléchargé en arrière-plan, installé à la fermeture). */
  miseAJourAuto: boolean
  /** Les modèles Qwen de l'IA locale sont remis à jour une fois par semaine. */
  modelesAuto: boolean
  /** Adresse du serveur se7en social (profils et amis) ; vide = le serveur officiel. */
  serveurSocial: string
}

export const REGLAGES_DEFAUT: Reglages = {
  version: 2,
  theme: 'auto',
  teinte: 'argent',
  disposition: 'les-deux',
  barreLaterale: true,
  accueilTermine: false,
  moteurRecherche: 'https://www.google.com/search?q=%s',
  modeleTexte: 'qwen3:8b',
  modeleVision: 'qwen3-vl:8b',
  iaDemarrage: 'demander',
  bloqueur: true,
  bloqueurExceptions: [],
  memoire: true,
  memoireNavigation: true,
  miseAJourAuto: true,
  modelesAuto: true,
  serveurSocial: ''
}

const THEMES: readonly Theme[] = ['clair', 'sombre', 'auto']
const DISPOSITIONS: readonly Disposition[] = ['haut', 'gauche', 'les-deux']
/** Moteurs proposés dans les paramètres. */
export const MOTEURS = [
  { nom: 'Google', url: 'https://www.google.com/search?q=%s' },
  { nom: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
  { nom: 'Bing', url: 'https://www.bing.com/search?q=%s' },
  { nom: 'Qwant', url: 'https://www.qwant.com/?q=%s' },
  { nom: 'Ecosia', url: 'https://www.ecosia.org/search?q=%s' }
] as const

export const TEINTES: readonly Teinte[] = ['argent', 'soleil', 'ocean', 'rose', 'menthe', 'lavande']

/**
 * Fusionne une valeur inconnue (fichier sur disque, message de l'interface) avec les réglages actuels.
 * Chaque champ est vérifié : un champ invalide est ignoré, jamais propagé.
 */
/**
 * Met à jour un fichier de réglages d'une ancienne version (lu sur le disque, avant fusion).
 * v1 → v2 : le modèle vision par défaut passe de Qwen2.5-VL à Qwen3-VL (sauf s'il avait été changé).
 */
export function migrerReglages(brut: unknown): unknown {
  if (!brut || typeof brut !== 'object') return brut
  const o = { ...(brut as Record<string, unknown>) }
  const version = typeof o.version === 'number' ? o.version : 1
  if (version < 2 && o.modeleVision === 'qwen2.5vl:7b') delete o.modeleVision
  o.version = 2
  return o
}

export function fusionnerReglages(base: Reglages, brut: unknown): Reglages {
  const r: Reglages = { ...base }
  if (!brut || typeof brut !== 'object') return r
  const o = brut as Record<string, unknown>
  if (THEMES.includes(o.theme as Theme)) r.theme = o.theme as Theme
  if (TEINTES.includes(o.teinte as Teinte)) r.teinte = o.teinte as Teinte
  if (DISPOSITIONS.includes(o.disposition as Disposition)) r.disposition = o.disposition as Disposition
  if (typeof o.barreLaterale === 'boolean') r.barreLaterale = o.barreLaterale
  if (typeof o.accueilTermine === 'boolean') r.accueilTermine = o.accueilTermine
  if (typeof o.moteurRecherche === 'string' && /^https:\/\/[^\s]+%s/.test(o.moteurRecherche)) r.moteurRecherche = o.moteurRecherche
  if (typeof o.modeleTexte === 'string' && /^[\w.:\-/]{1,100}$/.test(o.modeleTexte)) r.modeleTexte = o.modeleTexte
  if (typeof o.bloqueur === 'boolean') r.bloqueur = o.bloqueur
  if (typeof o.memoire === 'boolean') r.memoire = o.memoire
  if (typeof o.memoireNavigation === 'boolean') r.memoireNavigation = o.memoireNavigation
  if (typeof o.miseAJourAuto === 'boolean') r.miseAJourAuto = o.miseAJourAuto
  if (typeof o.modelesAuto === 'boolean') r.modelesAuto = o.modelesAuto
  if (typeof o.serveurSocial === 'string') {
    const s = o.serveurSocial.trim()
    const propre = s ? adresseServeur(s) : ''
    if (propre !== null) r.serveurSocial = propre
  }
  if (Array.isArray(o.bloqueurExceptions))
    r.bloqueurExceptions = [...new Set(o.bloqueurExceptions.filter((h): h is string => typeof h === 'string' && /^[a-z0-9.-]{1,253}$/.test(h)))].slice(0, 500)
  if (['demander', 'toujours', 'jamais'].includes(o.iaDemarrage as string)) r.iaDemarrage = o.iaDemarrage as DemarrageIA
  if (typeof o.modeleVision === 'string' && /^[\w.:\-/]{1,100}$/.test(o.modeleVision)) r.modeleVision = o.modeleVision
  return r
}
