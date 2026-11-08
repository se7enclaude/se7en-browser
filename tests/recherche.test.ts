import { describe, expect, it } from 'vitest'
import { ajouterSources, nettoyerCitations, pertinence, questionDeRecherche } from '../src/shared/recherche'

describe('Recherche approfondie', () => {
  it('reconnaît une demande de recherche', () => {
    expect(questionDeRecherche('/recherche écrans OLED et usure')).toBe('écrans OLED et usure')
    expect(questionDeRecherche('Recherche approfondie sur les pompes à chaleur')).toBe('les pompes à chaleur')
    expect(questionDeRecherche('fais une recherche approfondie : vélo électrique pliant')).toBe('vélo électrique pliant')
    expect(questionDeRecherche('résume cette page')).toBeNull()
  })

  it('juge la pertinence d\'un onglet par ses mots', () => {
    expect(pertinence('écrans OLED usure', 'Les écrans OLED vieillissent-ils mal ?')).toBeGreaterThan(0.5)
    expect(pertinence('écrans OLED usure', 'Recette de la tarte aux pommes')).toBe(0)
  })

  it('numérote les sources sans doublon', () => {
    const s = ajouterSources([], [
      { url: 'https://a.fr/x', titre: 'A', origine: 'web' },
      { url: 'https://a.fr/x#section', titre: 'A bis', origine: 'lien' },
      { url: 'https://b.fr/', titre: 'B', origine: 'wikipedia' }
    ])
    expect(s.map((x) => [x.n, x.titre])).toEqual([
      [1, 'A'],
      [2, 'B']
    ])
  })

  it('retire les citations inventées ou sans contenu', () => {
    const sources = [
      { n: 1, url: 'https://a.fr', titre: 'A', origine: 'web' as const, notes: '- fait' },
      { n: 2, url: 'https://b.fr', titre: 'B', origine: 'web' as const, notes: '' }
    ]
    expect(nettoyerCitations('Vrai [1]. Vide [2]. Inventé [9].', sources)).toBe('Vrai [1]. Vide . Inventé .')
  })
})

describe('Liens suivis', () => {
  it('écarte les autres langues de Wikipédia et les pages techniques', async () => {
    const { lienUtile } = await import('../src/shared/recherche')
    expect(lienUtile('https://es.wikipedia.org/wiki/Bomba_de_calor')).toBe(false)
    expect(lienUtile('https://fr.wikipedia.org/wiki/Coefficient_de_performance')).toBe(true)
    expect(lienUtile('https://en.wikipedia.org/wiki/Special:Random')).toBe(false)
    expect(lienUtile('https://www.wikidata.org/wiki/Q190117')).toBe(false)
    expect(lienUtile('https://www.ademe.fr/pompe-a-chaleur-rendement')).toBe(true)
    expect(lienUtile('https://site.fr/account/login')).toBe(false)
    expect(lienUtile('https://en.wikipedia.org/w/index.php?title=Special:CreateAccount&returnto=Heat+pump')).toBe(false)
  })
})
