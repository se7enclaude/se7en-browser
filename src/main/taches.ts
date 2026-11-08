/* Tâches en arrière-plan : surveille des pages (prix, changement, résumé du jour) tant que le navigateur est ouvert,
 * et prévient par une notification Windows. Chaque page est lue par le lecteur cloisonné (session à part, sans tes
 * cookies), et l'IA locale ne sert qu'à lire un prix introuvable ou à écrire le résumé. Rien ne part sur un serveur se7en. */
import { createHash, randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { join } from 'node:path'
import { Notification } from 'electron'
import { estAdresseAutorisee } from '../shared/adresse'
import { modeleEclair, modelePresent } from '../shared/ia'
import type { Reglages } from '../shared/reglages'
import {
  ajouterPoint,
  alerteApres,
  INTERVALLES_MIN,
  MAX_TACHES,
  prixDansTexte,
  prixStructure,
  prochaineEcheance,
  texteComparable,
  type DemandeTache,
  type PointTache,
  type Tache
} from '../shared/taches'
import { lireCloisonne } from './agent/lecteur'
import { prixParIA, resumeDuJour } from './ia/eclair'
import type { Ollama } from './ia/ollama'
import { lireJson, SauvegardeDifferee } from './stockage/fichierJson'

function nettoyer(brut: unknown): Tache[] {
  if (!Array.isArray(brut)) return []
  return brut
    .filter((t): t is Tache => !!t && typeof t.id === 'string' && typeof t.url === 'string' && estAdresseAutorisee(t.url) && ['prix', 'changement', 'resume'].includes(t.type))
    .slice(0, MAX_TACHES)
}

export class ServiceTaches extends EventEmitter<{ change: [Tache[]] }> {
  private taches: Tache[]
  private readonly sauvegarde: SauvegardeDifferee
  private minuteur: NodeJS.Timeout | null = null
  private readonly enCours = new Set<string>()
  /** Clic sur une notification : ouvrir la page surveillée. */
  ouvrir: (url: string) => void = () => undefined

  constructor(
    dossier: string,
    private readonly ollama: Ollama,
    private readonly reglages: () => Reglages
  ) {
    super()
    const chemin = join(dossier, 'taches.json')
    this.taches = nettoyer(lireJson(chemin))
    this.sauvegarde = new SauvegardeDifferee(chemin, () => this.taches, 500)
  }

  lister(): Tache[] {
    return this.taches
  }

  /** Vérifie chaque minute les tâches arrivées à échéance. La première passe attend un peu (démarrage du navigateur). */
  demarrer(): void {
    if (this.minuteur) return
    setTimeout(() => void this.passe(), 45_000)
    this.minuteur = setInterval(() => void this.passe(), 60_000)
  }

  arreter(): void {
    if (this.minuteur) clearInterval(this.minuteur)
    this.minuteur = null
    this.sauvegarde.vider()
  }

  creer(url: string, titre: string, d: DemandeTache): Tache | { erreur: string } {
    if (!estAdresseAutorisee(url)) return { erreur: 'Seules les pages web (http/https) peuvent être surveillées.' }
    if (this.taches.length >= MAX_TACHES) return { erreur: `Tu as déjà ${MAX_TACHES} tâches : supprimes-en une dans menu › Tâches.` }
    const maintenant = Date.now()
    const t: Tache = {
      id: randomUUID(),
      type: d.type,
      url,
      titre: titre.slice(0, 120) || new URL(url).hostname,
      creee: maintenant,
      active: true,
      intervalleMin: INTERVALLES_MIN.includes(d.intervalleMin as (typeof INTERVALLES_MIN)[number]) ? d.intervalleMin : 60,
      seuil: d.seuil,
      devise: null,
      texteGuette: d.texteGuette.slice(0, 60),
      heure: d.heure,
      derniere: null,
      // un premier relevé tout de suite (prix de départ, état de la page), sauf pour le résumé du jour
      prochaine: d.type === 'resume' ? prochaineEcheance({ type: 'resume', intervalleMin: 1440, heure: d.heure }, maintenant) : maintenant,
      historique: [],
      alerte: null
    }
    this.taches = [t, ...this.taches]
    this.changer()
    if (t.type !== 'resume') void this.executer(t.id)
    return t
  }

  modifier(id: string, p: { active?: boolean; seuil?: number | null; intervalleMin?: number; heure?: string }): void {
    const t = this.taches.find((x) => x.id === id)
    if (!t) return
    if (typeof p.active === 'boolean') t.active = p.active
    if (p.seuil === null || (typeof p.seuil === 'number' && p.seuil > 0)) t.seuil = p.seuil
    if (typeof p.intervalleMin === 'number' && INTERVALLES_MIN.includes(p.intervalleMin as (typeof INTERVALLES_MIN)[number])) t.intervalleMin = p.intervalleMin
    if (typeof p.heure === 'string' && /^\d{2}:\d{2}$/.test(p.heure)) t.heure = p.heure
    t.prochaine = prochaineEcheance(t, Date.now())
    this.changer()
  }

  supprimer(id: string): void {
    this.taches = this.taches.filter((t) => t.id !== id)
    this.changer()
  }

  /** Lance la vérification d'une tâche tout de suite (bouton « Vérifier maintenant »). */
  async executer(id: string): Promise<void> {
    const t = this.taches.find((x) => x.id === id)
    if (!t || this.enCours.has(id)) return
    this.enCours.add(id)
    try {
      const point = await this.relever(t)
      const alerte = alerteApres(t, point)
      t.historique = ajouterPoint(t, point)
      t.derniere = point.date
      t.prochaine = prochaineEcheance(t, Date.now())
      if (alerte) {
        t.alerte = { date: point.date, texte: alerte }
        this.notifier(t, alerte)
      }
    } finally {
      this.enCours.delete(id)
      this.changer()
    }
  }

  private async passe(): Promise<void> {
    const maintenant = Date.now()
    for (const t of this.taches) if (t.active && t.prochaine <= maintenant) await this.executer(t.id)
  }

  private modeleIA(): string | null {
    const etat = this.ollama.etat()
    if (etat.phase !== 'pret') return null
    const m = modeleEclair(this.reglages(), etat.modeles)
    return modelePresent(m, etat.modeles) ? m : null
  }

  private async relever(t: Tache): Promise<PointTache> {
    const date = Date.now()
    try {
      const p = await lireCloisonne(t.url)
      if (t.type === 'prix') {
        let prix = prixStructure(p.jsonld, p.metas)
        const modele = prix ? null : this.modeleIA()
        if (!prix && modele) prix = await prixParIA(modele, p).catch(() => null)
        prix ??= prixDansTexte(p.texte)
        if (!prix) return { date, erreur: 'Prix introuvable sur la page.' }
        t.devise ??= prix.devise ?? 'EUR'
        return { date, valeur: prix.valeur }
      }
      if (t.type === 'changement') {
        const comparable = texteComparable(p.texte)
        return {
          date,
          empreinte: createHash('sha256').update(comparable).digest('hex').slice(0, 16),
          ...(t.texteGuette ? { present: comparable.includes(t.texteGuette.toLowerCase()) } : {})
        }
      }
      const modele = this.modeleIA()
      if (!modele) return { date, erreur: "L'IA locale n'était pas activée : pas de résumé aujourd'hui." }
      return { date, resume: await resumeDuJour(modele, p) }
    } catch (e) {
      return { date, erreur: e instanceof Error ? e.message : 'La page n\'a pas pu être lue.' }
    }
  }

  private notifier(t: Tache, texte: string): void {
    if (!Notification.isSupported()) return
    const n = new Notification({ title: t.type === 'resume' ? `Le point du jour · ${t.titre}` : t.titre, body: texte.slice(0, 240), silent: false })
    n.on('click', () => this.ouvrir(t.url))
    n.show()
  }

  private changer(): void {
    this.sauvegarde.demander()
    this.emit('change', this.taches)
  }
}
