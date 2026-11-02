/* Téléchargements : enregistrés directement dans le dossier Téléchargements de Windows, sans fenêtre à chaque fois.
 * Chaque fichier reçoit la « marque du web » (Zone.Identifier) : Windows SmartScreen le contrôle avant de l'ouvrir. */
import { app, shell, type DownloadItem, type Session } from 'electron'
import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { existsSync, promises as fs } from 'node:fs'
import { basename, extname, join } from 'node:path'
import type { ActionTelechargement, Telechargement } from '../../shared/donnees'
import { ecrireJson, lireJson } from '../stockage/fichierJson'

const MAX = 200

/** Nom de fichier sûr sous Windows : sans caractères interdits, sans nom réservé, sans chemin. */
export function nomDeFichierSur(nom: string): string {
  // dernier morceau après / ou \ (pas basename : sous Windows il prendrait « a: » pour un lecteur)
  let n = (nom.split(/[/\\]/).pop() ?? '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/, '')
    .trim()
  if (!n) n = 'telechargement'
  if (/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(n)) n = `_${n}`
  return n.slice(0, 200)
}

/** « rapport.pdf » → « rapport (1).pdf » si le fichier existe déjà. */
export function cheminLibre(dossier: string, nom: string, existe: (p: string) => boolean = existsSync): string {
  const ext = extname(nom)
  const base = nom.slice(0, nom.length - ext.length)
  let chemin = join(dossier, nom)
  for (let i = 1; existe(chemin) && i < 1000; i++) chemin = join(dossier, `${base} (${i})${ext}`)
  return chemin
}

export class Telechargements extends EventEmitter<{ change: [Telechargement[]] }> {
  private liste: Telechargement[]
  private readonly items = new Map<string, DownloadItem>()
  private readonly chemin: string
  private minuteur: NodeJS.Timeout | null = null
  /** Chemins déjà promis à un téléchargement en cours (deux fichiers du même nom en même temps). */
  private readonly reserves = new Set<string>()

  constructor(dossier: string) {
    super()
    this.chemin = join(dossier, 'telechargements.json')
    const brut = lireJson(this.chemin)
    this.liste = (Array.isArray(brut) ? (brut as Telechargement[]) : [])
      .filter((t) => t && typeof t.id === 'string' && typeof t.chemin === 'string')
      // un téléchargement en cours à la fermeture n'a pas pu finir
      .map((t) => (t.etat === 'en-cours' || t.etat === 'en-pause' ? { ...t, etat: 'interrompu' as const } : t))
  }

  lire(): Telechargement[] {
    return this.liste
  }

  brancher(session: Session): void {
    session.on('will-download', (_e, item) => this.nouveau(item))
  }

  private nouveau(item: DownloadItem): void {
    const id = randomUUID()
    const chemin = cheminLibre(app.getPath('downloads'), nomDeFichierSur(item.getFilename()), (p) => existsSync(p) || this.reserves.has(p))
    this.reserves.add(chemin)
    item.setSavePath(chemin)
    const t: Telechargement = {
      id,
      nom: basename(chemin),
      url: item.getURL(),
      chemin,
      recus: 0,
      total: item.getTotalBytes(),
      etat: 'en-cours',
      date: Date.now()
    }
    this.items.set(id, item)
    this.liste = [t, ...this.liste].slice(0, MAX)
    this.changer(true)

    item.on('updated', (_e, etat) => {
      t.recus = item.getReceivedBytes()
      t.total = item.getTotalBytes()
      t.etat = etat === 'interrupted' ? 'interrompu' : item.isPaused() ? 'en-pause' : 'en-cours'
      this.changer(false)
    })
    item.once('done', (_e, etat) => {
      this.items.delete(id)
      this.reserves.delete(chemin)
      t.recus = item.getReceivedBytes()
      t.etat = etat === 'completed' ? 'termine' : etat === 'cancelled' ? 'annule' : 'interrompu'
      if (t.etat === 'termine') void marquerDuWeb(chemin, t.url)
      this.changer(true)
    })
  }

  action(id: string, action: ActionTelechargement): void {
    const t = this.liste.find((x) => x.id === id)
    if (!t) return
    const item = this.items.get(id)
    switch (action) {
      case 'annuler':
        item?.cancel()
        break
      case 'pause':
        item?.pause()
        break
      case 'reprendre':
        if (item?.canResume()) item.resume()
        break
      case 'ouvrir':
        // seulement à la demande de l'utilisateur, et seulement un fichier fini qui existe encore
        if (t.etat === 'termine' && existsSync(t.chemin)) void shell.openPath(t.chemin)
        break
      case 'montrer':
        if (existsSync(t.chemin)) shell.showItemInFolder(t.chemin)
        else void shell.openPath(app.getPath('downloads'))
        break
      case 'retirer':
        if (item) return // on ne retire pas de la liste un téléchargement en cours
        this.liste = this.liste.filter((x) => x !== t)
        this.changer(true)
        break
    }
  }

  /** Vide la liste (les fichiers restent sur le disque). */
  effacer(): void {
    this.liste = this.liste.filter((t) => this.items.has(t.id))
    this.changer(true)
  }

  /** Les mises à jour de progression sont regroupées (4 par seconde au plus). */
  private changer(immediat: boolean): void {
    const envoyer = (): void => {
      this.minuteur = null
      this.emit('change', this.liste)
      void ecrireJson(this.chemin, this.liste).catch(() => undefined)
    }
    if (immediat) {
      if (this.minuteur) clearTimeout(this.minuteur)
      envoyer()
    } else if (!this.minuteur) this.minuteur = setTimeout(envoyer, 250)
  }
}

/** Ajoute la marque « venu d'Internet » (zone 3), comme Edge et Chrome. */
async function marquerDuWeb(chemin: string, url: string): Promise<void> {
  if (process.platform !== 'win32') return
  const source = /^https?:\/\//.test(url) ? `\r\nHostUrl=${url.split('#')[0]}` : ''
  try {
    await fs.writeFile(`${chemin}:Zone.Identifier`, `[ZoneTransfer]\r\nZoneId=3${source}\r\n`)
  } catch {
    /* disque non NTFS (clé USB en FAT32…) : pas de marque possible */
  }
}
