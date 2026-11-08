/* Favoris (favoris.json), gardés sur le PC. */
import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { join } from 'node:path'
import type { Favori } from '../../shared/donnees'
import { ecrireJson, lireJson } from './fichierJson'

const MAX = 5000

export function nettoyerFavoris(brut: unknown): Favori[] {
  if (!Array.isArray(brut)) return []
  return brut
    .filter((e): e is Favori => !!e && typeof e === 'object' && typeof e.id === 'string' && typeof e.url === 'string' && typeof e.titre === 'string')
    .slice(0, MAX)
    .map((e) => ({
      id: e.id,
      url: e.url,
      titre: e.titre.slice(0, 500),
      favicon: typeof e.favicon === 'string' && e.favicon.startsWith('data:image/') ? e.favicon : null,
      date: typeof e.date === 'number' ? e.date : 0
    }))
}

export class Favoris extends EventEmitter<{ change: [Favori[]] }> {
  private liste: Favori[]
  private readonly chemin: string

  constructor(dossier: string) {
    super()
    this.chemin = join(dossier, 'favoris.json')
    this.liste = nettoyerFavoris(lireJson(this.chemin))
  }

  lire(): Favori[] {
    return this.liste
  }

  /** Ajoute la page aux favoris, ou l'en retire si elle y est déjà. Renvoie vrai si elle est maintenant en favori. */
  basculer(url: string, titre: string, favicon: string | null): boolean {
    const existant = this.liste.find((f) => f.url === url)
    if (existant) this.liste = this.liste.filter((f) => f !== existant)
    else this.liste = [{ id: randomUUID(), url, titre: titre || url, favicon, date: Date.now() }, ...this.liste].slice(0, MAX)
    this.changer()
    return !existant
  }

  /** Ajoute des favoris importés d'un autre navigateur (sans doublon). Renvoie le nombre ajouté. */
  importer(liste: { url: string; titre: string; favicon: string | null; date: number }[]): number {
    const deja = new Set(this.liste.map((f) => f.url))
    const nouveaux = liste.filter((f) => !deja.has(f.url)).map((f) => ({ id: randomUUID(), ...f }))
    if (!nouveaux.length) return 0
    this.liste = [...this.liste, ...nouveaux].slice(0, MAX)
    this.changer()
    return nouveaux.length
  }

  /** Remplace toute la liste (synchronisation depuis un autre PC). */
  remplacer(brut: unknown): void {
    this.liste = nettoyerFavoris(brut)
    this.changer()
  }

  supprimer(id: string): void {
    this.liste = this.liste.filter((f) => f.id !== id)
    this.changer()
  }

  private changer(): void {
    void ecrireJson(this.chemin, this.liste).catch(() => undefined)
    this.emit('change', this.liste)
  }
}
