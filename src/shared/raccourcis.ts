/* Raccourcis personnalisables : la liste des actions qu'on peut réattribuer, leur raccourci par défaut,
 * et l'écriture d'une combinaison de touches (« Ctrl+Maj+N »), identique dans le main et dans l'interface. */

export interface RaccourciConfigurable {
  id: string
  libelle: string
  defaut: string
}

export const RACCOURCIS_CONFIGURABLES: RaccourciConfigurable[] = [
  { id: 'nouvel-onglet', libelle: 'Nouvel onglet', defaut: 'Ctrl+T' },
  { id: 'nouvel-onglet-prive', libelle: 'Nouvel onglet privé', defaut: 'Ctrl+Maj+N' },
  { id: 'fermer-onglet', libelle: 'Fermer l’onglet', defaut: 'Ctrl+W' },
  { id: 'rouvrir-onglet', libelle: 'Rouvrir l’onglet fermé', defaut: 'Ctrl+Maj+T' },
  { id: 'rechercher-onglets', libelle: 'Chercher parmi les onglets', defaut: 'Ctrl+Maj+A' },
  { id: 'focus-adresse', libelle: 'Aller à la barre d’adresse', defaut: 'Ctrl+L' },
  { id: 'basculer-ia', libelle: 'Panneau IA', defaut: 'Ctrl+Espace' },
  { id: 'basculer-barre', libelle: 'Barre latérale', defaut: 'Ctrl+B' },
  { id: 'favori', libelle: 'Ajouter aux favoris', defaut: 'Ctrl+D' },
  { id: 'ouvrir-fichier', libelle: 'Ouvrir un fichier PDF', defaut: 'Ctrl+O' },
  { id: 'page-historique', libelle: 'Historique', defaut: 'Ctrl+H' },
  { id: 'page-favoris', libelle: 'Favoris', defaut: 'Ctrl+Maj+O' },
  { id: 'page-telechargements', libelle: 'Téléchargements', defaut: 'Ctrl+J' },
  { id: 'page-parametres', libelle: 'Paramètres', defaut: 'Ctrl+,' }
]

const NOMS: Record<string, string> = { ' ': 'Espace', Spacebar: 'Espace', Escape: 'Échap', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' }

/** Combinaison lisible d'une touche : « Ctrl+Maj+N ». Null pour une touche seule de modification (Ctrl, Maj…). */
export function combinaison(t: { key: string; code?: string; control: boolean; shift: boolean; alt: boolean }): string | null {
  if (['Control', 'Shift', 'Alt', 'Meta', 'AltGraph'].includes(t.key)) return null
  // lettres et chiffres d'après la position de la touche (AZERTY : Ctrl+1 donne « & »)
  const code = t.code ?? ''
  let k = /^Key([A-Z])$/.exec(code)?.[1] ?? /^(?:Digit|Numpad)(\d)$/.exec(code)?.[1] ?? NOMS[t.key] ?? (t.key.length === 1 ? t.key.toUpperCase() : t.key)
  if (code === 'Space') k = 'Espace'
  return [t.control && 'Ctrl', t.alt && 'Alt', t.shift && 'Maj', k].filter(Boolean).join('+')
}

/** Raccourci actuel de chaque action (personnalisé, sinon par défaut). */
export function raccourcisActuels(perso: Record<string, string>): Record<string, string> {
  return Object.fromEntries(RACCOURCIS_CONFIGURABLES.map((r) => [r.id, perso[r.id] || r.defaut]))
}

/** Une combinaison acceptable : avec Ctrl ou Alt (sinon on ne pourrait plus taper normalement), ou une touche F1…F12. */
export function combinaisonValide(c: string): boolean {
  return /^(Ctrl|Alt)\+/.test(c) || /^(Ctrl\+|Alt\+|Maj\+)*F([1-9]|1[0-2])$/.test(c)
}
