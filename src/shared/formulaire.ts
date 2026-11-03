/* Remplissage des formulaires PDF : types partagés entre le main et l'interface. */

export interface ChampFormulaire {
  /** Nom technique du champ dans le PDF. */
  nom: string
  /** Texte écrit à côté du champ (ou son info-bulle) : ce que l'utilisateur lit. */
  libelle: string
  page: number
  valeurActuelle: string
  maxLongueur: number | null
}

export interface Proposition {
  nom: string
  libelle: string
  page: number
  /** Clés du coffre à mettre dans ce champ (vide : rien à proposer). */
  cles: string[]
  /** D'où vient l'association : l'IA, le libellé (sans IA), ou rien. */
  source: 'ia' | 'libelle' | 'aucune'
  /** Valeur proposée, calculée à partir du coffre. Modifiable dans l'aperçu. */
  valeur: string
  maxLongueur: number | null
}

export interface AnalyseFormulaire {
  nomDocument: string
  propositions: Proposition[]
  /** Champs que l'on ne remplit pas automatiquement (cases à cocher, listes, signatures…). */
  autres: number
  iaUtilisee: boolean
  coffreVide: boolean
}

export interface ValeurARemplir {
  nom: string
  valeur: string
}

export interface ResultatRemplissage {
  rempli: number
  nomDocument: string
}

/** Formulaire d'une page web : champs relevés et valeurs proposées depuis le coffre (rien n'est encore écrit). */
export interface ChampWebPropose {
  /** Identifiant du champ dans la page (f0, f1…). */
  nom: string
  libelle: string
  cles: string[]
  source: 'autocomplete' | 'libelle' | 'ia' | 'aucune'
  valeur: string
  valeurActuelle: string
}

export interface AnalyseFormulaireWeb {
  champs: ChampWebPropose[]
  iaUtilisee: boolean
  coffreVide: boolean
}
