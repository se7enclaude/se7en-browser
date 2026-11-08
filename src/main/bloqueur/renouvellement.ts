/* Renouvellement des listes du bloqueur, sans jamais perdre l'ancien moteur :
 * l'ancien cache reste en place (et continue de bloquer) tant que le nouveau n'est pas arrivé et enregistré.
 * Hors-ligne : on garde l'ancien, et on réessaiera plus tard. (Aucune dépendance à Electron : testé seul.) */

export const RENOUVELLEMENT_LISTES = 7 * 24 * 3600 * 1000

export interface Renouvellement<M> {
  /** Moteur actuel (lu du cache), ou null. */
  actuel: M | null
  /** Date des listes du moteur actuel, ou null si inconnue. */
  listes: number | null
  maintenant: number
  telecharger: () => Promise<M>
  /** Enregistre le nouveau moteur (fichier temporaire puis renommage : l'ancien cache n'est remplacé qu'une fois le nouveau écrit). */
  enregistrer: (m: M) => Promise<void>
  intervalle?: number
}

export interface ResultatRenouvellement<M> {
  moteur: M | null
  listes: number | null
  /** De nouvelles listes ont été téléchargées. */
  renouvele: boolean
  /** Le téléchargement a été tenté et a échoué (hors-ligne…). */
  echec: boolean
}

export function listesPerimees(listes: number | null, maintenant: number, intervalle = RENOUVELLEMENT_LISTES): boolean {
  return !listes || maintenant - listes >= intervalle || listes > maintenant
}

export async function renouvelerMoteur<M>(r: Renouvellement<M>): Promise<ResultatRenouvellement<M>> {
  if (r.actuel && !listesPerimees(r.listes, r.maintenant, r.intervalle)) return { moteur: r.actuel, listes: r.listes, renouvele: false, echec: false }
  let neuf: M
  try {
    neuf = await r.telecharger()
  } catch {
    return { moteur: r.actuel, listes: r.listes, renouvele: false, echec: true }
  }
  // un cache impossible à écrire n'empêche pas d'utiliser les nouvelles listes pendant cette session,
  // mais la date n'avance pas : on retentera au prochain passage
  const ecrit = await r.enregistrer(neuf).then(
    () => true,
    () => false
  )
  return { moteur: neuf, listes: ecrit ? r.maintenant : r.listes, renouvele: true, echec: false }
}
