/* Gestion des onglets : une WebContentsView par onglet, posée sur la fenêtre là où l'interface lui laisse la place.
 * Un onglet « Nouvel onglet » n'a pas de vue : c'est l'interface (React) qui dessine la page d'accueil derrière. */
import { WebContentsView, type BrowserWindow, type Input, type WebContents } from 'electron'
import { estAdresseAutorisee, resoudreSaisie } from '../../shared/adresse'
import type { EtatOnglet, EtatOnglets, Zone } from '../../shared/onglets'
import { preferencesPage, preparerSessionWeb } from '../securite/politiques'
import { chargerFavicon } from './favicons'

interface Onglet {
  etat: EtatOnglet
  vue: WebContentsView | null
}

export interface OptionsGestionnaire {
  /** Moteur de recherche actuel (avec %s). */
  moteur: () => string
  /** Appelé à chaque changement, avec l'état complet. */
  notifier: (etat: EtatOnglets) => void
  /** Touche pressée dans une page : renvoie vrai si c'était un raccourci du navigateur. */
  surTouche: (input: Input) => boolean
}

const RAYON_PAGE = 13 // rayon de la zone (14) moins le liseré
const MAX_FERMES = 25

export class GestionnaireOnglets {
  private readonly onglets: Onglet[] = []
  private actifId: number | null = null
  private prochainId = 1
  private zone: Zone = { x: 0, y: 0, width: 0, height: 0 }
  private readonly fermes: string[] = []
  private notification: NodeJS.Immediate | null = null

  constructor(
    private readonly fenetre: BrowserWindow,
    private readonly options: OptionsGestionnaire
  ) {
    preparerSessionWeb()
  }

  // ---------- lecture ----------

  etat(): EtatOnglets {
    return { onglets: this.onglets.map((o) => ({ ...o.etat })), actifId: this.actifId }
  }

  actif(): Onglet | undefined {
    return this.onglets.find((o) => o.etat.id === this.actifId)
  }

  // ---------- actions ----------

  /** Ouvre un onglet. `saisie` vide : Nouvel onglet ; `aCote` : juste après l'onglet actif (liens ouverts depuis une page). */
  nouveau(saisie = '', options: { activer?: boolean; aCote?: boolean } = {}): number {
    const id = this.prochainId++
    const onglet: Onglet = {
      etat: { id, url: '', titre: 'Nouvel onglet', favicon: null, chargement: false, peutReculer: false, peutAvancer: false, plantee: false },
      vue: null
    }
    const iActif = this.onglets.findIndex((o) => o.etat.id === this.actifId)
    if (options.aCote && iActif >= 0) this.onglets.splice(iActif + 1, 0, onglet)
    else this.onglets.push(onglet)
    if (options.activer !== false) this.actifId = id
    if (saisie) this.naviguer(id, saisie)
    this.afficher()
    this.signaler()
    return id
  }

  fermer(id: number): void {
    const i = this.onglets.findIndex((o) => o.etat.id === id)
    if (i < 0) return
    const [o] = this.onglets.splice(i, 1)
    if (o.etat.url) {
      this.fermes.push(o.etat.url)
      if (this.fermes.length > MAX_FERMES) this.fermes.shift()
    }
    this.detruireVue(o)
    if (this.actifId === id) {
      // comme Chrome : l'onglet de droite, sinon celui de gauche
      const voisin = this.onglets[i] ?? this.onglets[i - 1]
      this.actifId = voisin ? voisin.etat.id : null
    }
    // On ne ferme jamais la fenêtre en fermant le dernier onglet : il reste un Nouvel onglet.
    if (this.onglets.length === 0) {
      this.nouveau()
      return
    }
    this.afficher()
    this.signaler()
  }

  rouvrir(): void {
    const url = this.fermes.pop()
    if (url) this.nouveau(url)
  }

  activer(id: number): void {
    if (!this.onglets.some((o) => o.etat.id === id) || this.actifId === id) return
    this.actifId = id
    this.afficher()
    this.signaler()
  }

  /** Passe à l'onglet voisin (+1 / -1), en boucle. */
  activerVoisin(sens: 1 | -1): void {
    const n = this.onglets.length
    if (n < 2) return
    const i = this.onglets.findIndex((o) => o.etat.id === this.actifId)
    this.activer(this.onglets[(i + sens + n) % n].etat.id)
  }

  activerNumero(index: number): void {
    const o = index < 0 ? this.onglets.at(-1) : this.onglets[index]
    if (o) this.activer(o.etat.id)
  }

  deplacer(id: number, index: number): void {
    const i = this.onglets.findIndex((o) => o.etat.id === id)
    if (i < 0) return
    const cible = Math.max(0, Math.min(this.onglets.length - 1, Math.trunc(index)))
    const [o] = this.onglets.splice(i, 1)
    this.onglets.splice(cible, 0, o)
    this.signaler()
  }

  naviguer(id: number, saisie: string): void {
    const o = this.trouver(id)
    if (!o) return
    const url = resoudreSaisie(saisie, this.options.moteur())
    if (!url || !estAdresseAutorisee(url)) return
    const vue = o.vue ?? this.creerVue(o)
    o.etat.url = url
    o.etat.plantee = false
    vue.webContents.loadURL(url).catch(() => undefined) // les erreurs de chargement s'affichent dans la page
    this.afficher()
    this.signaler()
  }

  precedent(id: number): void {
    const h = this.trouver(id)?.vue?.webContents.navigationHistory
    if (h?.canGoBack()) h.goBack()
  }

  suivant(id: number): void {
    const h = this.trouver(id)?.vue?.webContents.navigationHistory
    if (h?.canGoForward()) h.goForward()
  }

  actualiser(id: number, forcer = false): void {
    const o = this.trouver(id)
    if (!o?.vue) return
    o.etat.plantee = false
    if (forcer) o.vue.webContents.reloadIgnoringCache()
    else o.vue.webContents.reload()
    this.afficher()
  }

  arreter(id: number): void {
    this.trouver(id)?.vue?.webContents.stop()
  }

  definirZone(z: Zone): void {
    const ok = [z?.x, z?.y, z?.width, z?.height].every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0)
    if (!ok) return
    this.zone = { x: Math.round(z.x), y: Math.round(z.y), width: Math.round(z.width), height: Math.round(z.height) }
    this.afficher()
  }

  focusPage(): void {
    this.actif()?.vue?.webContents.focus()
  }

  // ---------- interne ----------

  private trouver(id: number): Onglet | undefined {
    return this.onglets.find((o) => o.etat.id === id)
  }

  /** Seule la vue de l'onglet actif est visible, à la place exacte que l'interface lui réserve. */
  private afficher(): void {
    for (const o of this.onglets) {
      if (!o.vue) continue
      const visible = o.etat.id === this.actifId && !!o.etat.url && !o.etat.plantee && this.zone.width > 0
      if (visible) o.vue.setBounds(this.zone)
      o.vue.setVisible(visible)
    }
  }

  /** Regroupe les notifications d'un même tour (un chargement en déclenche plusieurs d'affilée). */
  private signaler(): void {
    if (this.notification) return
    this.notification = setImmediate(() => {
      this.notification = null
      if (!this.fenetre.isDestroyed()) this.options.notifier(this.etat())
    })
  }

  private creerVue(o: Onglet): WebContentsView {
    const vue = new WebContentsView({ webPreferences: preferencesPage() })
    vue.setBorderRadius(RAYON_PAGE)
    vue.setBackgroundColor('#ffffff')
    vue.setVisible(false)
    this.fenetre.contentView.addChildView(vue)
    o.vue = vue
    this.brancher(o, vue.webContents)
    return vue
  }

  private detruireVue(o: Onglet): void {
    if (!o.vue) return
    this.fenetre.contentView.removeChildView(o.vue)
    o.vue.webContents.close()
    o.vue = null
  }

  private brancher(o: Onglet, wc: WebContents): void {
    const maj = (): void => {
      o.etat.url = wc.getURL() || o.etat.url
      o.etat.titre = wc.getTitle() || o.etat.url
      o.etat.peutReculer = wc.navigationHistory.canGoBack()
      o.etat.peutAvancer = wc.navigationHistory.canGoForward()
      this.signaler()
    }

    wc.on('did-start-loading', () => {
      o.etat.chargement = true
      maj()
    })
    wc.on('did-stop-loading', () => {
      o.etat.chargement = false
      maj()
    })
    wc.on('did-navigate', (_e, url) => {
      o.etat.favicon = null
      o.etat.url = url
      maj()
    })
    wc.on('did-navigate-in-page', maj)
    wc.on('page-title-updated', maj)
    wc.on('page-favicon-updated', async (_e, urls) => {
      const pageAuMoment = wc.getURL()
      const icone = await chargerFavicon(wc.session, urls)
      if (wc.isDestroyed() || wc.getURL() !== pageAuMoment) return
      o.etat.favicon = icone
      this.signaler()
    })
    wc.on('render-process-gone', (_e, details) => {
      if (details.reason === 'clean-exit') return
      o.etat.plantee = true
      o.etat.chargement = false
      this.afficher()
      this.signaler()
    })

    // Une page ne peut naviguer que vers http(s) ; le reste (file:, protocoles d'applis…) est bloqué.
    wc.on('will-navigate', (e, url) => {
      if (!estAdresseAutorisee(url)) e.preventDefault()
    })
    wc.on('will-redirect', (e, url) => {
      if (!estAdresseAutorisee(url)) e.preventDefault()
    })

    // window.open et liens target=_blank : nouvel onglet à côté, jamais de nouvelle fenêtre.
    wc.setWindowOpenHandler(({ url, disposition }) => {
      if (estAdresseAutorisee(url)) this.nouveau(url, { aCote: true, activer: disposition !== 'background-tab' })
      return { action: 'deny' }
    })

    wc.on('before-input-event', (e, input) => {
      if (this.options.surTouche(input)) e.preventDefault()
    })
  }
}
