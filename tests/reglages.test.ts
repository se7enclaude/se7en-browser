import { describe, expect, it } from 'vitest'
import { fusionnerReglages, migrerReglages, REGLAGES_DEFAUT } from '../src/shared/reglages'

describe('fusionnerReglages', () => {
  it('garde les valeurs par défaut quand le fichier est absent ou illisible', () => {
    expect(fusionnerReglages(REGLAGES_DEFAUT, undefined)).toEqual(REGLAGES_DEFAUT)
    expect(fusionnerReglages(REGLAGES_DEFAUT, 'nimporte quoi')).toEqual(REGLAGES_DEFAUT)
  })

  it('applique les champs valides', () => {
    const r = fusionnerReglages(REGLAGES_DEFAUT, { theme: 'sombre', teinte: 'ocean', disposition: 'gauche', accueilTermine: true })
    expect(r).toMatchObject({ theme: 'sombre', teinte: 'ocean', disposition: 'gauche', accueilTermine: true })
  })

  it('ignore les champs invalides ou inconnus', () => {
    const r = fusionnerReglages(REGLAGES_DEFAUT, {
      theme: 'violet',
      teinte: 42,
      moteurRecherche: 'javascript:alert(1)%s',
      modeleTexte: 'qwen; rm -rf /',
      pirate: true
    })
    expect(r).toEqual(REGLAGES_DEFAUT)
  })

  it("n'accepte qu'un moteur de recherche https avec %s", () => {
    expect(fusionnerReglages(REGLAGES_DEFAUT, { moteurRecherche: 'https://duckduckgo.com/?q=%s' }).moteurRecherche).toBe(
      'https://duckduckgo.com/?q=%s'
    )
    expect(fusionnerReglages(REGLAGES_DEFAUT, { moteurRecherche: 'http://exemple.com/?q=%s' }).moteurRecherche).toBe(
      REGLAGES_DEFAUT.moteurRecherche
    )
  })
})

describe('migrerReglages', () => {
  it("remplace l'ancien modèle vision par défaut des réglages v1", () => {
    const r = fusionnerReglages(REGLAGES_DEFAUT, migrerReglages({ version: 1, modeleVision: 'qwen2.5vl:7b', theme: 'sombre' }))
    expect(r.modeleVision).toBe('qwen3-vl:8b')
    expect(r.theme).toBe('sombre')
  })

  it('garde un modèle choisi par l’utilisateur', () => {
    expect(fusionnerReglages(REGLAGES_DEFAUT, migrerReglages({ version: 1, modeleVision: 'llava:13b' })).modeleVision).toBe('llava:13b')
    expect(fusionnerReglages(REGLAGES_DEFAUT, migrerReglages({ version: 2, modeleVision: 'qwen2.5vl:7b' })).modeleVision).toBe('qwen2.5vl:7b')
  })
})
