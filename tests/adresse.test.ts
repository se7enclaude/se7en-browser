import { describe, expect, it } from 'vitest'
import { adresseLisible, estAdresseAutorisee, resoudreSaisie } from '../src/shared/adresse'

const G = 'https://www.google.com/search?q=%s'

describe('resoudreSaisie', () => {
  it('ouvre les adresses complètes telles quelles', () => {
    expect(resoudreSaisie('https://exemple.fr/a?b=1', G)).toBe('https://exemple.fr/a?b=1')
    expect(resoudreSaisie('  http://exemple.fr  ', G)).toBe('http://exemple.fr/')
  })

  it('ajoute https:// aux noms de domaine', () => {
    expect(resoudreSaisie('exemple.fr', G)).toBe('https://exemple.fr/')
    expect(resoudreSaisie('www.impots.gouv.fr/accueil', G)).toBe('https://www.impots.gouv.fr/accueil')
    expect(resoudreSaisie('café.fr', G)).toBe('https://xn--caf-dma.fr/')
  })

  it('ouvre localhost et les IP en http', () => {
    expect(resoudreSaisie('localhost:3000', G)).toBe('http://localhost:3000/')
    expect(resoudreSaisie('192.168.1.1', G)).toBe('http://192.168.1.1/')
  })

  it('cherche tout le reste', () => {
    expect(resoudreSaisie('météo paris', G)).toBe('https://www.google.com/search?q=m%C3%A9t%C3%A9o%20paris')
    expect(resoudreSaisie('bonjour', G)).toBe('https://www.google.com/search?q=bonjour')
    expect(resoudreSaisie('node.js tutoriel', G)).toBe('https://www.google.com/search?q=node.js%20tutoriel')
    expect(resoudreSaisie('javascript:alert(1)', G)).toBe('https://www.google.com/search?q=javascript%3Aalert(1)')
  })

  it('renvoie une chaîne vide pour une saisie vide', () => {
    expect(resoudreSaisie('   ', G)).toBe('')
  })
})

describe('estAdresseAutorisee', () => {
  it("n'autorise que http et https", () => {
    expect(estAdresseAutorisee('https://a.fr')).toBe(true)
    expect(estAdresseAutorisee('http://a.fr')).toBe(true)
    expect(estAdresseAutorisee('javascript:alert(1)')).toBe(false)
    expect(estAdresseAutorisee('file:///C:/Windows')).toBe(false)
    expect(estAdresseAutorisee('pas une url')).toBe(false)
  })
})

describe('adresseLisible', () => {
  it('raccourcit les adresses', () => {
    expect(adresseLisible('https://www.exemple.fr/')).toBe('exemple.fr')
    expect(adresseLisible('https://exemple.fr/page?x=1')).toBe('exemple.fr/page?x=1')
  })
})
