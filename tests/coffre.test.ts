import { describe, expect, it } from 'vitest'
import { associationPlausible, associerParLibelle, clesDisponibles, decouperDate, valeurDe, valeurPour, type Coffre } from '../src/shared/coffre'

const coffre: Coffre = {
  valeurs: { prenom: 'Claire', nom: 'Martin', dateNaissance: '5/3/1990', adresse: '12 rue de la République', codePostal: '69002', ville: 'Lyon', email: '' },
  perso: [{ id: 'a1', libelle: 'Numéro fiscal', valeur: '1234567890123' }]
}

describe('coffre', () => {
  it('découpe les dates', () => {
    expect(decouperDate('05/03/1990')).toEqual({ jour: '05', mois: '03', annee: '1990' })
    expect(decouperDate('1990-3-5')).toEqual({ jour: '05', mois: '03', annee: '1990' })
    expect(decouperDate('mars 1990')).toBeNull()
  })

  it('calcule les valeurs dérivées et composées', () => {
    expect(valeurDe('dateNaissance_jour', coffre)).toBe('05')
    expect(valeurDe('adresseComplete', coffre)).toBe('12 rue de la République, 69002 Lyon')
    expect(valeurPour(['prenom', 'nom'], coffre)).toBe('Claire Martin')
    expect(valeurDe('perso_a1', coffre)).toBe('1234567890123')
  })

  it('ne propose à l’IA que les clés remplies, sans leurs valeurs', () => {
    const cles = clesDisponibles(coffre)
    expect(cles.map((c) => c.cle)).toContain('prenom')
    expect(cles.map((c) => c.cle)).not.toContain('email') // vide
    expect(cles.map((c) => c.cle)).toContain('perso_a1')
    expect(JSON.stringify(cles)).not.toContain('Claire')
    expect(JSON.stringify(cles)).not.toContain('1234567890123')
  })
})

describe('repérage des champs par leur libellé', () => {
  it.each([
    ['Nom :', ['nom']],
    ['Prénom(s)', ['prenom']],
    ['NOM ET PRÉNOM DU DEMANDEUR', ['prenom', 'nom']],
    ['Nom de naissance', ['nomNaissance']],
    ['Date de naissance (JJ/MM/AAAA)', ['dateNaissance']],
    ['Né(e) le', ['dateNaissance']],
    ['Lieu de naissance', ['lieuNaissance']],
    ['Adresse électronique', ['email']],
    ['Courriel', ['email']],
    ['Tél. portable', ['telephone']],
    ['Code postal', ['codePostal']],
    ['Commune', ['ville']],
    ['Adresse du domicile', ['adresse']],
    ['N° de sécurité sociale', ['numeroSecu']],
    ['Signature', []],
    ['Fait à', []]
  ])('« %s »', (libelle, attendu) => {
    expect(associerParLibelle(libelle)).toEqual(attendu)
  })
})

describe('garde-fou sur les associations', () => {
  it('une date de naissance ne va pas dans « Le : » ni « Date »', () => {
    expect(associationPlausible('dateNaissance', 'Le :')).toBe(false)
    expect(associationPlausible('dateNaissance', 'Date :')).toBe(false)
    expect(associationPlausible('dateNaissance', 'Date de naissance')).toBe(true)
    expect(associationPlausible('dateNaissance_jour', 'Jour')).toBe(true)
    expect(associationPlausible('dateNaissance', 'Né(e) le')).toBe(true)
  })
  it('le n° de sécurité sociale seulement dans son champ', () => {
    expect(associationPlausible('numeroSecu', 'Numéro de dossier')).toBe(false)
    expect(associationPlausible('numeroSecu', 'N° de sécurité sociale')).toBe(true)
  })
  it('les autres informations ne sont pas concernées', () => {
    expect(associationPlausible('prenom', 'Le :')).toBe(true)
  })
})
