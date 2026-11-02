import { describe, expect, it } from 'vitest'
import { DecoupeurLignes, lireNdjson, SuiviPull } from '../src/main/ia/ndjson'
import { modelePresent } from '../src/shared/ia'

describe('DecoupeurLignes', () => {
  it('recolle les lignes coupées en plusieurs morceaux', () => {
    const d = new DecoupeurLignes()
    expect(d.ajouter('{"a":1}\n{"b"')).toEqual(['{"a":1}'])
    expect(d.ajouter(':2}\n\n{"c":3}')).toEqual(['{"b":2}'])
    expect(d.finir()).toEqual(['{"c":3}'])
  })
})

describe('lireNdjson', () => {
  it('lit chaque objet, même coupé au milieu d’un caractère accentué', async () => {
    const octets = new TextEncoder().encode('{"t":"é"}\n{"t":"à"}\n')
    const morceaux = [octets.slice(0, 7), octets.slice(7)] // coupe au milieu de « é »
    const flux = new ReadableStream<Uint8Array>({
      start(c) {
        for (const m of morceaux) c.enqueue(m)
        c.close()
      }
    })
    const vus: unknown[] = []
    await lireNdjson(flux, (o) => vus.push(o))
    expect(vus).toEqual([{ t: 'é' }, { t: 'à' }])
  })
})

describe('SuiviPull', () => {
  it('additionne les couches du modèle', () => {
    const s = new SuiviPull()
    s.maj({ status: 'pulling manifest' })
    s.maj({ status: 'pulling a', digest: 'a', total: 100, completed: 50 })
    s.maj({ status: 'pulling b', digest: 'b', total: 300, completed: 0 })
    s.maj({ status: 'pulling a', digest: 'a', total: 100, completed: 100 })
    expect([s.recus, s.total]).toEqual([100, 400])
  })
})

describe('modelePresent', () => {
  it('reconnaît « latest » implicite et ignore la casse', () => {
    expect(modelePresent('qwen3:8b', ['qwen3:8b', 'llama3:latest'])).toBe(true)
    expect(modelePresent('llama3', ['llama3:latest'])).toBe(true)
    expect(modelePresent('Qwen3:8B', ['qwen3:8b'])).toBe(true)
    expect(modelePresent('qwen3:4b', ['qwen3:8b'])).toBe(false)
  })
})
