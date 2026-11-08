import { describe, expect, it } from 'vitest'
import { alerteApres, comprendreDemandeTache, lireNombre, prixDansTexte, prixStructure, prochaineEcheance, type Tache } from '../src/shared/taches'

const base: Tache = {
  id: 't',
  type: 'prix',
  url: 'https://boutique.example/ecran',
  titre: 'Écran 27 pouces',
  creee: 0,
  active: true,
  intervalleMin: 60,
  seuil: 300,
  devise: 'EUR',
  texteGuette: '',
  heure: '08:00',
  derniere: null,
  prochaine: 0,
  historique: [],
  alerte: null
}

describe('Tâches en arrière-plan', () => {
  it('comprend les demandes en français', () => {
    expect(comprendreDemandeTache('Préviens-moi quand ce prix baisse sous 300 €')).toMatchObject({ type: 'prix', seuil: 300 })
    expect(comprendreDemandeTache('alerte-moi si le prix baisse')).toMatchObject({ type: 'prix', seuil: null })
    expect(comprendreDemandeTache('préviens moi quand ça passe à 1 299,99 euros')).toMatchObject({ type: 'prix', seuil: 1299.99 })
    expect(comprendreDemandeTache('préviens-moi quand « en stock » apparaît')).toMatchObject({ type: 'changement', texteGuette: 'en stock' })
    expect(comprendreDemandeTache('surveille cette page toutes les 30 min')).toMatchObject({ type: 'changement', intervalleMin: 30 })
    expect(comprendreDemandeTache('chaque matin à 7h30 résume cette page')).toMatchObject({ type: 'resume', heure: '07:30' })
    expect(comprendreDemandeTache('résume cette page')).toBeNull()
    expect(comprendreDemandeTache('quel est le prix de ce produit ?')).toBeNull()
  })

  it('prévient une fois quand le prix passe sous le seuil', () => {
    const t1 = { ...base, historique: [{ date: 1, valeur: 349 }] }
    expect(alerteApres(t1, { date: 2, valeur: 289.9 })).toBe('Prix sous 300 € : 289,90 €')
    const t2 = { ...base, historique: [{ date: 1, valeur: 289.9 }] }
    expect(alerteApres(t2, { date: 2, valeur: 279 })).toBeNull()
  })

  it('sans seuil, prévient à chaque baisse', () => {
    const t = { ...base, seuil: null, historique: [{ date: 1, valeur: 349 }] }
    expect(alerteApres(t, { date: 2, valeur: 329 })).toContain('349 € → 329 €')
    expect(alerteApres(t, { date: 2, valeur: 359 })).toBeNull()
  })

  it('guette un texte et les changements de page', () => {
    const g = { ...base, type: 'changement' as const, texteGuette: 'en stock', historique: [{ date: 1, present: false }] }
    expect(alerteApres(g, { date: 2, present: true })).toContain('en stock')
    const c = { ...base, type: 'changement' as const, historique: [{ date: 1, empreinte: 'a' }] }
    expect(alerteApres(c, { date: 2, empreinte: 'b' })).toBe('La page a changé')
    expect(alerteApres(c, { date: 2, empreinte: 'a' })).toBeNull()
  })

  it('lit les prix des données structurées, puis du texte', () => {
    const jsonld = [JSON.stringify({ '@type': 'Product', offers: { '@type': 'Offer', price: '249.99', priceCurrency: 'EUR' } })]
    expect(prixStructure(jsonld, {})).toEqual({ valeur: 249.99, devise: 'EUR' })
    expect(prixStructure([], { 'product:price:amount': '19,90', 'product:price:currency': 'EUR' })).toEqual({ valeur: 19.9, devise: 'EUR' })
    expect(prixDansTexte('Livraison offerte. Prix : 1 299,99 € TTC')).toEqual({ valeur: 1299.99, devise: 'EUR' })
    expect(prixDansTexte('Now $1,299.99')).toEqual({ valeur: 1299.99, devise: 'USD' })
    expect(lireNombre('1.299,99')).toBe(1299.99)
  })

  it('planifie le résumé quotidien à l\'heure dite', () => {
    const maintenant = new Date(2026, 10, 8, 9, 0).getTime()
    const p = new Date(prochaineEcheance({ type: 'resume', intervalleMin: 1440, heure: '08:00' }, maintenant))
    expect([p.getDate(), p.getHours()]).toEqual([9, 8])
    expect(prochaineEcheance({ type: 'prix', intervalleMin: 60, heure: '' }, maintenant)).toBe(maintenant + 3_600_000)
  })
})
