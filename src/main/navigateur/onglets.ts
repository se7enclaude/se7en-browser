/* Gestion des onglets : une WebContentsView par onglet, posée sur la fenêtre là où l'interface lui laisse la place.
 * Un « Nouvel onglet » ou une page interne (se7en://…) n'a pas de vue : c'est l'interface (React) qui dessine derrière.
 * Les onglets prioritaires (barre latérale) sont des onglets comme les autres, marqués et sauvegardés ;
 * au démarrage ils sont « endormis » et ne se chargent qu'à l'ouverture. */
import { WebContentsView, type BrowserWindow, type Input, type WebContents } from 'electron'
import { estAdresseAutorisee, estPageInterne, PAGES_INTERNES, resoudreSaisie } from '../../shared/adresse'
import type { EtatOnglet, EtatOnglets, OngletPrioritaireSauve, Zone } from '../../shared/onglets'
import { preferencesPage, preparerSessionWeb } from '../securite/politiques'
import { chargerFavicon } from './favicons'

interface Onglet {
  etat: EtatOnglet
  vue: WebContentsView | null
  /** Adresse d'origine d'un onglet prioritaire : il y revient quand on le met en veille. */
  urlEpinglee: string | null
}

export interface OptionsGestionnaire {
  /** Moteur de recherche actuel (avec %s). */
  moteur: () => string
  /** Appelé à chaque changement, avec l'état complet. */
  notifier: (etat: EtatOnglets) => void
  /** Touche pressée dans une page : renvoie vrai si c'était un raccourci du navigateur. */
  surTouche: (input: Input) => boolean
  /** Appelé quand la liste des onglets prioritaires change, pour la sauvegarder. */
  sauverPrioritaires: (liste: OngletPrioritaireSauve[]) => void
}

const RAYON_PAGE = 13 // rayon de la zone (14) moins le liseré
const MAX_FERMES = 25

export class GestionnaireOnglets {
  private readonly onglets: Onglet[] = []
  private actifId: number | null = null
  private prochainId = 1
  private zone: Zone = { x: 0, y: 0, width: 0, height: 0 }
  /** Vrai quand un écran de l'interface (accueil…) doit passer par-dessus les pages. */
  private masque = false
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

  // ---------- création ----------

  private creer(prioritaire: boolean, sauve?: OngletPrioritaireSauve): Onglet {
    return {
      etat: {
        id: this.prochainId++,
        url: sauve?.url ?? '',
        titre: sauve?.titre || 'Nouvel onglet',
        favicon: sauve?.favicon ?? null,
        chargement: false,
        peutReculer: false,
        peutAvancer: false,
        plantee: false,
        prioritaire,
        endormi: !!sauve
      },
      vue: null,
      urlEpinglee: sauve?.url ?? null
    }
  }

  /** Remet les onglets prioritaires de la session précédente, endormis. */
  restaurerPrioritaires(liste: OngletPrioritaireSauve[]): void {
    for (const s of liste) {
      if (!estAdresseAutorisee(s.url) && !estPageInterne(s.url)) continue
      this.onglets.push(this.creer(true, s))
    }
    this.signaler()
  }

  /** Ouvre un onglet. `saisie` vide : Nouvel onglet ; `aCote` : juste après l'onglet actif (liens ouverts depuis une page). */
  nouveau(saisie = '', options: { activer?: boolean; aCote?: boolean } = {}): number {
    const onglet = this.creer(false)
    const iActif = this.onglets.findIndex((o) => o.etat.id === this.actifId)
    if (options.aCote && iActif >= 0 && !this.onglets[iActif].etat.prioritaire) this.onglets.splice(iActif + 1, 0, onglet)
    else this.onglets.push(onglet)
    if (options.activer !== false) this.actifId = onglet.etat.id
    if (saisie) this.naviguer(onglet.etat.id, saisie)
    this.afficher()
    this.signaler()
    return onglet.etat.id
  }

  /** Ouvre une page interne, ou revient sur l'onglet qui l'affiche déjà. */
  ouvrirInterne(url: keyof typeof PAGES_INTERNES): void {
    const existant = this.onglets.find((o) => o.etat.url === url)
    if (existant) this.activer(existant.etat.id)
    else this.nouveau(url)
  }

  dupliquer(id: number): void {
    const o = this.trouver(id)
    if (o?.etat.url) this.nouveau(o.etat.url, { aCote: true })
  }

  // ---------- fermeture ----------

  fermer(id: number): void {
    const o = this.trouver(id)
    if (!o) return
    // Un onglet prioritaire ne disparaît pas : il se met en veille et revient à son adresse d'origine.
    if (o.etat.prioritaire) {
      this.endormir(o)
      if (this.actifId === id) this.activerApresFermeture(-1)
      this.afficher()
      this.signaler()
      return
    }
    const i = this.onglets.indexOf(o)
    this.onglets.splice(i, 1)
    if (o.etat.url && !estPageInterne(o.etat.url)) {
      this.fermes.push(o.etat.url)
      if (this.fermes.length > MAX_FERMES) this.fermes.shift()
    }
    this.detruireVue(o)
    if (this.actifId === id) this.activerApresFermeture(i)
    this.afficher()
    this.signaler()
  }

  fermerAutres(id: number): void {
    for (const o of [...this.onglets]) if (o.etat.id !== id && !o.etat.prioritaire) this.fermer(o.etat.id)
    this.activer(id)
  }

  /** Après fermeture de l'onglet actif : comme Chrome, l'onglet normal de droite, sinon celui de gauche ;
   * s'il n'en reste aucun, un Nouvel onglet (la fenêtre ne se ferme jamais ainsi). */
  private activerApresFermeture(indexFerme: number): void {
    const normaux = this.onglets.filter((o) => !o.etat.prioritaire)
    const droite = indexFerme >= 0 ? this.onglets.slice(indexFerme).find((o) => !o.etat.prioritaire) : undefined
    const voisin = droite ?? normaux.at(-1)
    if (voisin) this.actifId = voisin.etat.id
    else {
      this.actifId = null
      this.nouveau()
    }
  }

  rouvrir(): void {
    const url = this.fermes.pop()
    if (url) this.nouveau(url)
  }

  // ---------- onglets prioritaires ----------

  /** Épingle (ou retire) un onglet de la barre latérale. */
  definirPrioritaire(id: number, prioritaire: boolean): void {
    const o = this.trouver(id)
    if (!o || o.etat.prioritaire === prioritaire) return
    if (prioritaire && !o.etat.url) return // un Nouvel onglet vide ne s'épingle pas
    o.etat.prioritaire = prioritaire
    o.urlEpinglee = prioritaire ? o.etat.url : null
    o.etat.endormi = false
    // il passe en fin de sa nouvelle liste
    this.onglets.splice(this.onglets.indexOf(o), 1)
    this.onglets.push(o)
    this.sauverPrioritaires()
    this.signaler()
  }

  private endormir(o: Onglet): void {
    this.detruireVue(o)
    o.etat.url = o.urlEpinglee ?? o.etat.url
    Object.assign(o.etat, { chargement: false, peutReculer: false, peutAvancer: false, plantee: false, endormi: true })
  }

  private sauverPrioritaires(): void {
    this.options.sauverPrioritaires(
      this.onglets
        .filter((o) => o.etat.prioritaire)
        .map((o) => ({ url: o.urlEpinglee ?? o.etat.url, titre: o.etat.titre, favicon: o.etat.favicon }))
    )
  }

  // ---------- activation ----------

  activer(id: number): void {
    const o = this.trouver(id)
    if (!o) return
    const reveil = o.etat.endormi
    if (reveil) this.reveiller(o)
    if (this.actifId === id && !reveil) return
    this.actifId = id
    this.afficher()
    this.signaler()
  }

  private reveiller(o: Onglet): void {
    o.etat.endormi = false
    if (estAdresseAutorisee(o.etat.url)) this.charger(o, o.etat.url)
  }

  /** Passe à l'onglet voisin (+1 / -1), en boucle, dans l'ordre affiché : prioritaires puis normaux. */
  activerVoisin(sens: 1 | -1): void {
    const ordre = this.ordreAffiche()
    const n = ordre.length
    if (n < 2) return
    const i = ordre.findIndex((o) => o.etat.id === this.actifId)
    this.activer(ordre[(i + sens + n) % n].etat.id)
  }

  /** Ctrl+1…8 : parmi les onglets normaux ; Ctrl+9 : le dernier. */
  activerNumero(index: number): void {
    const normaux = this.onglets.filter((o) => !o.etat.prioritaire)
    const o = index < 0 ? normaux.at(-1) : normaux[index]
    if (o) this.activer(o.etat.id)
  }

  private ordreAffiche(): Onglet[] {
    return [...this.onglets.filter((o) => o.etat.prioritaire), ...this.onglets.filter((o) => !o.etat.prioritaire)]
  }

  /** Déplace un onglet à la place d'un autre (glisser-déposer). Glisser sur un onglet de l'autre liste change de liste. */
  deplacer(id: number, versId: number): void {
    const o = this.trouver(id)
    const cible = this.trouver(versId)
    if (!o || !cible || o === cible) return
    if (o.etat.prioritaire !== cible.etat.prioritaire) this.definirPrioritaire(id, cible.etat.prioritaire)
    const iO = this.onglets.indexOf(o)
    const iCible = this.onglets.indexOf(cible)
    this.onglets.splice(iO, 1)
    this.onglets.splice(iCible, 0, o)
    if (o.etat.prioritaire) this.sauverPrioritaires()
    this.signaler()
  }

  // ---------- navigation ----------

  naviguer(id: number, saisie: string): void {
    const o = this.trouver(id)
    if (!o) return
    const url = resoudreSaisie(saisie, this.options.moteur())
    if (estPageInterne(url)) {
      this.detruireVue(o)
      Object.assign(o.etat, { url, titre: PAGES_INTERNES[url], favicon: null, chargement: false, peutReculer: false, peutAvancer: false })
    } else if (estAdresseAutorisee(url)) {
      o.etat.endormi = false
      this.charger(o, url)
    } else return
    this.afficher()
    this.signaler()
  }

  private charger(o: Onglet, url: string): void {
    const vue = o.vue ?? this.creerVue(o)
    o.etat.url = url
    o.etat.plantee = false
    vue.webContents.loadURL(url).catch(() => undefined) // les erreurs de chargement s'affichent dans la page
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

  // ---------- affichage ----------

  definirZone(z: Zone): void {
    const ok = [z?.x, z?.y, z?.width, z?.height].every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0)
    if (!ok) return
    this.zone = { x: Math.round(z.x), y: Math.round(z.y), width: Math.round(z.width), height: Math.round(z.height) }
    this.afficher()
  }

  definirMasque(masque: boolean): void {
    this.masque = masque
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
      const visible =
        o.etat.id === this.actifId && estAdresseAutorisee(o.etat.url) && !o.etat.plantee && !this.masque && this.zone.width > 0
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
      if (o.vue?.webContents !== wc) return // vue remplacée entre-temps
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
      // le titre et l'icône d'un onglet prioritaire sont gardés pour la prochaine session
      if (o.etat.prioritaire) this.sauverPrioritaires()
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

    // Une page ne peut naviguer que vers http(s) ; le reste (file:, se7en:, protocoles d'applis…) est bloqué.
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
