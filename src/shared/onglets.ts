/* État des onglets, tel que l'interface l'affiche. Le main en est la seule source. */
import type { CibleSocial } from './social'

export interface EtatOnglet {
  id: number
  /** Vide pour un « Nouvel onglet » ; « se7en://… » pour une page interne (paramètres…). */
  url: string
  titre: string
  /** Icône du site en data: URL (l'interface ne charge rien depuis Internet). */
  favicon: string | null
  chargement: boolean
  peutReculer: boolean
  peutAvancer: boolean
  /** La page a planté : l'interface propose de la recharger. */
  plantee: boolean
  /** Onglet prioritaire : épinglé dans la barre latérale et gardé d'une session à l'autre. */
  prioritaire: boolean
  /** Onglet prioritaire pas encore chargé (ou mis en veille) : il se charge quand on l'ouvre. */
  endormi: boolean
  /** Identifiant du PDF affiché par la visionneuse (url est alors l'adresse du PDF lui-même), ou null. */
  pdf: string | null
  /** Publicités et traqueurs bloqués sur la page actuelle. */
  bloques: number
  /** Groupe d'onglets (rangement par l'IA), ou null. */
  groupe: string | null
  /** Alerte anti-phishing sur la page actuelle (texte à montrer), ou null. */
  phishing: string | null
  /** Traduction de la page par l'IA locale (en cours, faite, ou en erreur), ou null. */
  traduction: EtatTraduction
}

export const COULEURS_GROUPES = ['bleu', 'vert', 'orange', 'rose', 'violet', 'cyan', 'jaune', 'rouge'] as const
export type CouleurGroupe = (typeof COULEURS_GROUPES)[number]

export type EtatTraduction =
  /** `fond` : ce qui est à l'écran est traduit, le reste de la page continue en arrière-plan. */
  | { etat: 'en-cours'; progression: number; fond?: boolean } | { etat: 'traduite' } | { etat: 'erreur'; message: string } | null

export interface GroupeOnglets {
  id: string
  nom: string
  couleur: CouleurGroupe
  /** Groupe replié : ses onglets sont cachés dans la barre. */
  replie: boolean
}

/** Vue partagée : deux onglets côte à côte. */
export interface Split {
  gauche: number
  droite: number
  /** Part de la largeur pour le volet de gauche (0,2 à 0,8). */
  ratio: number
}

export interface EtatOnglets {
  onglets: EtatOnglet[]
  actifId: number | null
  split: Split | null
  groupes: GroupeOnglets[]
}

/** Ce qu'on garde d'un onglet prioritaire entre deux sessions. */
export interface OngletPrioritaireSauve {
  url: string
  titre: string
  favicon: string | null
}

/** Zone (en pixels CSS de l'interface) où la page de l'onglet actif doit s'afficher. */
export interface Zone {
  x: number
  y: number
  width: number
  height: number
}

/** Zone d'un onglet visible (un seul, ou deux en vue partagée). */
export interface ZoneOnglet {
  id: number
  zone: Zone
}

/** Commandes que le main envoie à l'interface (ex. raccourci Ctrl+L capté dans une page). */
/** Image figée d'une page (data: URL), le temps qu'une animation de l'interface passe. */
export interface PageFigee {
  id: number
  image: string
}

export type CommandeUi =
  /** Changement d'onglet : l'ancienne page s'efface en fondu sur la nouvelle (`depart` null : fondu annulé). */
  /** Clic sur la notification d'un message : ouvrir la conversation avec cet ami. */
  | { type: 'ouvrir-conversation'; cible: CibleSocial }
  | { type: 'transition-onglet'; depart: string | null; arrivee: string | null; duree: number }
  | { type: 'focus-adresse' }
  | { type: 'basculer-ia' }
  /** Ctrl+Maj+A : chercher parmi les onglets ouverts. */
  | { type: 'rechercher-onglets' }
  /** Clic droit › IA sur une sélection : la question part dans le panneau, avec la page (et sa sélection) jointe. */
  | { type: 'demander-ia'; texte: string; avecPage: boolean }
  /** « Demander sur une zone de l'écran » : capture de l'onglet actif, à recadrer par l'utilisateur. */
  | { type: 'zone'; idCapture: string; image: string }
