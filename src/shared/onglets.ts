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
}

export interface EtatOnglets {
  onglets: EtatOnglet[]
  actifId: number | null
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

/** Commandes que le main envoie à l'interface (ex. raccourci Ctrl+L capté dans une page). */
export type CommandeUi = { type: 'focus-adresse' }
