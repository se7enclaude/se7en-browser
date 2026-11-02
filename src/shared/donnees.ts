/* Historique, favoris et téléchargements : types partagés entre le main et l'interface. */

export interface EntreeHistorique {
  id: string
  url: string
  titre: string
  /** Date de la visite (ms depuis 1970). */
  date: number
}

export interface SitePopulaire {
  url: string
  titre: string
  visites: number
}

export interface Favori {
  id: string
  url: string
  titre: string
  favicon: string | null
  date: number
}

export type EtatTelechargement = 'en-cours' | 'en-pause' | 'termine' | 'annule' | 'interrompu'

export interface Telechargement {
  id: string
  nom: string
  url: string
  chemin: string
  recus: number
  /** 0 si la taille n'est pas connue. */
  total: number
  etat: EtatTelechargement
  date: number
}

export type ActionTelechargement = 'annuler' | 'pause' | 'reprendre' | 'ouvrir' | 'montrer' | 'retirer'
