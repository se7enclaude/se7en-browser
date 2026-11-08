import { describe, expect, it } from 'vitest'
import { ajouterSkillRecue, commandeDepuis, lireSkillPartagee, SKILLS_DEFAUT, texteSkillPartagee } from '../src/shared/chat'

describe('Skills partagées entre amis', () => {
  const skill = { commande: 'compare', titre: 'Comparer les prix', consigne: 'Compare les prix de ce produit\net donne le moins cher.' }

  it('fait l\'aller-retour message → Skill', () => {
    const texte = texteSkillPartagee(skill)
    expect(texte.length).toBeLessThanOrEqual(2000)
    expect(lireSkillPartagee(texte)).toEqual(skill)
  })

  it('ignore les messages ordinaires et les Skills mal formées', () => {
    expect(lireSkillPartagee('Salut, tu viens ce soir ?')).toBeNull()
    expect(lireSkillPartagee('✦ Skill se7en\n/Pas Valide — x\nconsigne')).toBeNull()
    expect(lireSkillPartagee('✦ Skill se7en\n/ok — Titre\n   ')).toBeNull()
  })

  it('n\'écrase jamais une Skill existante : la reçue prend une commande libre', () => {
    const r = ajouterSkillRecue(SKILLS_DEFAUT, { commande: 'resume', titre: 'Mon résumé', consigne: 'Résume en une phrase.' }, 'x')
    expect(r.deja).toBe(false)
    expect(r.commande).toBe('resume-2')
    expect(r.liste.find((s) => s.commande === 'resume')?.consigne).toBe(SKILLS_DEFAUT[0].consigne)
  })

  it('ne l\'ajoute pas deux fois', () => {
    const r = ajouterSkillRecue(SKILLS_DEFAUT, { commande: 'autre', titre: 'x', consigne: SKILLS_DEFAUT[1].consigne }, 'x')
    expect(r.deja).toBe(true)
    expect(r.commande).toBe('points')
  })

  it('propose une commande à partir d\'une question', () => {
    expect(commandeDepuis('Compare les prix de ce téléphone')).toBe('compare-les-prix-de-ce')
    expect(commandeDepuis('???')).toBe('ma-skill')
  })
})
