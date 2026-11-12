import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MagasinSessions } from '../src/main/stockage/sessions'

describe('sessions sauvegardées', () => {
  it("écrit tout de suite à la fermeture (écriture synchrone)", () => {
    const dossier = mkdtempSync(join(tmpdir(), 'sessions-'))
    const m = new MagasinSessions(dossier)
    m.sauver([{ id: 'travail', nom: 'Travail', emoji: '💼', onglets: [{ url: 'https://a.fr', titre: 'A', favicon: null }] }], true)
    expect(new MagasinSessions(dossier).lire()).toEqual([{ id: 'travail', nom: 'Travail', emoji: '💼', onglets: [{ url: 'https://a.fr', titre: 'A', favicon: null }] }])
  })

  it("une écriture impossible ne lève pas d'erreur", async () => {
    const m = new MagasinSessions(join(tmpdir(), 'nul\0interdit'))
    expect(() => m.sauver([], true)).not.toThrow()
    expect(() => m.sauver([])).not.toThrow()
    await new Promise((ok) => setTimeout(ok, 20))
  })
})
