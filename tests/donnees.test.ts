import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Historique } from '../src/main/stockage/historique'
import { cheminLibre, nomDeFichierSur } from '../src/main/navigateur/telechargements'

const dossier = (): string => mkdtempSync(join(tmpdir(), 'se7en-test-'))

describe('Historique', () => {
  it('ajoute les visites, les plus récentes en premier, et regroupe les rechargements', () => {
    let t = 1_000_000
    const h = new Historique(dossier(), () => t)
    h.ajouter('https://a.fr/', 'A')
    t += 1000
    h.ajouter('https://a.fr/', 'A') // rechargement : même entrée
    t += 1000
    h.ajouter('https://b.fr/', 'B')
    expect(h.chercher().map((e) => e.url)).toEqual(['https://b.fr/', 'https://a.fr/'])
  })

  it('cherche dans le titre et l’adresse, tous les mots', () => {
    const h = new Historique(dossier())
    h.ajouter('https://impots.gouv.fr/accueil', 'Impôts accueil')
    h.ajouter('https://meteo.fr/', 'Météo Paris')
    expect(h.chercher('gouv accueil').map((e) => e.titre)).toEqual(['Impôts accueil'])
    expect(h.chercher('paris').length).toBe(1)
  })

  it('complète le titre arrivé après la visite', () => {
    const h = new Historique(dossier())
    h.ajouter('https://a.fr/', '')
    h.majTitre('https://a.fr/', 'Le titre')
    expect(h.chercher()[0].titre).toBe('Le titre')
  })

  it('classe les sites les plus visités', () => {
    let t = 0
    const h = new Historique(dossier(), () => (t += 10 * 60 * 1000))
    for (const u of ['https://a.fr/1', 'https://b.fr/', 'https://a.fr/2', 'https://a.fr/3']) h.ajouter(u, u)
    expect(h.plusVisites(2).map((s) => [s.url, s.visites])).toEqual([
      ['https://a.fr/3', 3],
      ['https://b.fr/', 1]
    ])
  })

  it('supprime et efface', () => {
    const h = new Historique(dossier())
    h.ajouter('https://a.fr/', 'A')
    h.ajouter('https://b.fr/', 'B')
    h.supprimer([h.chercher()[0].id])
    expect(h.chercher().map((e) => e.url)).toEqual(['https://a.fr/'])
    h.effacer()
    expect(h.chercher()).toEqual([])
  })
})

describe('téléchargements', () => {
  it('rend les noms de fichiers sûrs', () => {
    expect(nomDeFichierSur('rapport.pdf')).toBe('rapport.pdf')
    expect(nomDeFichierSur('..\\..\\Windows\\evil.exe')).toBe('evil.exe')
    expect(nomDeFichierSur('a:b*c?.txt')).toBe('a_b_c_.txt')
    expect(nomDeFichierSur('CON.txt')).toBe('_CON.txt')
    expect(nomDeFichierSur('   ')).toBe('telechargement')
    expect(nomDeFichierSur('fin. . .')).toBe('fin')
  })

  it('numérote les fichiers qui existent déjà', () => {
    const pris = new Set([join('D', 'a.pdf'), join('D', 'a (1).pdf')])
    expect(cheminLibre('D', 'a.pdf', (p) => pris.has(p))).toBe(join('D', 'a (2).pdf'))
    expect(cheminLibre('D', 'b.pdf', (p) => pris.has(p))).toBe(join('D', 'b.pdf'))
  })
})
