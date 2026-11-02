import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { demandeDeRetenir, demandeDOublier, Memoire } from '../src/main/ia/memoire'
import { construireMessages } from '../src/main/ia/prompts'

describe('demandes de mémoire', () => {
  it.each([
    ['Retiens que je suis végétarien.', 'Je suis végétarien'],
    ['souviens-toi que mon chat s’appelle Mochi', 'Mon chat s’appelle Mochi'],
    ["n'oublie pas que je vis à Lyon", 'Je vis à Lyon'],
    ['Mémorise : je préfère les réponses courtes', 'Je préfère les réponses courtes'],
    ['Rappelle-toi de toujours me tutoyer', 'Toujours me tutoyer']
  ])('« %s »', (texte, fait) => {
    expect(demandeDeRetenir(texte)).toBe(fait)
  })

  it('ne confond pas une question normale', () => {
    expect(demandeDeRetenir('Quel est le retiens du film ?')).toBeNull()
    expect(demandeDeRetenir('Résume la page')).toBeNull()
  })

  it('comprend « oublie »', () => {
    expect(demandeDOublier('Oublie tout')).toBe('tout')
    expect(demandeDOublier('oublie que je suis végétarien')).toBe('je suis végétarien')
    expect(demandeDOublier('Résume la page')).toBeNull()
  })
})

describe('Memoire', () => {
  it('ajoute sans doublon, oublie par sujet, efface tout', () => {
    const m = new Memoire(mkdtempSync(join(tmpdir(), 'se7en-mem-')))
    m.ajouter('Je suis végétarien')
    m.ajouter('Je suis végétarien')
    m.ajouter('Je vis à Lyon')
    expect(m.lire().map((s) => s.texte)).toEqual(['Je vis à Lyon', 'Je suis végétarien'])
    expect(m.oublier('végétarien')).toBe(1)
    expect(m.lire()).toHaveLength(1)
    m.effacer()
    expect(m.lire()).toHaveLength(0)
  })

  it('les souvenirs vont dans la consigne système, pas dans la question', () => {
    const msgs = construireMessages([], 'Une recette ?', [], undefined, 'n', ['Je suis végétarien'])
    expect(msgs[0].content).toContain('- Je suis végétarien')
    expect(msgs.at(-1)!.content).toBe('Une recette ?')
  })
})

describe('souvenirs bien formés', () => {
  it('retire le « que » répété', () => {
    expect(demandeDeRetenir('Retiens que je suis végétarien et que je déteste la coriandre.')).toBe('Je suis végétarien et je déteste la coriandre')
    expect(demandeDeRetenir("retiens que j'habite à Lyon mais qu'il pleut souvent")).toBe("J'habite à Lyon mais il pleut souvent")
  })
})
