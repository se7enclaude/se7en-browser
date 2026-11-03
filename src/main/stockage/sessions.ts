/* Sessions d'onglets sauvegardées d'un lancement à l'autre (sessions.json). */
import { join } from 'node:path'
import type { SessionSauvee } from '../../shared/onglets'
import { ecrireJson, lireJson } from './fichierJson'
import { nettoyerPrioritaires } from './prioritaires'

/** Ne garde que des entrées bien formées (le fichier a pu être modifié à la main). */
export function nettoyerSessions(brut: unknown): SessionSauvee[] {
  if (!Array.isArray(brut)) return []
  return brut
    .filter((s): s is SessionSauvee => !!s && typeof s === 'object' && typeof s.id === 'string' && /^[\w-]{1,40}$/.test(s.id) && typeof s.nom === 'string')
    .slice(0, 30)
    .map((s) => ({
      id: s.id,
      nom: s.nom.slice(0, 30),
      emoji: typeof s.emoji === 'string' ? [...s.emoji].slice(0, 2).join('') : '📁',
      onglets: nettoyerPrioritaires(s.onglets)
    }))
}

export class MagasinSessions {
  private readonly chemin: string
  constructor(dossier: string) {
    this.chemin = join(dossier, 'sessions.json')
  }
  lire(): SessionSauvee[] {
    return nettoyerSessions(lireJson(this.chemin))
  }
  sauver(liste: SessionSauvee[]): void {
    void ecrireJson(this.chemin, nettoyerSessions(liste))
  }
}
