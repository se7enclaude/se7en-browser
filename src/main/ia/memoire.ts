/* Mémoire de l'IA : ce que l'utilisateur lui demande de retenir (« retiens que je suis végétarien »).
 * Seul l'utilisateur peut y ajouter quelque chose, en le tapant lui-même : jamais une page web, jamais l'IA
 * (une page piégée ne peut donc pas y glisser une fausse consigne). Gardée sur le PC (memoire.json). */
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { ecrireJson, lireJson } from '../stockage/fichierJson'
import { normaliser } from '../../shared/coffre'
import type { Souvenir } from '../../shared/chat'

const MAX = 100
const MAX_TEXTE = 300

/** « retiens que … », « souviens-toi de … », « n'oublie pas que … » → le fait à retenir, ou null. */
export function demandeDeRetenir(texte: string): string | null {
  const m = /^\s*(?:souviens[- ]toi|rappelle[- ]toi|retiens|m[ée]morise|n['’]oublie pas|garde en m[ée]moire)\s*(?:bien\s*)?(?:que\s+|qu['’]|de\s+|d['’]|:\s*)?([\s\S]+)$/i.exec(texte)
  // « je suis végétarien et que je… » : le « que » répété ne sert à rien dans le souvenir
  const fait = m?.[1]
    ?.trim()
    .replace(/\s+(et|mais|ou)\s+qu(?:e\s+|['’])/gi, ' $1 ')
    .replace(/[.!\s]+$/, '')
  return fait ? fait.charAt(0).toUpperCase() + fait.slice(1) : null
}

/** « oublie tout » → 'tout' ; « oublie que … » → le sujet ; sinon null. */
export function demandeDOublier(texte: string): string | null {
  const m = /^\s*oublie\s+(tout\b.*|(?:que\s+|qu['’]|ce que\s+|le fait que\s+)?[\s\S]+)$/i.exec(texte)
  if (!m) return null
  if (/^tout\b/i.test(m[1])) return 'tout'
  return m[1].replace(/^(que\s+|qu['’]|ce que\s+|le fait que\s+)/i, '').trim().replace(/[.!\s]+$/, '') || null
}

export class Memoire {
  private liste: Souvenir[]
  private readonly chemin: string

  constructor(dossier: string) {
    this.chemin = join(dossier, 'memoire.json')
    const brut = lireJson(this.chemin)
    this.liste = (Array.isArray(brut) ? brut : [])
      .filter((s): s is Souvenir => !!s && typeof s.id === 'string' && typeof s.texte === 'string')
      .slice(0, MAX)
  }

  lire(): Souvenir[] {
    return this.liste
  }

  ajouter(texte: string): Souvenir {
    const s: Souvenir = { id: randomUUID(), texte: texte.trim().slice(0, MAX_TEXTE), date: Date.now() }
    this.liste = [s, ...this.liste.filter((x) => normaliser(x.texte) !== normaliser(s.texte))].slice(0, MAX)
    this.sauver()
    return s
  }

  supprimer(id: string): void {
    this.liste = this.liste.filter((s) => s.id !== id)
    this.sauver()
  }

  /** Oublie les souvenirs qui contiennent tous les mots du sujet. Renvoie le nombre oublié. */
  oublier(sujet: string): number {
    if (sujet === 'tout') {
      const n = this.liste.length
      this.liste = []
      this.sauver()
      return n
    }
    const mots = normaliser(sujet).split(' ').filter((m) => m.length > 2)
    if (!mots.length) return 0
    const avant = this.liste.length
    this.liste = this.liste.filter((s) => !mots.every((m) => normaliser(s.texte).includes(m)))
    this.sauver()
    return avant - this.liste.length
  }

  effacer(): void {
    this.oublier('tout')
  }

  private sauver(): void {
    void ecrireJson(this.chemin, this.liste).catch(() => undefined)
  }
}
