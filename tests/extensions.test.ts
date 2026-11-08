import { describe, expect, it } from 'vitest'
import { zipDeCrx } from '../src/main/extensions/crx'
import { idExtension, nomManifeste } from '../src/shared/extensions'

describe('Extensions', () => {
  it('lit l\'identifiant depuis un lien du Chrome Web Store', () => {
    expect(idExtension('https://chromewebstore.google.com/detail/dark-reader/eimadpbcbfnmbkopoojfekhnkhdbieeh')).toBe('eimadpbcbfnmbkopoojfekhnkhdbieeh')
    expect(idExtension('https://chrome.google.com/webstore/detail/sponsorblock/mnjggcdmjocbbbhaepdhchncahnbgone?hl=fr')).toBe('mnjggcdmjocbbbhaepdhchncahnbgone')
    expect(idExtension('eimadpbcbfnmbkopoojfekhnkhdbieeh')).toBe('eimadpbcbfnmbkopoojfekhnkhdbieeh')
    expect(idExtension('https://exemple.com/detail/eimadpbcbfnmbkopoojfekhnkhdbieeh')).toBeNull()
    expect(idExtension('pas un id')).toBeNull()
  })

  it('traduit le nom « __MSG_… » du manifeste', () => {
    expect(nomManifeste('__MSG_extName__', { extname: { message: 'Mon extension' } })).toBe('Mon extension')
    expect(nomManifeste('Nom simple', null)).toBe('Nom simple')
  })

  it('extrait l\'archive zip d\'un paquet CRX3', () => {
    const entete = Buffer.alloc(12)
    entete.write('Cr24', 0, 'latin1')
    entete.writeUInt32LE(3, 4)
    entete.writeUInt32LE(5, 8)
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])
    const crx = Buffer.concat([entete, Buffer.alloc(5), zip])
    expect(zipDeCrx(crx).equals(zip)).toBe(true)
    expect(() => zipDeCrx(Buffer.from('pas un crx du tout'))).toThrow()
  })
})
