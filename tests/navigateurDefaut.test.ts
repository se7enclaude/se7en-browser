import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { isPackaged: false }, shell: { openExternal: vi.fn() } }))

import { CLE_CHOIX_HTTPS, liensDesArguments } from '../src/main/navigateurDefaut'

describe('navigateur par défaut', () => {
  it('reconnaît les PDF Windows passés en argument', () => {
    const r = liensDesArguments(['se7en Browser.exe', '--flag', 'C:\\Users\\moi\\Documents\\facture.PDF', 'D:\\x.pdf', 'C:\\photo.png', 'facture.pdf', 'C:facture.pdf'])
    expect(r.pdfs).toEqual(['C:\\Users\\moi\\Documents\\facture.PDF', 'D:\\x.pdf'])
  })

  it('garde les adresses web', () => {
    const r = liensDesArguments(['exe', 'https://exemple.fr/page', 'javascript:alert(1)'])
    expect(r.urls).toEqual(['https://exemple.fr/page'])
    expect(r.pdfs).toEqual([])
  })

  it('interroge la bonne clé du registre (antislashs conservés)', () => {
    expect(CLE_CHOIX_HTTPS.split(String.fromCharCode(92))).toEqual(['HKCU', 'Software', 'Microsoft', 'Windows', 'Shell', 'Associations', 'UrlAssociations', 'https', 'UserChoice'])
  })
})
