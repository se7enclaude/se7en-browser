/* Onglets prioritaires sauvegardés d'une session à l'autre (prioritaires.json). */
import { join } from 'node:path'
import type { OngletPrioritaireSauve } from '../../shared/onglets'
import { ecrireJson, lireJson } from './fichierJson'

const MAX = 100

/** Ne garde que des entrées bien formées (le fichier a pu être modifié à la main). */
export function nettoyerPrioritaires(brut: unknown): OngletPrioritaireSauve[] {
  if (!Array.isArray(brut)) return []
  return brut
    .filter(
      (e): e is OngletPrioritaireSauve =>
        !!e && typeof e === 'object' && typeof e.url === 'string' && e.url.length <= 8192 && typeof e.titre === 'string'
    )
    .slice(0, MAX)
    .map((e) => ({
      url: e.url,
      titre: e.titre.slice(0, 500),
      favicon: typeof e.favicon === 'string' && e.favicon.startsWith('data:image/') ? e.favicon : null
    }))
}

export class MagasinPrioritaires {
  private readonly chemin: string
  constructor(dossier: string) {
    this.chemin = join(dossier, 'prioritaires.json')
  }
  lire(): OngletPrioritaireSauve[] {
    return nettoyerPrioritaires(lireJson(this.chemin))
  }
  sauver(liste: OngletPrioritaireSauve[]): void {
    void ecrireJson(this.chemin, nettoyerPrioritaires(liste))
  }
}
