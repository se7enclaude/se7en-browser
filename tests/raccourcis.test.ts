import { describe, expect, it } from 'vitest'
import { actionDuRaccourci, type Touche } from '../src/main/navigateur/raccourcis'

const t = (key: string, mod: Partial<Touche> = {}): Touche => ({
  type: 'keyDown',
  key,
  code: /^[0-9]$/.test(key) ? `Digit${key}` : '',
  control: false,
  shift: false,
  alt: false,
  meta: false,
  ...mod
})

describe('actionDuRaccourci', () => {
  it('gère les onglets', () => {
    expect(actionDuRaccourci(t('t', { control: true }))).toEqual({ type: 'nouvel-onglet' })
    expect(actionDuRaccourci(t('T', { control: true, shift: true }))).toEqual({ type: 'rouvrir-onglet' })
    expect(actionDuRaccourci(t('w', { control: true }))).toEqual({ type: 'fermer-onglet' })
    expect(actionDuRaccourci(t('Tab', { control: true }))).toEqual({ type: 'onglet-suivant' })
    expect(actionDuRaccourci(t('Tab', { control: true, shift: true }))).toEqual({ type: 'onglet-precedent' })
    expect(actionDuRaccourci(t('3', { control: true }))).toEqual({ type: 'onglet-numero', index: 2 })
    expect(actionDuRaccourci(t('9', { control: true }))).toEqual({ type: 'onglet-numero', index: -1 })
    // AZERTY : la touche 1 donne « & », c'est sa position qui compte
    expect(actionDuRaccourci(t('&', { control: true, code: 'Digit1' }))).toEqual({ type: 'onglet-numero', index: 0 })
  })

  it('gère la navigation', () => {
    expect(actionDuRaccourci(t('l', { control: true }))).toEqual({ type: 'focus-adresse' })
    expect(actionDuRaccourci(t('F5'))).toEqual({ type: 'actualiser', forcer: false })
    expect(actionDuRaccourci(t('r', { control: true, shift: true }))).toEqual({ type: 'actualiser', forcer: true })
    expect(actionDuRaccourci(t('ArrowLeft', { alt: true }))).toEqual({ type: 'precedent' })
    expect(actionDuRaccourci(t('ArrowRight', { alt: true }))).toEqual({ type: 'suivant' })
  })

  it('ignore le reste', () => {
    expect(actionDuRaccourci(t('t'))).toBeNull()
    expect(actionDuRaccourci(t('t', { control: true, alt: true }))).toBeNull() // AltGr = Ctrl+Alt
    expect(actionDuRaccourci({ ...t('t', { control: true }), type: 'keyUp' })).toBeNull()
  })
})
