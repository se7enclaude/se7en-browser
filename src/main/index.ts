/* Point d'entrée du processus principal de se7en Browser. */
import { app, BrowserWindow, dialog, nativeTheme, Notification, session } from 'electron'
import { CANAUX } from '../shared/ipc'
import { idDocDeVisionneuse } from '../shared/pdf'
import { DocumentsPdf } from './pdf/documents'
import { ServiceFormulaire } from './pdf/serviceFormulaire'
import { CoffreChiffre } from './coffre/coffre'
import { brancherProtocolePdf, declarerProtocolePdf, redirigerPdfVersVisionneuse } from './pdf/protocole'
import { TraducteurPages } from './ia/traduction'
import { brancherMenusVerre } from './navigateur/menuVerre'
import { Plantages } from './plantages'
import { NotifMessages } from './social/notifMessages'
import { LARGEUR_DISCUSSION, MiniDiscussion } from './social/miniDiscussion'
import { Ensemble } from './social/ensemble'
import { Vpn } from './vpn'
import { preparerWidevine } from './widevine'
import { creerFenetrePrincipale, appliquerTheme } from './fenetre/fenetrePrincipale'
import { ServiceChat } from './ia/chat'
import { Conversations, Skills } from './ia/conversations'
import { sessionAgent } from './agent/lecteur'
import { ServiceTaches } from './taches'
import { ServiceExtensions } from './extensions/extensions'
import { ServeurMcp } from './agent/mcp'
import { ServiceSync } from './sync/sync'
import { ServiceRecherche } from './agent/recherche'
import { questionDeRecherche } from '../shared/recherche'
import { comprendreDemandeTache, confirmationTache } from '../shared/taches'
import { Ollama } from './ia/ollama'
import { Memoire } from './ia/memoire'
import { proposerGroupes } from './ia/rangement'
import { Bloqueur } from './bloqueur/bloqueur'
import { modeleEclair, modelePresent } from '../shared/ia'
import { analyserPage } from './securite/antiPhishing'
import { avisPhishing } from './ia/eclair'
import { hoteDe } from './bloqueur/bloqueur'
import { enregistrerIpc } from './ipc/enregistrer'
import { creerGestionRaccourcis } from './navigateur/commandes'
import { GestionnaireOnglets } from './navigateur/onglets'
import { Telechargements } from './navigateur/telechargements'
import { durcirApplication, PARTITION_PRIVEE, PARTITION_WEB } from './securite/politiques'
import { Favoris } from './stockage/favoris'
import { Historique } from './stockage/historique'
import { MagasinPrioritaires } from './stockage/prioritaires'
import { MagasinSessions } from './stockage/sessions'
import { MagasinReglages } from './stockage/reglages'
import { ClientSocial } from './social/client'
import { AssistantEcriture } from './ia/ecriture'
import { MemoireNavigation } from './ia/memoireNavigation'
import { MiseAJour } from './miseAJour'
import { fusionnerReglages, migrerReglages, REGLAGES_DEFAUT } from '../shared/reglages'
import { liensDesArguments } from './navigateurDefaut'
import { lireJson } from './stockage/fichierJson'
import { ServiceComposants } from './composants'
import { join } from 'node:path'
import { lirePage } from './ia/lecturePage'
import { estAdresseAutorisee } from '../shared/adresse'
import { ouvrirMenuPage } from './navigateur/menuPage'
import { SERVEUR_SOCIAL_OFFICIEL, type CibleSocial, type MessageSocial } from '../shared/social'

app.setAppUserModelId('se7en.browser')

// Les sites voient un Chrome ordinaire : certains services de streaming refusent les navigateurs « Electron » inconnus.
app.userAgentFallback = app.userAgentFallback.replace(/ (se7en\S*|Electron)\/\S+/gi, '')

// Défilement doux dans les pages, à la molette comme au pavé tactile (le même que Microsoft Edge :
// glissement animé, et une distance proportionnelle à la hauteur de la page).
app.commandLine.appendSwitch('enable-smooth-scrolling')
app.commandLine.appendSwitch('enable-features', 'WindowsScrollingPersonality,PercentBasedScrolling')

// Mode test (développement) : profil à part, pour ne jamais toucher aux réglages ni aux onglets de l'utilisateur.
if (process.env.SE7EN_PROFIL_TEST) app.setPath('userData', process.env.SE7EN_PROFIL_TEST)

// Accélération graphique : désactivable dans les Paramètres (stream Discord d'une vidéo protégée qui sort en noir).
// Elle se décide avant le démarrage, d'où la lecture directe du fichier de réglages ; changer demande un redémarrage.
if (!fusionnerReglages(REGLAGES_DEFAUT, migrerReglages(lireJson(join(app.getPath('userData'), 'reglages.json')))).accelerationGraphique) app.disableHardwareAcceleration()

// Une seule instance : relancer l'appli remet la fenêtre existante au premier plan.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  durcirApplication()
  // rapports de plantage : gardés sur ce PC, visibles dans les Paramètres
  const plantages = new Plantages((wc) => BrowserWindow.getAllWindows().some((f) => f.webContents === wc))
  app.whenReady().then(() => plantages.demarrer())
  // menus en verre : l'interface renvoie l'entrée choisie
  brancherMenusVerre((wc) => BrowserWindow.getAllWindows().some((f) => f.webContents === wc))
  declarerProtocolePdf()
  const onglets = new Map<number, GestionnaireOnglets>()
  /** Ouvre les liens et PDF passés en argument (navigateur par défaut) ; prêt une fois la fenêtre créée. */
  let ouvrirArguments: ((argv: string[]) => boolean) | null = null

  app.on('second-instance', (_e, argv) => {
    const f = BrowserWindow.getAllWindows()[0]
    if (!f) return
    if (f.isMinimized()) f.restore()
    f.focus()
    ouvrirArguments?.(argv)
  })

  app.whenReady().then(() => {
    // vidéos protégées (Crunchyroll, Netflix…) : Widevine, préparé en arrière-plan
    preparerWidevine()
    const dossier = app.getPath('userData')
    const reglages = new MagasinReglages(dossier)
    appliquerTheme(reglages.get().theme)
    const prioritaires = new MagasinPrioritaires(dossier)
    const sessionsSauvees = new MagasinSessions(dossier)
    const historique = new Historique(dossier)
    const favoris = new Favoris(dossier)
    const sessionWeb = session.fromPartition(PARTITION_WEB)
    const sessionPrivee = session.fromPartition(PARTITION_PRIVEE)
    const telechargements = new Telechargements(dossier)
    telechargements.brancher(sessionWeb)
    telechargements.brancher(sessionPrivee)

    // PDF : affichés dans la visionneuse isolée (protocole se7en-pdf://) au lieu d'être téléchargés
    const documents = new DocumentsPdf()
    for (const s of [sessionWeb, sessionPrivee]) {
      brancherProtocolePdf(s, documents)
      redirigerPdfVersVisionneuse(s)
    }

    // bloqueur de pubs et de traqueurs (au niveau du réseau, sans script injecté dans les pages)
    const bloqueur = new Bloqueur(dossier)
    for (const s of [sessionWeb, sessionPrivee]) bloqueur.brancher(s, () => reglages.get().bloqueur, () => reglages.get().bloqueurExceptions)
    bloqueur.on('bloque', (idWc) => [...onglets.values()][0]?.compterBloque(idWc))
    void bloqueur.charger()
    app.on('will-quit', () => documents.vider())

    // VPN gratuit (réseau Tor) : arrêté au lancement, l'utilisateur l'active quand il veut
    const vpn = new Vpn(dossier, [sessionWeb, sessionPrivee])
    telechargements.intercepteur = (item, wc) => {
      const estPdf = item.getMimeType() === 'application/pdf' || /\.pdf$/i.test(item.getFilename())
      // « Enregistrer » depuis la visionneuse : un vrai téléchargement, dans le dossier Téléchargements
      if (!estPdf || !wc || idDocDeVisionneuse(wc.getURL())) return false
      const g = [...onglets.values()][0]
      const id = g?.idDeWebContents(wc) ?? null
      if (!g || id === null) return false
      const chemin = documents.cheminTemporaire()
      item.setSavePath(chemin)
      g.marquerChargement(id, true)
      item.once('done', (_e, etat) => {
        g.marquerChargement(id, false)
        if (etat === 'completed') g.afficherPdf(id, documents.ajouter(chemin, item.getURL(), item.getFilename(), true).id)
      })
      return true
    }
    /** Ctrl+O : choisir un ou plusieurs PDF du PC. */
    const ouvrirFichier = async (f: BrowserWindow): Promise<void> => {
      const r = await dialog.showOpenDialog(f, {
        title: 'Ouvrir un PDF',
        filters: [{ name: 'Documents PDF', extensions: ['pdf'] }],
        properties: ['openFile', 'multiSelections']
      })
      for (const chemin of r.filePaths) onglets.get(f.id)?.ouvrirPdf(documents.ajouterLocal(chemin).id)
    }
    // l'historique est écrit par paquets : on vide ce qui attend avant de quitter
    app.on('before-quit', () => historique.vider())

    // L'IA locale ne démarre qu'avec l'accord de l'utilisateur (réglage « toujours », ou sa réponse à la question),
    // et s'arrête avec le navigateur.
    const ollama = new Ollama()
    void ollama.verifier().then((e) => {
      if (e.phase === 'arrete' && reglages.get().iaDemarrage === 'toujours') void ollama.demarrer()
    })
    app.on('will-quit', () => ollama.arreter())
    const memoire = new Memoire(dossier)
    const conversations = new Conversations(dossier)
    const skills = new Skills(dossier)
    app.on('before-quit', () => conversations.vider())
    // le chat lit les onglets de la fenêtre principale (une seule fenêtre pour l'instant)
    // mémoire de navigation : pages vues ces 30 derniers jours (le ménage se fait au lancement, puis toutes les 6 heures)
    const navigation = new MemoireNavigation(dossier)
    navigation.purger()
    setInterval(() => navigation.purger(), 6 * 3600 * 1000).unref()
    const chat = new ServiceChat(ollama, conversations, skills, documents, memoire, () => reglages.get(), () => [...onglets.values()][0], navigation)

    // extensions du Chrome Web Store : dans la session des pages web seulement (ni l'interface, ni l'IA, ni l'agent)
    const extensions = new ServiceExtensions(dossier, sessionWeb)
    void extensions.charger()
    // WebMCP : les sites peuvent déclarer des outils pour les agents IA (rangés dans la page, jamais exécutés sans accord)
    sessionWeb.registerPreloadScript({ type: 'frame', filePath: join(__dirname, '../preload/webmcp.js') })
    // synchronisation chiffrée de bout en bout entre les PC (désactivée tant qu'elle n'est pas activée ou reliée)
    const sync = new ServiceSync(dossier, favoris, skills, reglages, () =>
      ([...onglets.values()][0]?.etat().onglets ?? []).filter((o) => /^https?:/.test(o.url) && !o.prive).map((o) => ({ titre: o.titre, url: o.url }))
    )
    sync.demarrer()
    app.on('will-quit', () => sync.arreter())
    // serveur MCP local : désactivé par défaut, suit les réglages
    const mcp = new ServeurMcp(dossier, () => reglages.get(), () => [...onglets.values()][0])
    mcp.appliquer()
    reglages.on('change', () => mcp.appliquer())
    app.on('will-quit', () => mcp.arreter())

    // tâches en arrière-plan (prix, changements, résumé du jour) : pages lues par le lecteur cloisonné, sans tes cookies
    bloqueur.brancher(sessionAgent(), () => true, () => [])
    const taches = new ServiceTaches(dossier, ollama, () => reglages.get())
    taches.ouvrir = (url) => {
      const f = BrowserWindow.getAllWindows()[0]
      if (!f) return
      onglets.get(f.id)?.nouveau(url)
      if (f.isMinimized()) f.restore()
      f.focus()
    }
    taches.demarrer()
    app.on('will-quit', () => taches.arreter())
    // recherche approfondie : sources lues sur le PC (onglets, Wikipédia, web par l'API Brave si clé), rapport sourcé
    const recherche = new ServiceRecherche(dossier, ollama, () => reglages.get(), () => [...onglets.values()][0])
    app.on('before-quit', () => recherche.vider())
    chat.commandeTache = (texte, page) => {
      const q = questionDeRecherche(texte)
      if (q) {
        const r = recherche.lancer(q)
        if (!('id' in r)) return r.erreur
        const f = BrowserWindow.getAllWindows()[0]
        if (f) onglets.get(f.id)?.ouvrirInterne('se7en://recherche')
        return `Je lance une recherche approfondie sur « ${r.question} ». Suis-la dans l'onglet Recherche : je lis plusieurs sources, j'en tire les faits utiles, puis j'écris un rapport où chaque affirmation renvoie à sa source.`
      }
      const d = comprendreDemandeTache(texte)
      if (!d) return null
      if (!page) return "Ouvre d'abord la page à surveiller dans un onglet, puis redemande-moi."
      const t = taches.creer(page.url, page.titre, d)
      return 'erreur' in t ? t.erreur : confirmationTache(t)
    }

    /** L'IA range les onglets par sujet (titres et sites seulement). */
    const ranger = async (g: GestionnaireOnglets): Promise<{ groupes: number } | { erreur: string }> => {
      const r = reglages.get()
      const e = ollama.etat()
      if (e.phase !== 'pret' || !modelePresent(r.modeleTexte, e.modeles)) return { erreur: "Active l'IA locale pour ranger les onglets." }
      const liste = g.ongletsARanger()
      if (liste.length < 3) return { erreur: 'Il faut au moins 3 onglets ouverts pour les ranger.' }
      try {
        const groupes = await proposerGroupes(liste, modeleEclair(r, e.modeles))
        if (!groupes.length) return { erreur: "L'IA n'a pas trouvé de sujets communs entre ces onglets." }
        g.appliquerGroupes(groupes)
        return { groupes: g.etat().groupes.length }
      } catch (err) {
        return { erreur: (err as Error).message }
      }
    }

    // coffre personnel chiffré, et remplissage des formulaires PDF avec ses informations
    const coffre = new CoffreChiffre(dossier)
    const formulaires = new ServiceFormulaire(documents, coffre, ollama, () => reglages.get())

    // profils et amis : seul ce qui concerne les amis passe par le serveur se7en social
    const social = new ClientSocial(dossier, () => reglages.get().serveurSocial || SERVEUR_SOCIAL_OFFICIEL || null)
    let serveurSocial = reglages.get().serveurSocial
    reglages.on('change', (r) => {
      if (r.serveurSocial === serveurSocial) return
      serveurSocial = r.serveurSocial
      void social.demarrer()
    })
    void social.demarrer()
    app.on('will-quit', () => social.arreter())
    // noms des amis et des groupes, pour les notifications et « naviguer ensemble »
    const noms = { amis: new Map<string, string>(), groupes: new Map<string, string>() }
    const majNoms = (): void => {
      void social.amis().then((l) => l.forEach((a) => noms.amis.set(a.id, a.pseudo)), () => undefined)
      void social.groupes().then((l) => l.forEach((g) => noms.groupes.set(g.id, g.nom)), () => undefined)
    }
    social.on('etat', (e) => e.connexion === 'connecte' && majNoms())
    social.on('evenement', (ev) => (ev.type === 'amis' || ev.type === 'groupes') && majNoms())

    // nouveau message : petite notification en bas à droite du navigateur (sauf si la page Amis est déjà sous les yeux),
    // et notification Windows si la fenêtre n'est pas au premier plan
    const notifs = new Map<number, NotifMessages>()
    const discussions = new Map<number, MiniDiscussion>()
    const discussion = (f: BrowserWindow, cible: CibleSocial | null): void => {
      let d = discussions.get(f.id)
      if (!cible) return d?.fermer()
      if (!d) {
        d = new MiniDiscussion(f)
        discussions.set(f.id, d)
        f.once('closed', () => discussions.delete(f.id))
      }
      if (f.isMinimized()) f.restore()
      f.focus()
      void d.ouvrir(cible)
    }
    const ouvrirConversation = (f: BrowserWindow, cible: CibleSocial): void => {
      if (f.isDestroyed()) return
      if (f.isMinimized()) f.restore()
      f.focus()
      onglets.get(f.id)?.ouvrirInterne('se7en://amis')
      f.webContents.send(CANAUX.uiCommande, { type: 'ouvrir-conversation', cible })
    }
    const sombre = (): boolean => {
      const r = reglages.get()
      return r.theme === 'sombre' || (r.theme === 'auto' && nativeTheme.shouldUseDarkColors)
    }
    const notif = (f: BrowserWindow): NotifMessages => {
      let n = notifs.get(f.id)
      if (!n) {
        // clic sur une notification : la petite fenêtre de discussion, sans quitter sa page
        n = new NotifMessages(f, (cible) => discussion(f, cible), () => (discussions.get(f.id)?.estOuverte() ? LARGEUR_DISCUSSION + 12 : 0))
        notifs.set(f.id, n)
        f.once('closed', () => notifs.delete(f.id))
      }
      return n
    }
    /** Ce que dit la notification d'un message (texte, lien, image). */
    const apercu = (m: MessageSocial): string =>
      m.vocal ? 'a envoyé un message vocal' : m.image ? 'a envoyé une image' : m.type === 'lien' ? `a envoyé un lien : ${m.titre || m.url}` : m.texte.slice(0, 300)
    social.on('evenement', async (ev) => {
      const f = BrowserWindow.getAllWindows()[0]
      if (ev.type !== 'message' || !f || f.isMinimized() || social.etat().profil?.humeur?.type === 'occupe') return
      const surAmis = f.isFocused() && onglets.get(f.id)?.actif()?.etat.url === 'se7en://amis'
      if (surAmis) return
      const m = ev.message
      const groupe = m.groupe ? noms.groupes.get(m.groupe) ?? 'Groupe' : null
      void notif(f).afficher({
        cle: m.groupe ?? m.de,
        cible: m.groupe ? { type: 'groupe', id: m.groupe } : { type: 'ami', id: m.de },
        pseudo: groupe ? `${ev.pseudo} · ${groupe}` : ev.pseudo,
        texte: apercu(m),
        photo: await social.photo(m.de).catch(() => null),
        sombre: sombre()
      })
    })
    social.on('evenement', (ev) => {
      const f = BrowserWindow.getAllWindows()[0]
      if (ev.type !== 'message' || !Notification.isSupported() || (f && f.isFocused()) || social.etat().profil?.humeur?.type === 'occupe') return
      const m = ev.message
      const n = new Notification({ title: m.groupe ? `${ev.pseudo} · ${noms.groupes.get(m.groupe) ?? 'Groupe'}` : ev.pseudo, body: apercu(m).slice(0, 200), silent: false })
      n.on('click', () => f && discussion(f, m.groupe ? { type: 'groupe', id: m.groupe } : { type: 'ami', id: m.de }))
      n.show()
    })

    // naviguer ensemble : un onglet partagé en direct avec un ami (sur invitation acceptée)
    const fenetreActive = (): BrowserWindow | undefined => BrowserWindow.getAllWindows()[0]
    const ensemble = new Ensemble(social, {
      page: (id) => {
        const f = fenetreActive()
        const p = f && onglets.get(f.id)?.pageDe(id)
        return p ? { wc: p.wc, titre: p.etat.titre } : null
      },
      ouvrir: (url) => {
        const f = fenetreActive()
        return (f && onglets.get(f.id)?.nouveau(url)) ?? -1
      },
      naviguer: (id, url) => {
        const f = fenetreActive()
        if (f) onglets.get(f.id)?.naviguer(id, url)
      },
      pseudoAmi: (id) => noms.amis.get(id) ?? 'Un ami',
      monPseudo: () => social.etat().profil?.pseudo ?? ''
    })
    ensemble.on('etat', (e) => {
      // invitation reçue : la petite notification la montre aussi, même hors de la page Amis
      const f = fenetreActive()
      if (e?.etat === 'invitation-recue' && f && !f.isMinimized())
        void social.photo(e.ami).then((photo) =>
          notif(f).afficher({ cle: `ensemble-${e.ami}`, cible: { type: 'ami', id: e.ami }, pseudo: e.pseudo, texte: `t'invite à naviguer ensemble : ${e.titre || e.url}`, photo, sombre: sombre() })
        )
    })

    // aide à l'écriture (clic droit dans un champ) et « Demander sur une zone de l'écran »
    const ecriture = new AssistantEcriture(ollama, () => reglages.get())
    const zone = async (f: BrowserWindow): Promise<void> => {
      const c = await chat.capturerZone()
      if (c && !f.isDestroyed()) f.webContents.send(CANAUX.uiCommande, { type: 'zone', ...c })
    }
    const iaPrete = (): boolean => {
      const e = ollama.etat()
      return e.phase === 'pret' && modelePresent(reglages.get().modeleTexte, e.modeles)
    }

    // traduction de la page entière (IA locale), en gardant sa mise en page
    const traducteur = new TraducteurPages()
    const traduire = (f: BrowserWindow, id: number, original: boolean): void => {
      const go = onglets.get(f.id)
      const p = go?.pageDe(id)
      if (!go || !p) return
      if (original) {
        void traducteur.original(p.wc)
        return go.definirTraduction(id, null)
      }
      if (!iaPrete()) return go.definirTraduction(id, { etat: 'erreur', message: "L'IA locale n'est pas prête : ouvre la page IA pour l'installer." })
      const url = p.wc.getURL()
      void traducteur.traduire(p.wc, reglages.get().modeleTexte, (t) => {
        // la page a changé entre-temps : la traduction s'arrête
        if (p.wc.isDestroyed() || p.wc.getURL() !== url) return traducteur.arreter(p.wc)
        go.definirTraduction(id, t)
      })
    }

    // mise à jour du navigateur : vérifiée 30 s après le lancement puis toutes les 6 heures, installée à la fermeture
    const miseAJour = new MiseAJour(() => reglages.get().miseAJourAuto)
    setTimeout(() => void miseAJour.verifier(), 30_000).unref()
    setInterval(() => void miseAJour.verifier(), 6 * 3600 * 1000).unref()
    app.on('will-quit', () => miseAJour.installerALaFermeture())

    // composants téléchargés (Ollama, modèles Qwen, extensions, listes du bloqueur) : à jour ou pas ?
    // Vérifiés 45 s après le lancement puis au plus toutes les 12 heures ; seuls ceux qui ont changé sont retéléchargés.
    const composants = new ServiceComposants(dossier, { ollama, extensions, bloqueur, reglages: () => reglages.get() })
    setTimeout(() => void composants.verifier(), 45_000).unref()
    setInterval(() => void composants.verifier(), 3600 * 1000).unref()

    const agrandirDiscussion = (f: BrowserWindow, cible: CibleSocial): void => {
      discussion(f, null)
      ouvrirConversation(f, cible)
    }
    enregistrerIpc({ composants, sync, mcp, extensions, recherche, taches, vpn, discussion, agrandirDiscussion, ensemble, traduire, plantages, miseAJour, navigation, ecriture, zone: (f) => void zone(f), social, reglages, historique, favoris, telechargements, ollama, chat, conversations, skills, coffre, formulaires, bloqueur, memoire, ranger, ouvrirFichier: (f) => void ouvrirFichier(f), ongletsDe: (f) => onglets.get(f.id) })

    const fenetre = creerFenetrePrincipale()
    const idFenetre = fenetre.id
    const surTouche = creerGestionRaccourcis(fenetre, () => gestionnaire, reglages, favoris, () => void ouvrirFichier(fenetre))
    const gestionnaire = new GestionnaireOnglets(fenetre, {
      moteur: () => reglages.get().moteurRecherche,
      notifier: (etat) => fenetre.webContents.send(CANAUX.ongletsEtat, etat),
      surTouche,
      sauverPrioritaires: (liste) => prioritaires.sauver(liste),
      sauverSessions: (liste) => sessionsSauvees.sauver(liste),
      journal: { visite: (url, titre) => historique.ajouter(url, titre), titre: (url, titre) => historique.majTitre(url, titre) },
      documentPdf: (id) => documents.lire(id),
      transition: (t) => fenetre.webContents.send(CANAUX.uiCommande, t),
      // une page chargée est lue un peu plus tard (le temps qu'elle s'affiche) : vérification anti-phishing,
      // puis mémoire de navigation
      pageChargee: (wc, etat) => {
        const url = etat.url
        setTimeout(async () => {
          if (wc.isDestroyed() || wc.getURL() !== url || !estAdresseAutorisee(url)) return
          const p = await lirePage(wc, url)
          const r = reglages.get()
          if (p.motDePasse && !r.phishingExceptions.includes(hoteDe(url))) {
            const v = analyserPage({ url, titre: p.titre, texte: p.texte, motDePasse: true })
            let alerte = v.niveau === 'fort' ? v.message! : null
            if (v.niveau === 'douteux') {
              // cas douteux : l'IA locale donne son avis ; sans IA, on prévient par prudence
              const e = ollama.etat()
              const pret = e.phase === 'pret' && modelePresent(r.modeleTexte, e.modeles)
              // vérification de sécurité : le modèle principal, plus fiable que le petit modèle rapide
              const frauduleux = pret ? await avisPhishing(r.modeleTexte, p, v.marque!).catch(() => true) : true
              if (frauduleux) alerte = v.message!
            }
            if (alerte && !wc.isDestroyed() && wc.getURL() === url) gestionnaire.definirPhishing(wc, alerte)
          }
          // page de connexion ou de paiement, ou onglet privé : jamais gardée
          if (p.motDePasse || !r.memoireNavigation || etat.prive) return
          await navigation.enregistrer({ url, titre: p.titre, date: Date.now(), texte: p.texte }).catch(() => false)
        }, 2500)
      },
      menuPage: (idOnglet, wc, params) => {
        const commande = (c: unknown): void => fenetre.webContents.send(CANAUX.uiCommande, c)
        ouvrirMenuPage(fenetre, wc, params, {
          demander: (texte) => {
            gestionnaire.activer(idOnglet)
            commande({ type: 'demander-ia', texte, avecPage: true })
          },
          ouvrirPanneau: () => commande({ type: 'demander-ia', texte: '', avecPage: true }),
          ecrire: (w, action) => void ecriture.demarrer(w, idOnglet, action),
          zone: () => {
            gestionnaire.activer(idOnglet)
            void zone(fenetre)
          },
          nouvelOnglet: (url) => gestionnaire.nouveau(url, { aCote: true, activer: false }),
          iaPrete,
          traduite: () => !!gestionnaire.pageDe(idOnglet)?.etat.traduction,
          origine: () => gestionnaire.origineDe(idOnglet),
          remplirFormulaire: () => commande({ type: 'remplir-formulaire', idOnglet }),
          surveiller: (type) => {
            const o = gestionnaire.pageDe(idOnglet)?.etat
            if (!o) return
            taches.creer(o.url, o.titre, { type, seuil: null, texteGuette: '', heure: '08:00', intervalleMin: type === 'resume' ? 1440 : 60 })
            gestionnaire.ouvrirInterne('se7en://taches')
          },
          traduire: () => traduire(fenetre, idOnglet, !!gestionnaire.pageDe(idOnglet)?.etat.traduction)
        })
      }
    })
    gestionnaire.restaurerPrioritaires(prioritaires.lire())
    gestionnaire.restaurerSessions(sessionsSauvees.lire())
    onglets.set(idFenetre, gestionnaire)
    fenetre.on('closed', () => onglets.delete(idFenetre))
    // les raccourcis marchent aussi quand le focus est dans l'interface
    fenetre.webContents.on('before-input-event', (e, input) => {
      if (surTouche(input)) e.preventDefault()
    })
    ouvrirArguments = (argv) => {
      const { urls, pdfs } = liensDesArguments(argv)
      for (const url of urls) gestionnaire.nouveau(url)
      for (const chemin of pdfs) gestionnaire.ouvrirPdf(documents.ajouterLocal(chemin).id)
      return urls.length + pdfs.length > 0
    }
    // lancé par un lien (autre appli) ou un PDF : on l'ouvre ; sinon, un Nouvel onglet
    if (!ouvrirArguments(process.argv)) gestionnaire.nouveau()
    // onglets oubliés mis en veille (réglage en minutes, 0 : jamais)
    setInterval(() => gestionnaire.mettreEnVeille(reglages.get().veilleOnglets), 60_000).unref()
  })

  app.on('window-all-closed', () => app.quit())
}
