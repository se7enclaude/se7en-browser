/* Conversations avec l'IA et Skills, gardées sur le PC (conversations.json, skills.json). */
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { RE_COMMANDE_SKILL, SKILLS_DEFAUT, type Conversation, type ResumeConversation, type Skill } from '../../shared/chat'
import { ecrireJson, lireJson, SauvegardeDifferee } from '../stockage/fichierJson'

const MAX_CONVERSATIONS = 200

function nettoyerConversations(brut: unknown): Conversation[] {
  if (!Array.isArray(brut)) return []
  return brut
    .filter((c): c is Conversation => !!c && typeof c.id === 'string' && typeof c.titre === 'string' && Array.isArray(c.messages))
    .slice(0, MAX_CONVERSATIONS)
}

export function nettoyerSkills(brut: unknown): Skill[] {
  if (!Array.isArray(brut)) return SKILLS_DEFAUT
  const vues = new Set<string>()
  return brut
    .filter(
      (s): s is Skill =>
        !!s &&
        typeof s.id === 'string' &&
        typeof s.commande === 'string' &&
        RE_COMMANDE_SKILL.test(s.commande) &&
        typeof s.titre === 'string' &&
        typeof s.consigne === 'string'
    )
    .filter((s) => !vues.has(s.commande) && vues.add(s.commande))
    .slice(0, 50)
    .map((s) => ({ id: s.id.slice(0, 60), commande: s.commande, titre: s.titre.slice(0, 80), consigne: s.consigne.slice(0, 4000) }))
}

export class Conversations {
  private liste: Conversation[]
  private readonly sauvegarde: SauvegardeDifferee

  constructor(dossier: string) {
    const chemin = join(dossier, 'conversations.json')
    this.liste = nettoyerConversations(lireJson(chemin))
    this.sauvegarde = new SauvegardeDifferee(chemin, () => this.liste, 800)
  }

  resumes(): ResumeConversation[] {
    return this.liste.map((c) => ({ id: c.id, titre: c.titre, date: c.date, nombre: c.messages.length }))
  }

  lire(id: string): Conversation | undefined {
    return this.liste.find((c) => c.id === id)
  }

  creer(titre: string): Conversation {
    const c: Conversation = { id: randomUUID(), titre, date: Date.now(), messages: [] }
    this.liste = [c, ...this.liste].slice(0, MAX_CONVERSATIONS)
    this.sauvegarde.demander()
    return c
  }

  /** La conversation a changé (nouveau message, réponse terminée) : elle remonte en tête et sera enregistrée. */
  toucher(c: Conversation): void {
    c.date = Date.now()
    this.liste = [c, ...this.liste.filter((x) => x !== c)]
    this.sauvegarde.demander()
  }

  supprimer(id: string): void {
    this.liste = this.liste.filter((c) => c.id !== id)
    this.sauvegarde.demander()
  }

  vider(): void {
    this.sauvegarde.vider()
  }
}

export class Skills {
  private liste: Skill[]
  private readonly chemin: string

  constructor(dossier: string) {
    this.chemin = join(dossier, 'skills.json')
    const brut = lireJson(this.chemin)
    this.liste = brut === undefined ? SKILLS_DEFAUT : nettoyerSkills(brut)
  }

  lire(): Skill[] {
    return this.liste
  }

  sauver(liste: unknown): Skill[] {
    this.liste = nettoyerSkills(liste)
    void ecrireJson(this.chemin, this.liste).catch(() => undefined)
    return this.liste
  }

  reinitialiser(): Skill[] {
    return this.sauver(SKILLS_DEFAUT)
  }
}
