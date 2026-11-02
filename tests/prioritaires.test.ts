import { describe, expect, it } from 'vitest'
import { nettoyerPrioritaires } from '../src/main/stockage/prioritaires'

describe('nettoyerPrioritaires', () => {
  it('rejette un fichier illisible', () => {
    expect(nettoyerPrioritaires(undefined)).toEqual([])
    expect(nettoyerPrioritaires({ url: 'https://a.fr' })).toEqual([])
  })

  it('garde les entrées valides et filtre les icônes non-image', () => {
    expect(
      nettoyerPrioritaires([
        { url: 'https://a.fr/', titre: 'A', favicon: 'data:image/png;base64,AA' },
        { url: 'https://b.fr/', titre: 'B', favicon: 'https://pirate.example/x.png' },
        { url: 42, titre: 'C' },
        null
      ])
    ).toEqual([
      { url: 'https://a.fr/', titre: 'A', favicon: 'data:image/png;base64,AA' },
      { url: 'https://b.fr/', titre: 'B', favicon: null }
    ])
  })
})
