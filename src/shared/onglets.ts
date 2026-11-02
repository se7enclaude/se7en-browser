/* État des onglets, tel que l'interface l'affiche. Le main en est la seule source. */

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
}

export const COULEURS_GROUPES = ['bleu', 'vert', 'orange', 'rose', 'violet', 'cyan', 'jaune', 'rouge'] as const
export type CouleurGroupe = (typeof COULEURS_GROUPES)[number]

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
export type CommandeUi = { type: 'focus-adresse' } | { type: 'basculer-ia' }
