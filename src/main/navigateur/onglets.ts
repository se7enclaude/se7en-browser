/* Gestion des onglets : une WebContentsView par onglet, posée sur la fenêtre là où l'interface lui laisse la place.
 * Un « Nouvel onglet » ou une page interne (se7en://…) n'a pas de vue : c'est l'interface (React) qui dessine derrière.
 * Les onglets prioritaires (barre latérale) sont des onglets comme les autres, marqués et sauvegardés ;
 * au démarrage ils sont « endormis » et ne se chargent qu'à l'ouverture. */
import { WebContentsView, type BrowserWindow, type Input, type WebContents } from 'electron'
import { estAdresseAutorisee, estPageInterne, PAGES_INTERNES, resoudreSaisie } from '../../shared/adresse'
import { idDocDeVisionneuse, urlVisionneuse } from '../../shared/pdf'
import { COULEURS_GROUPES, type EtatOnglet, type EtatOnglets, type GroupeOnglets, type OngletPrioritaireSauve, type Split, type Zone, type ZoneOnglet } from '../../shared/onglets'
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
  /** Historique : chaque page visitée, puis son titre quand il arrive. */
  journal?: { visite: (url: string, titre: string) => void; titre: (url: string, titre: string) => void }
  /** PDF ouverts dans la visionneuse : adresse d'origine et nom du fichier. */
  documentPdf?: (id: string) => { url: string; nom: string } | undefined
}

const RAYON_PAGE = 13 // rayon de la zone (14) moins le liseré
const MAX_FERMES = 25

export class GestionnaireOnglets {
  private readonly onglets: Onglet[] = []
  private actifId: number | null = null
  private prochainId = 1
  /** Où l'interface place chaque onglet visible (un seul, ou deux en vue partagée). */
  private zones = new Map<number, Zone>()
  private split: Split | null = null
  private groupes: GroupeOnglets[] = []
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
    return {
      onglets: this.onglets.map((o) => ({ ...o.etat })),
      actifId: this.actifId,
      split: this.split && { ...this.split },
      groupes: this.groupes.map((g) => ({ ...g }))
    }
  }

  actif(): Onglet | undefined {
    return this.onglets.find((o) => o.etat.id === this.actifId)
  }

  /** La page web chargée dans un onglet (null pour un Nouvel onglet, une page interne ou un onglet en veille). */
  pageDe(id: number): { etat: EtatOnglet; wc: WebContents } | null {
    const o = this.trouver(id)
    if (!o?.vue || o.vue.webContents.isDestroyed() || !(estAdresseAutorisee(o.etat.url) || o.etat.pdf)) return null
    return { etat: { ...o.etat }, wc: o.vue.webContents }
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
        endormi: !!sauve,
        pdf: null,
        bloques: 0,
        groupe: null
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
    if (options.aCote && iActif >= 0 && !this.onglets[iActif].etat.prioritaire) {
      this.onglets.splice(iActif + 1, 0, onglet)
      // un lien ouvert depuis un onglet rangé va dans le même groupe
      onglet.etat.groupe = this.onglets[iActif].etat.groupe
    }
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
    if (this.split && (this.split.gauche === id || this.split.droite === id)) this.split = null
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
    this.nettoyerGroupes()
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
    o.etat.groupe = null
    this.nettoyerGroupes()
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
    // ouvrir un onglet d'un groupe replié déplie le groupe
    const groupe = this.groupes.find((g) => g.id === o.etat.groupe)
    if (groupe?.replie) groupe.replie = false
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
    // déposé au milieu d'un groupe : il en fait partie
    if (!o.etat.prioritaire) o.etat.groupe = cible.etat.groupe
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

  // ---------- bloqueur ----------

  /** Une requête de cette page a été bloquée (pub ou traqueur). */
  compterBloque(idWebContents: number): void {
    const o = this.onglets.find((x) => x.vue?.webContents.id === idWebContents)
    if (!o) return
    o.etat.bloques++
    this.signaler()
  }

  // ---------- groupes d'onglets (rangement par l'IA) ----------

  /** Onglets que l'on peut ranger : les onglets normaux qui affichent une page. */
  ongletsARanger(): { id: number; titre: string; url: string }[] {
    return this.onglets.filter((o) => !o.etat.prioritaire && o.etat.url && !estPageInterne(o.etat.url)).map((o) => ({ id: o.etat.id, titre: o.etat.titre, url: o.etat.url }))
  }

  /** Crée les groupes proposés, et range les onglets pour que chaque groupe soit d'un seul tenant. */
  appliquerGroupes(groupes: { nom: string; ids: number[] }[]): void {
    for (const o of this.onglets) if (!o.etat.prioritaire) o.etat.groupe = null
    this.groupes = []
    groupes.forEach((g, i) => {
      const membres = g.ids.map((id) => this.trouver(id)).filter((o): o is Onglet => !!o && !o.etat.prioritaire && !o.etat.groupe)
      if (membres.length < 2) return // un groupe d'un seul onglet n'aide pas
      const id = `g${Date.now().toString(36)}${i}`
      this.groupes.push({ id, nom: g.nom.trim().slice(0, 30) || 'Groupe', couleur: COULEURS_GROUPES[this.groupes.length % COULEURS_GROUPES.length], replie: false })
      for (const o of membres) o.etat.groupe = id
    })
    // ordre : prioritaires, puis chaque groupe, puis les onglets sans groupe
    const rang = (o: Onglet): number => (o.etat.prioritaire ? -1 : o.etat.groupe ? this.groupes.findIndex((g) => g.id === o.etat.groupe) : this.groupes.length)
    this.onglets.sort((a, b) => rang(a) - rang(b))
    this.signaler()
  }

  basculerGroupe(id: string): void {
    const g = this.groupes.find((x) => x.id === id)
    if (!g) return
    g.replie = !g.replie
    // replier le groupe de l'onglet actif : on passe sur un onglet visible
    const actif = this.actif()
    if (g.replie && actif?.etat.groupe === id) {
      const visible = this.onglets.find((o) => !o.etat.prioritaire && o.etat.groupe !== id)
      if (visible) this.actifId = visible.etat.id
      this.afficher()
    }
    this.signaler()
  }

  /** Retire le groupe, les onglets restent ouverts. */
  dissoudreGroupe(id: string): void {
    for (const o of this.onglets) if (o.etat.groupe === id) o.etat.groupe = null
    this.nettoyerGroupes()
    this.signaler()
  }

  fermerGroupe(id: string): void {
    for (const o of [...this.onglets]) if (o.etat.groupe === id) this.fermer(o.etat.id)
    this.nettoyerGroupes()
    this.signaler()
  }

  /** Un groupe sans onglet disparaît. */
  private nettoyerGroupes(): void {
    this.groupes = this.groupes.filter((g) => this.onglets.some((o) => o.etat.groupe === g.id))
  }

  // ---------- PDF ----------

  /** L'onglet dont la page est ce webContents (pour savoir d'où vient un téléchargement). */
  idDeWebContents(wc: WebContents): number | null {
    return this.onglets.find((o) => o.vue?.webContents === wc)?.etat.id ?? null
  }

  /** Affiche un PDF dans la visionneuse, dans cet onglet (le bouton Précédent ramène à la page d'avant). */
  afficherPdf(id: number, idDoc: string): void {
    const o = this.trouver(id)
    if (!o) return
    const vue = o.vue ?? this.creerVue(o)
    o.etat.endormi = false
    vue.webContents.loadURL(urlVisionneuse(idDoc, this.options.documentPdf?.(idDoc)?.nom)).catch(() => undefined)
    this.afficher()
    this.signaler()
  }

  /** Ouvre un PDF dans un nouvel onglet (fichier du PC, Ctrl+O). */
  ouvrirPdf(idDoc: string): void {
    this.afficherPdf(this.nouveau(), idDoc)
  }

  /** Pendant qu'un PDF se télécharge avant d'être affiché, l'onglet montre qu'il charge. */
  marquerChargement(id: number, chargement: boolean): void {
    const o = this.trouver(id)
    if (!o) return
    o.etat.chargement = chargement
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

  /** L'interface indique où poser chaque onglet visible. Une entrée mal formée est ignorée. */
  definirZones(liste: ZoneOnglet[]): void {
    const zones = new Map<number, Zone>()
    for (const entree of liste.slice(0, 2)) {
      const z = entree?.zone
      const ok = Number.isInteger(entree?.id) && [z?.x, z?.y, z?.width, z?.height].every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0)
      if (ok) zones.set(entree.id, { x: Math.round(z.x), y: Math.round(z.y), width: Math.round(z.width), height: Math.round(z.height) })
    }
    this.zones = zones
    this.afficher()
  }

  // ---------- vue partagée ----------

  /** Partage l'écran entre l'onglet actif et `avecId` (ou un Nouvel onglet). */
  diviser(avecId?: number): void {
    const actif = this.actif()
    if (!actif) return
    let autre = avecId !== undefined ? this.trouver(avecId) : undefined
    if (autre === actif) return
    if (!autre) autre = this.trouver(this.nouveau('', { activer: false, aCote: true }))
    if (!autre) return
    if (autre.etat.endormi) this.reveiller(autre)
    this.split = { gauche: actif.etat.id, droite: autre.etat.id, ratio: 0.5 }
    this.actifId = autre.etat.id
    this.afficher()
    this.signaler()
  }

  quitterSplit(): void {
    if (!this.split) return
    this.split = null
    this.signaler()
  }

  definirRatio(ratio: number): void {
    if (!this.split || !Number.isFinite(ratio)) return
    this.split.ratio = Math.min(0.8, Math.max(0.2, ratio))
    this.signaler()
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
      const zone = this.zones.get(o.etat.id)
      const visible = !!zone && zone.width > 0 && (estAdresseAutorisee(o.etat.url) || !!o.etat.pdf) && !o.etat.plantee && !this.masque
      if (visible) o.vue.setBounds(zone)
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
      // la visionneuse PDF affiche l'adresse et le nom du PDF, pas sa propre adresse interne
      const idDoc = idDocDeVisionneuse(wc.getURL())
      const doc = idDoc ? this.options.documentPdf?.(idDoc) : undefined
      o.etat.pdf = doc && idDoc ? idDoc : null
      o.etat.url = doc ? doc.url : wc.getURL() || o.etat.url
      o.etat.titre = doc ? doc.nom : wc.getTitle() || o.etat.url
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
      o.etat.bloques = 0
      o.etat.url = url
      maj()
      // l'adresse a pu passer d'un Nouvel onglet (sans page) à une page ou un PDF : la vue doit apparaître
      this.afficher()
      if (estAdresseAutorisee(o.etat.url)) this.options.journal?.visite(o.etat.url, o.etat.titre)
    })
    wc.on('did-navigate-in-page', (_e, url, principal) => {
      maj()
      if (principal && estAdresseAutorisee(url)) this.options.journal?.visite(url, wc.getTitle())
    })
    wc.on('page-title-updated', (_e, titre) => {
      maj()
      this.options.journal?.titre(wc.getURL(), titre)
    })
    // vue partagée : cliquer dans un volet en fait l'onglet actif (la barre d'adresse le suit)
    wc.on('focus', () => {
      if (this.actifId === o.etat.id || !this.split) return
      if (this.split.gauche !== o.etat.id && this.split.droite !== o.etat.id) return
      this.actifId = o.etat.id
      this.signaler()
    })
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
