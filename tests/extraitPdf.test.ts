import { describe, expect, it } from 'vitest'
import { extraitPdf } from '../src/main/pdf/texte'

const doc = Array.from({ length: 60 }, (_, i) => `[Page ${i + 1}]\n${i === 41 ? 'La résiliation du contrat se fait par lettre recommandée avec un préavis de trois mois. ' : ''}${'Texte ordinaire du document. '.repeat(80)}`).join('\n\n')

describe('questions sur un long PDF', () => {
  it('garde la page qui répond à la question, avec son numéro', () => {
    const e = extraitPdf(doc, 'Comment résilier le contrat ?', 12_000)
    expect(e.length).toBeLessThan(12_500)
    expect(e).toContain('[Page 42]')
    expect(e).toContain('préavis de trois mois')
  })
  it('pour un résumé, prend le début et des pages réparties', () => {
    const e = extraitPdf(doc, '/resume', 12_000)
    expect(e).toContain('[Page 1]')
    expect((e.match(/\[Page \d+\]/g) ?? []).length).toBeGreaterThan(3)
  })
  it('un document court passe en entier', () => {
    expect(extraitPdf('[Page 1]\ncourt', 'x', 1000)).toBe('[Page 1]\ncourt')
  })
})
