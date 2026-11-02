import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyserChamps, remplirChamps, trouverLibelle } from '../src/main/pdf/formulaire'

describe('trouverLibelle', () => {
  const m = (texte: string, x: number, y: number, largeur = 60) => ({ texte, x, y, largeur, hauteur: 10 })
  it('prend le texte à gauche sur la même ligne', () => {
    expect(trouverLibelle([200, 700, 400, 716], [m('Nom :', 100, 704, 40), m('Titre', 100, 760)])).toBe('Nom :')
  })
  it('sinon le texte juste au-dessus', () => {
    expect(trouverLibelle([100, 600, 400, 616], [m('Adresse du domicile', 100, 622, 120)])).toBe('Adresse du domicile')
  })
  it('rien si aucun texte proche', () => {
    expect(trouverLibelle([100, 600, 400, 616], [m('Loin', 500, 100)])).toBe('')
  })
})

describe('analyse et remplissage d’un vrai formulaire', () => {
  it('trouve les libellés, remplit avec les accents, garde l’original intact', async () => {
    const dossier = mkdtempSync(join(tmpdir(), 'se7en-form-'))
    const doc = await PDFDocument.create()
    const police = await doc.embedFont(StandardFonts.Helvetica)
    const page = doc.addPage([595, 842])
    const form = doc.getForm()
    const lignes: [string, string][] = [
      ['Nom :', 'txtA'],
      ['Prénom :', 'txtB'],
      ['Ville :', 'txtC']
    ]
    lignes.forEach(([libelle, nom], i) => {
      const y = 700 - i * 40
      page.drawText(libelle.replace('é', 'e'), { x: 60, y: y + 4, size: 12, font: police })
      form.createTextField(nom).addToPage(page, { x: 160, y, width: 200, height: 20 })
    })
    form.createCheckBox('accord').addToPage(page, { x: 60, y: 500, width: 12, height: 12 })
    const source = join(dossier, 'form.pdf')
    writeFileSync(source, await doc.save())

    const { champs, autres } = await analyserChamps(source)
    expect(champs.map((c) => [c.nom, c.libelle])).toEqual([
      ['txtA', 'Nom :'],
      ['txtB', 'Prenom :'],
      ['txtC', 'Ville :']
    ])
    expect(autres).toBe(1)

    const sortie = join(dossier, 'rempli.pdf')
    const n = await remplirChamps(source, [{ nom: 'txtA', valeur: 'Müller' }, { nom: 'txtC', valeur: 'Orléans 😀' }, { nom: 'inconnu', valeur: 'x' }], sortie)
    expect(n).toBe(2)
    const relu = (await PDFDocument.load(await import('node:fs').then((f) => f.readFileSync(sortie)))).getForm()
    expect(relu.getTextField('txtA').getText()).toBe('Müller')
    expect(relu.getTextField('txtC').getText()).toBe('Orléans ?') // l'émoji n'existe pas dans la police standard
    const original = (await PDFDocument.load(await import('node:fs').then((f) => f.readFileSync(source)))).getForm()
    expect(original.getTextField('txtA').getText()).toBeUndefined()
  })
})
