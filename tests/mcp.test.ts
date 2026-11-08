import { describe, expect, it } from 'vitest'
import { controlerRequete, outilsPermis } from '../src/shared/mcp'

describe('Serveur MCP local', () => {
  const jeton = 'a'.repeat(43)
  const ok = { host: '127.0.0.1:47070', authorization: `Bearer ${jeton}` }

  it('accepte un agent du PC avec le bon jeton', () => {
    expect(controlerRequete(ok, 47070, jeton)).toBeNull()
    expect(controlerRequete({ ...ok, host: 'localhost:47070' }, 47070, jeton)).toBeNull()
  })

  it('refuse les pages web, les autres hôtes et les mauvais jetons', () => {
    expect(controlerRequete({ ...ok, origin: 'https://site-piege.example' }, 47070, jeton)?.code).toBe(403)
    expect(controlerRequete({ ...ok, host: 'piege.example:47070' }, 47070, jeton)?.code).toBe(403)
    expect(controlerRequete({ ...ok, authorization: 'Bearer faux' }, 47070, jeton)?.code).toBe(401)
    expect(controlerRequete({ host: ok.host }, 47070, jeton)?.code).toBe(401)
  })

  it('cache les outils de navigation en lecture seule', () => {
    const lecture = outilsPermis(false).map((o) => o.name)
    expect(lecture).toContain('lire_onglet')
    expect(lecture).not.toContain('ouvrir_onglet')
    expect(lecture).not.toContain('utiliser_outil_du_site')
    expect(outilsPermis(true).map((o) => o.name)).toContain('utiliser_outil_du_site')
  })
})
