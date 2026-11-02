/* Bloqueur de publicités et de traqueurs.
 * Moteur de filtres de Ghostery (listes EasyList, EasyPrivacy… préparées par Ghostery), utilisé seul :
 * le blocage se fait au niveau du réseau, sans injecter le moindre script dans les pages.
 * Les listes sont téléchargées une fois puis gardées en cache sur le PC (renouvelées chaque semaine). */
import { net, type Session } from 'electron'
import { EventEmitter } from 'node:events'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { FiltersEngine, Request } from '@ghostery/adblocker'

const RENOUVELLEMENT = 7 * 24 * 3600 * 1000

/** Nom d'hôte sans « www. », pour les exceptions par site. */
export function hoteDe(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** Le site (ou l'un de ses domaines parents) est-il dans les exceptions ? « m.exemple.fr » suit « exemple.fr ». */
export function estException(hote: string, exceptions: string[]): boolean {
  return exceptions.some((e) => hote === e || hote.endsWith(`.${e}`))
}

export class Bloqueur extends EventEmitter<{ bloque: [idWebContents: number] }> {
  private moteur: FiltersEngine | null = null
  private readonly cache: string

  constructor(dossier: string) {
    super()
    this.cache = join(dossier, 'bloqueur', 'moteur.bin')
  }

  get pret(): boolean {
    return this.moteur !== null
  }

  /** Charge le moteur (cache, sinon téléchargement des listes). Le navigateur fonctionne pendant ce temps, sans blocage. */
  async charger(): Promise<void> {
    try {
      const st = await fs.stat(this.cache).catch(() => null)
      if (st && Date.now() - st.mtimeMs > RENOUVELLEMENT) await fs.rm(this.cache, { force: true })
      await fs.mkdir(join(this.cache, '..'), { recursive: true })
      this.moteur = await FiltersEngine.fromPrebuiltAdsAndTracking((url) => net.fetch(url as string), {
        path: this.cache,
        read: (p) => fs.readFile(p),
        write: (p, octets) => fs.writeFile(p, octets)
      })
    } catch {
      this.moteur = null // pas de réseau au premier lancement : on réessaiera au prochain démarrage
    }
  }

  /**
   * Bloque les requêtes des pages (jamais la page elle-même). `actif` et `exceptions` sont relus à chaque requête :
   * un changement de réglage s'applique tout de suite.
   */
  brancher(session: Session, actif: () => boolean, exceptions: () => string[]): void {
    session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (details, rappel) => {
      const moteur = this.moteur
      if (!moteur || !actif() || details.resourceType === 'mainFrame') return rappel({})
      const source = details.webContents?.getURL() || details.referrer || ''
      if (estException(hoteDe(source), exceptions())) return rappel({})
      const { match, redirect } = moteur.match(
        Request.fromRawDetails({ url: details.url, sourceUrl: source, type: details.resourceType as never })
      )
      if (!match && !redirect) return rappel({})
      if (details.webContents) this.emit('bloque', details.webContents.id)
      // certaines règles remplacent un script par une version neutre (pour ne pas casser la page)
      if (redirect?.dataUrl) return rappel({ redirectURL: redirect.dataUrl })
      rappel({ cancel: true })
    })
  }
}
