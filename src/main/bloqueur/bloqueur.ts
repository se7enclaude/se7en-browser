/* Bloqueur de publicités et de traqueurs.
 * Moteur de filtres de Ghostery (listes EasyList, EasyPrivacy… préparées par Ghostery), utilisé seul :
 * le blocage se fait au niveau du réseau, sans injecter le moindre script dans les pages.
 * Les listes sont téléchargées une fois puis gardées en cache sur le PC (renouvelées chaque semaine) ;
 * l'ancien cache reste utilisé tant que les nouvelles listes ne sont pas arrivées (hors-ligne, le blocage continue). */
import { net, type Session } from 'electron'
import { EventEmitter } from 'node:events'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { FiltersEngine, Request } from '@ghostery/adblocker'
import type { InfoBloqueurMaj } from '../../shared/composants'
import { lireJson, ecrireJson } from '../stockage/fichierJson'
import { renouvelerMoteur } from './renouvellement'

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

export class Bloqueur extends EventEmitter<{ bloque: [idWebContents: number]; infos: [InfoBloqueurMaj] }> {
  private moteur: FiltersEngine | null = null
  private readonly cache: string
  private readonly fichierInfos: string
  private i: InfoBloqueurMaj
  private enCours: Promise<void> | null = null

  constructor(dossier: string) {
    super()
    this.cache = join(dossier, 'bloqueur', 'moteur.bin')
    this.fichierInfos = join(dossier, 'bloqueur', 'maj.json')
    const brut = lireJson(this.fichierInfos) as Partial<InfoBloqueurMaj> | undefined
    const date = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)
    this.i = { listes: date(brut?.listes), essai: date(brut?.essai) }
  }

  get pret(): boolean {
    return this.moteur !== null
  }

  infos(): InfoBloqueurMaj {
    return this.i
  }

  /** Charge le moteur depuis le cache (tout de suite), puis renouvelle les listes si elles ont plus d'une semaine. */
  async charger(): Promise<void> {
    try {
      const octets = await fs.readFile(this.cache)
      this.moteur = FiltersEngine.deserialize(octets)
      // cache d'une version précédente (sans maj.json) : sa date est celle du fichier
      if (!this.i.listes) this.i = { ...this.i, listes: (await fs.stat(this.cache)).mtimeMs }
    } catch {
      /* pas de cache, ou cache illisible : on télécharge */
    }
    await this.renouveler()
  }

  /** Télécharge de nouvelles listes si elles sont périmées ; en cas d'échec, l'ancien moteur continue de bloquer. */
  renouveler(): Promise<void> {
    this.enCours ??= this.renouvelerMaintenant().finally(() => (this.enCours = null))
    return this.enCours
  }

  private async renouvelerMaintenant(): Promise<void> {
    const r = await renouvelerMoteur<FiltersEngine>({
      actuel: this.moteur,
      listes: this.i.listes,
      maintenant: Date.now(),
      telecharger: () => FiltersEngine.fromPrebuiltAdsAndTracking((url) => net.fetch(url as string)),
      enregistrer: async (m) => {
        await fs.mkdir(join(this.cache, '..'), { recursive: true })
        const tmp = `${this.cache}.tmp`
        await fs.writeFile(tmp, m.serialize())
        await fs.rename(tmp, this.cache)
      }
    })
    this.moteur = r.moteur
    if (!r.renouvele && !r.echec && this.i.listes === r.listes) return // déjà à jour : rien à noter
    this.i = { listes: r.listes, essai: Date.now() }
    void ecrireJson(this.fichierInfos, this.i).catch(() => undefined)
    this.emit('infos', this.i)
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
