/* Aide à l'écriture : réécrire le texte d'un champ de n'importe quel site (clic droit dans le champ).
 * L'IA propose ; le texte du champ n'est remplacé qu'après un clic de l'utilisateur sur « Remplacer ». */

export interface ActionEcriture {
  id: string
  libelle: string
  consigne: string
}

export const ACTIONS_ECRITURE: readonly ActionEcriture[] = [
  { id: 'corriger', libelle: 'Corriger les fautes', consigne: "Corrige l'orthographe, la grammaire et la ponctuation, sans changer le sens, le ton ni la langue." },
  { id: 'ameliorer', libelle: 'Améliorer le style', consigne: 'Rends ce texte plus clair et plus fluide, sans changer le sens, le ton ni la langue.' },
  { id: 'raccourcir', libelle: 'Raccourcir', consigne: "Raccourcis ce texte d'environ moitié en gardant l'essentiel, dans la même langue." },
  { id: 'developper', libelle: 'Développer', consigne: 'Développe ce texte un peu plus (environ deux fois plus long), dans la même langue et le même ton.' },
  { id: 'formel', libelle: 'Ton plus formel', consigne: 'Réécris ce texte sur un ton plus formel et professionnel, dans la même langue.' },
  { id: 'amical', libelle: 'Ton plus amical', consigne: 'Réécris ce texte sur un ton plus chaleureux et décontracté, dans la même langue.' },
  { id: 'anglais', libelle: 'Traduire en anglais', consigne: 'Traduis ce texte en anglais naturel.' },
  { id: 'francais', libelle: 'Traduire en français', consigne: 'Traduis ce texte en français naturel.' }
]

export interface EtatEcriture {
  id: string
  idOnglet: number
  action: string
  phase: 'ecriture' | 'pret' | 'erreur'
  original: string
  proposition: string
  erreur?: string
}
