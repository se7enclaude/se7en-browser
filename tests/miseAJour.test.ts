import { describe, expect, it } from 'vitest'
import { plusRecente } from '../src/shared/miseAJour'

describe('mise à jour', () => {
  it('compare les versions nombre par nombre', () => {
    expect(plusRecente('1.2.0', '1.1.0')).toBe(true)
    expect(plusRecente('1.10.0', '1.9.2')).toBe(true)
    expect(plusRecente('v2.0.0', '1.99.99')).toBe(true)
    expect(plusRecente('1.1.0', '1.1.0')).toBe(false)
    expect(plusRecente('1.0.9', '1.1.0')).toBe(false)
    expect(plusRecente('1.1', '1.1.0')).toBe(false)
  })
})
