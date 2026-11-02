/* Historique de navigation, gardé uniquement sur le PC (historique.json). */
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type { EntreeHistorique, SitePopulaire } from '../../shared/donnees'
import { lireJson, SauvegardeDifferee } from './fichierJson'

const MAX_ENTREES = 10000
/** Recharger la même page dans ce délai ne crée pas de nouvelle entrée. */
const DELAI_DOUBLON = 5 * 60 * 1000

export function nettoyerHistorique(brut: unknown): EntreeHistorique[] {
  if (!Array.isArray(brut)) return []
  return brut
    .filter(
      (e): e is EntreeHistorique =>
        !!e && typeof e === 'object' && typeof e.id === 'string' && typeof e.url === 'string' && typeof e.titre === 'string' && typeof e.date === 'number'
    )
    .slice(0, MAX_ENTREES)
}

export class Historique {
  /** Les plus récentes en premier. */
  private entrees: EntreeHistorique[]
  private readonly sauvegarde: SauvegardeDifferee

  constructor(dossier: string, private readonly maintenant: () => number = Date.now) {
    const chemin = join(dossier, 'historique.json')
    this.entrees = nettoyerHistorique(lireJson(chemin))
    this.sauvegarde = new SauvegardeDifferee(chemin, () => this.entrees)
  }

  ajouter(url: string, titre: string): void {
    const date = this.maintenant()
    const derniere = this.entrees[0]
    if (derniere && derniere.url === url && date - derniere.date < DELAI_DOUBLON) {
      derniere.date = date
      if (titre) derniere.titre = titre
    } else {
      this.entrees.unshift({ id: randomUUID(), url, titre: titre || url, date })
      if (this.entrees.length > MAX_ENTREES) this.entrees.length = MAX_ENTREES
    }
    this.sauvegarde.demander()
  }

  /** Le titre arrive souvent après la navigation : on complète la visite la plus récente de cette adresse. */
  majTitre(url: string, titre: string): void {
    const e = this.entrees.slice(0, 50).find((x) => x.url === url)
    if (!e || !titre || e.titre === titre) return
    e.titre = titre
    this.sauvegarde.demander()
  }

  chercher(texte = '', limite = 500): EntreeHistorique[] {
    const mots = texte.toLowerCase().split(/\s+/).filter(Boolean)
    const res: EntreeHistorique[] = []
    for (const e of this.entrees) {
      const cible = `${e.titre} ${e.url}`.toLowerCase()
      if (mots.every((m) => cible.includes(m))) res.push(e)
      if (res.length >= limite) break
    }
    return res
  }

  /** Sites les plus visités (pour les raccourcis de la page Nouvel onglet). */
  plusVisites(n: number): SitePopulaire[] {
    const compte = new Map<string, SitePopulaire>()
    for (const e of this.entrees.slice(0, 3000)) {
      let cle: string
      try {
        cle = new URL(e.url).origin
      } catch {
        continue
      }
      const s = compte.get(cle)
      if (s) s.visites++
      // on garde l'adresse et le titre de la visite la plus récente du site
      else compte.set(cle, { url: e.url, titre: e.titre, visites: 1 })
    }
    return [...compte.values()].sort((a, b) => b.visites - a.visites).slice(0, n)
  }

  supprimer(ids: string[]): void {
    const set = new Set(ids)
    this.entrees = this.entrees.filter((e) => !set.has(e.id))
    this.sauvegarde.demander()
  }

  effacer(): void {
    this.entrees = []
    this.sauvegarde.demander()
  }

  vider(): void {
    this.sauvegarde.vider()
  }
}
