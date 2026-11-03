import { describe, expect, it } from 'vitest'
import { enPaquets, repartir } from '../src/main/ia/traduction'

describe('traduction de page', () => {
  it('remet chaque bout de traduction à sa place grâce aux marqueurs', () => {
    expect(repartir('⟦0⟧Le vitrail désigne le ⟦1⟧verre⟦2⟧ coloré', 3)).toEqual(['Le vitrail désigne le ', 'verre', ' coloré'])
    // l'IA a déplacé un marqueur : chaque bout va quand même au bon morceau
    expect(repartir('⟦1⟧verre⟦0⟧ coloré', 2)).toEqual([' coloré', 'verre'])
  })

  it('refuse une traduction où un marqueur manque ou se répète', () => {
    expect(repartir('⟦0⟧Le vitrail ⟦0⟧verre', 2)).toBeNull()
    expect(repartir('Le vitrail verre', 2)).toBeNull()
    expect(repartir('⟦0⟧a⟦5⟧b', 2)).toBeNull()
  })

  it('un bloc simple garde son texte, sans marqueur parasite', () => {
    expect(repartir('Bonjour ⟦0⟧', 1)).toEqual(['Bonjour '])
  })

  it('découpe en paquets raisonnables', () => {
    const blocs = Array.from({ length: 70 }, (_, i) => ({ t: 'x'.repeat(100), i }))
    const p = enPaquets(blocs)
    expect(p.every((x) => x.length <= 30 && x.reduce((n, b) => n + b.t.length, 0) <= 2400)).toBe(true)
    expect(p.flat()).toHaveLength(70)
  })
})
