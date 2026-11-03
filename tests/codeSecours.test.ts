import { describe, expect, it } from 'vitest'
import { Identite } from '../src/main/social/identite'

describe('code de secours du profil', () => {
  it('redonne exactement la même identité sur un autre PC', () => {
    const id = Identite.nouvelle()
    const code = id.codeSecours()
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}(-[0-9A-HJKMNP-TV-Z]{1,5})+$/)
    expect(Identite.depuisCode(code)?.clePublique).toBe(id.clePublique)
    // recopié en minuscules, sans tirets, avec des espaces
    expect(Identite.depuisCode(code.toLowerCase().replace(/-/g, ' '))?.clePublique).toBe(id.clePublique)
  })

  it('refuse un code mal recopié', () => {
    const code = Identite.nouvelle().codeSecours()
    const faute = (code[0] === 'A' ? 'B' : 'A') + code.slice(1)
    expect(Identite.depuisCode(faute)).toBeNull()
    expect(Identite.depuisCode('pas un code')).toBeNull()
    expect(Identite.depuisCode(code.slice(0, -3))).toBeNull()
  })
})
