/* Rapports de plantage locaux (voir main/plantages.ts). */

export type TypePlantage = 'fermeture-inattendue' | 'interface' | 'page' | 'processus' | 'erreur'

export interface RapportPlantage {
  id: string
  date: number
  version: string
  systeme: string
  type: TypePlantage
  resume: string
  details: string
}

/** Le rapport en texte, tel qu'on le copie ou l'envoie à un ami (coupé à `max` caractères). */
export function texteRapport(r: RapportPlantage, max = 2000): string {
  const date = new Date(r.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
  const t = `Rapport de plantage se7en Browser\nVersion ${r.version} · ${r.systeme}\n${date}\n\n${r.resume}${r.details ? `\n\n${r.details}` : ''}`
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}
