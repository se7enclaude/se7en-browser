import { existsSync, mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extrait, MemoireNavigation, motsCles } from '../src/main/ia/memoireNavigation'

const JOUR = 24 * 3600 * 1000
const long = (t: string): string => `${t} `.repeat(30)

describe('mémoire de navigation', () => {
  it('garde les mots utiles, sans accents ni mots vides', () => {
    expect(motsCles('Les SSD NVMe sont plus rapides que les disques durs')).toEqual(['ssd', 'nvme', 'rapide', 'disque', 'durs'])
  })

  it('retrouve la bonne page et ignore les pages trop courtes', async () => {
    const m = new MemoireNavigation(mkdtempSync(join(tmpdir(), 'nav-')))
    const maintenant = Date.now()
    await m.enregistrer({ url: 'https://a.fr/ssd', titre: 'Comparatif SSD 2026', date: maintenant, texte: long('Les SSD NVMe Samsung et Crucial sont comparés.') })
    await m.enregistrer({ url: 'https://b.fr/pain', titre: 'Recette du pain', date: maintenant, texte: long('Farine, eau, levure et sel pour un bon pain.') })
    expect(await m.enregistrer({ url: 'https://c.fr', titre: 'Court', date: maintenant, texte: 'trop court' })).toBe(false)
    expect(m.nombre()).toBe(2)
    const r = m.chercher("retrouve l'article sur les SSD que j'ai lu")
    expect(r[0].page.url).toBe('https://a.fr/ssd')
    expect(r.every((t) => t.page.url !== 'https://b.fr/pain')).toBe(true)
  })

  it('ne réenregistre pas la même page tout de suite, et relit ses fichiers', async () => {
    const dossier = mkdtempSync(join(tmpdir(), 'nav-'))
    const m = new MemoireNavigation(dossier)
    const t = Date.now()
    expect(await m.enregistrer({ url: 'https://a.fr', titre: 'A', date: t, texte: long('Bonjour le monde des navigateurs.') })).toBe(true)
    expect(await m.enregistrer({ url: 'https://a.fr', titre: 'A', date: t + 1000, texte: long('Bonjour le monde des navigateurs.') })).toBe(false)
    expect(new MemoireNavigation(dossier).nombre()).toBe(1)
  })

  it('sait si une adresse a été enregistrée il y a moins de 30 minutes (index relu sans bloquer)', async () => {
    const dossier = mkdtempSync(join(tmpdir(), 'nav-'))
    const t = Date.now()
    await new MemoireNavigation(dossier).enregistrer({ url: 'https://a.fr', titre: 'A', date: t, texte: long('Bonjour le monde des navigateurs.') })
    const m = new MemoireNavigation(dossier)
    expect(await m.estRecente('https://a.fr', t + 60_000)).toBe(true)
    expect(await m.estRecente('https://a.fr', t + 31 * 60_000)).toBe(false)
    expect(await m.estRecente('https://b.fr', t)).toBe(false)
    expect(m.nombre()).toBe(1)
  })

  it('efface les jours de plus de 30 jours', async () => {
    const dossier = mkdtempSync(join(tmpdir(), 'nav-'))
    const m = new MemoireNavigation(dossier)
    const t = Date.now()
    await m.enregistrer({ url: 'https://vieux.fr', titre: 'Vieux', date: t - 40 * JOUR, texte: long('Une page ancienne sur les volcans.') })
    await m.enregistrer({ url: 'https://recent.fr', titre: 'Récent', date: t - 2 * JOUR, texte: long('Une page récente sur les volcans.') })
    expect(m.purger(t)).toBe(1)
    expect(m.nombre()).toBe(1)
    expect(m.chercher('volcans')[0].page.url).toBe('https://recent.fr')
    expect(readdirSync(join(dossier, 'navigation'))).toHaveLength(1)
    m.effacer()
    expect(existsSync(join(dossier, 'navigation'))).toBe(false)
  })

  it("choisit l'extrait qui contient les mots cherchés", () => {
    const texte = 'a '.repeat(2000) + 'le volcan Etna est entré en éruption ' + 'b '.repeat(2000)
    expect(extrait(texte, ['etna'])).toContain('Etna')
  })
})
