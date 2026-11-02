import { describe, expect, it } from 'vitest'
import { Identite } from '../src/main/social/identite'
import { verifier } from '../server/src/auth'
import { adresseServeur } from '../src/shared/social'

const corps = (s: string): Uint8Array => new TextEncoder().encode(s)
const tampon = (u: Uint8Array): ArrayBuffer => u.slice().buffer

describe('identité sociale', () => {
  it('produit des signatures que le serveur accepte', async () => {
    const id = Identite.nouvelle()
    const b = corps('{"pseudo":"Claire"}')
    const h = id.signer('POST', '/api/profil', b)
    const s = { cle: h['X-Se7en-Cle'], heure: h['X-Se7en-Heure'], nonce: h['X-Se7en-Nonce'], signature: h['X-Se7en-Signature'] }
    expect(await verifier(s, 'POST', '/api/profil', tampon(b))).toBe(true)
    // un autre chemin, un autre corps ou une autre méthode : refusé
    expect(await verifier(s, 'POST', '/api/amis', tampon(b))).toBe(false)
    expect(await verifier(s, 'POST', '/api/profil', tampon(corps('{"pseudo":"Pirate"}')))).toBe(false)
    expect(await verifier(s, 'DELETE', '/api/profil', tampon(b))).toBe(false)
  })

  it('se retrouve à l’identique après export', () => {
    const id = Identite.nouvelle()
    expect(Identite.depuis(id.exporter()).clePublique).toBe(id.clePublique)
    expect(id.clePublique).toMatch(/^[\w-]{43}$/)
  })

  it('n’accepte que https, ou http sur ce PC', () => {
    expect(adresseServeur('https://se7en-social.exemple.workers.dev/x')).toBe('https://se7en-social.exemple.workers.dev')
    expect(adresseServeur('http://127.0.0.1:8787')).toBe('http://127.0.0.1:8787')
    expect(adresseServeur('http://exemple.fr')).toBeNull()
    expect(adresseServeur('https://a:b@exemple.fr')).toBeNull()
    expect(adresseServeur('javascript:alert(1)')).toBeNull()
  })
})
