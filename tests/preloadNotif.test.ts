import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CANAUX } from '../src/shared/ipc'

describe('preload de la notification', () => {
  it('recopie les mêmes noms de canaux que CANAUX, sans importer shared/ipc', () => {
    const source = readFileSync('src/preload/notif.ts', 'utf8')
    expect(source).not.toMatch(/from '\.\.\/shared\/ipc'/)
    for (const nom of ['notifMessage', 'notifTaille', 'notifOuvrir'] as const) expect(source).toContain(`${nom}: '${CANAUX[nom]}'`)
  })
})
