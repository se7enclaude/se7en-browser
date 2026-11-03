import { describe, expect, it } from 'vitest'
import { chiffrer, dechiffrer, type ContenuSauvegarde } from '../src/main/sauvegarde'

const contenu: ContenuSauvegarde = { version: 1, date: 1, reglages: { theme: 'sombre' }, coffre: { valeurs: { nom: 'Dupont' }, perso: [] }, favoris: [], skills: [] }

describe('sauvegarde chiffrée', () => {
  it('se relit avec le bon mot de passe', () => {
    const f = chiffrer(contenu, 'mot de passe solide')
    expect(f.toString('utf8')).not.toContain('Dupont')
    expect(dechiffrer(f, 'mot de passe solide')).toEqual(contenu)
  })
  it('refuse un mauvais mot de passe ou un fichier modifié', () => {
    const f = chiffrer(contenu, 'mot de passe solide')
    expect(dechiffrer(f, 'autre mot de passe')).toBeNull()
    const abime = Buffer.from(f)
    abime[abime.length - 3] ^= 1
    expect(dechiffrer(abime, 'mot de passe solide')).toBeNull()
    expect(dechiffrer(Buffer.from('pas une sauvegarde'), 'x')).toBeNull()
  })
})
