/* Réglages persistants : chargés au démarrage, enregistrés à chaque modification. */
import { join } from 'node:path'
import { EventEmitter } from 'node:events'
import { fusionnerReglages, migrerReglages, REGLAGES_DEFAUT, type Reglages } from '../../shared/reglages'
import { ecrireJson, lireJson } from './fichierJson'

export class MagasinReglages extends EventEmitter<{ change: [Reglages] }> {
  private valeur: Reglages
  private readonly chemin: string

  constructor(dossier: string) {
    super()
    this.chemin = join(dossier, 'reglages.json')
    this.valeur = fusionnerReglages(REGLAGES_DEFAUT, migrerReglages(lireJson(this.chemin)))
  }

  get(): Reglages {
    return this.valeur
  }

  async modifier(partiel: unknown): Promise<Reglages> {
    this.valeur = fusionnerReglages(this.valeur, partiel)
    await ecrireJson(this.chemin, this.valeur)
    this.emit('change', this.valeur)
    return this.valeur
  }
}
