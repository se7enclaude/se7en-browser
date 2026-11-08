import { describe, expect, it } from 'vitest'
import { cleDeCode, codeDeCle, fusionnerPaquets, lirePaquet, type PaquetSync } from '../src/shared/sync'

describe('Synchronisation chiffrée', () => {
  it('écrit la clé en code de liaison et la relit, avec contrôle', () => {
    const cle = new Uint8Array(32).map((_, i) => (i * 37 + 11) % 256)
    const code = codeDeCle(cle)
    expect(code).toMatch(/^([0-9A-Z]{4}-){13}[0-9A-Z]{2}$/)
    expect([...cleDeCode(code)!]).toEqual([...cle])
    expect([...cleDeCode(code.toLowerCase().replace(/-/g, ' '))!]).toEqual([...cle])
    const faute = (code[0] === 'A' ? 'B' : 'A') + code.slice(1)
    expect(cleDeCode(faute)).toBeNull()
  })

  it('garde la modification la plus récente de chaque catégorie', () => {
    const maintenant = 10_000_000_000
    const a: PaquetSync = {
      v: 1,
      categories: { favoris: { modif: 10, valeur: ['a'] }, skills: { modif: 50, valeur: ['sa'] } },
      appareils: { pc1: { nom: 'PC 1', maj: maintenant, onglets: [] } }
    }
    const b: PaquetSync = {
      v: 1,
      categories: { favoris: { modif: 20, valeur: ['b'] } },
      appareils: { pc2: { nom: 'PC 2', maj: maintenant - 1, onglets: [] }, vieux: { nom: 'Vieux', maj: 0, onglets: [] } }
    }
    const f = fusionnerPaquets(a, b, maintenant)
    expect(f.categories.favoris?.valeur).toEqual(['b'])
    expect(f.categories.skills?.valeur).toEqual(['sa'])
    expect(Object.keys(f.appareils).sort()).toEqual(['pc1', 'pc2'])
  })

  it('vérifie un paquet venu du serveur', () => {
    const p = lirePaquet({
      v: 1,
      categories: { favoris: { modif: 'x' } },
      appareils: { pc: { nom: 'PC', maj: 1, onglets: [{ titre: 'ok', url: 'https://a.fr' }, { titre: 'x', url: 'javascript:alert(1)' }] } }
    })
    expect(p.categories.favoris).toBeUndefined()
    expect(p.appareils.pc.onglets).toEqual([{ titre: 'ok', url: 'https://a.fr' }])
    expect(lirePaquet('n importe quoi')).toEqual({ v: 1, categories: {}, appareils: {} })
  })
})
