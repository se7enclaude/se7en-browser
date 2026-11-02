/* Mise à jour automatique du navigateur : types partagés et comparaison de versions. */

export type PhaseMiseAJour = 'aucune' | 'recherche' | 'telechargement' | 'prete' | 'erreur'

export interface EtatMiseAJour {
  phase: PhaseMiseAJour
  /** Version installée. */
  actuelle: string
  /** Nouvelle version trouvée. */
  version?: string
  notes?: string
  /** Téléchargement : de 0 à 1. */
  progression?: number
  erreur?: string
  /** Date de la dernière vérification. */
  verifiee?: number
}

/** « 1.10.0 » est plus récente que « 1.9.2 » (on ignore un éventuel « v » et ce qui suit un tiret). */
export function plusRecente(candidate: string, actuelle: string): boolean {
  const parties = (v: string): number[] =>
    v
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((n) => Number.parseInt(n, 10) || 0)
  const a = parties(candidate)
  const b = parties(actuelle)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0)
    if (d !== 0) return d > 0
  }
  return false
}
