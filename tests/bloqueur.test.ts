import { describe, expect, it } from 'vitest'
import { FiltersEngine, Request } from '@ghostery/adblocker'
import { estException, hoteDe } from '../src/main/bloqueur/bloqueur'

describe('exceptions par site', () => {
  it('reconnaît le site et ses sous-domaines', () => {
    expect(hoteDe('https://www.lemonde.fr/article')).toBe('lemonde.fr')
    expect(estException('lemonde.fr', ['lemonde.fr'])).toBe(true)
    expect(estException('abonnes.lemonde.fr', ['lemonde.fr'])).toBe(true)
    expect(estException('pas-lemonde.fr', ['lemonde.fr'])).toBe(false)
  })
})

describe('moteur de filtres', () => {
  it('bloque une pub et laisse passer le reste', () => {
    const moteur = FiltersEngine.parse('||pubs.exemple^\n||traqueur.exemple^$third-party')
    const r = (url: string, source = 'https://site.fr/') => moteur.match(Request.fromRawDetails({ url, sourceUrl: source, type: 'script' })).match
    expect(r('https://pubs.exemple/banniere.js')).toBe(true)
    expect(r('https://traqueur.exemple/t.js')).toBe(true)
    expect(r('https://traqueur.exemple/t.js', 'https://traqueur.exemple/')).toBe(false) // même site : pas tiers
    expect(r('https://site.fr/app.js')).toBe(false)
  })
})
