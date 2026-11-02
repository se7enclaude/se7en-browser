/* Point d'entrée du processus principal de se7en Browser. */
import { app, BrowserWindow, dialog, session } from 'electron'
import { CANAUX } from '../shared/ipc'
import { idDocDeVisionneuse } from '../shared/pdf'
import { DocumentsPdf } from './pdf/documents'
import { ServiceFormulaire } from './pdf/serviceFormulaire'
import { CoffreChiffre } from './coffre/coffre'
import { brancherProtocolePdf, declarerProtocolePdf, redirigerPdfVersVisionneuse } from './pdf/protocole'
import { creerFenetrePrincipale, appliquerTheme } from './fenetre/fenetrePrincipale'
import { ServiceChat } from './ia/chat'
import { Conversations, Skills } from './ia/conversations'
import { Ollama } from './ia/ollama'
import { Memoire } from './ia/memoire'
import { proposerGroupes } from './ia/rangement'
import { Bloqueur } from './bloqueur/bloqueur'
import { modelePresent } from '../shared/ia'
import { enregistrerIpc } from './ipc/enregistrer'
import { creerGestionRaccourcis } from './navigateur/commandes'
import { GestionnaireOnglets } from './navigateur/onglets'
import { Telechargements } from './navigateur/telechargements'
import { durcirApplication, PARTITION_WEB } from './securite/politiques'
import { Favoris } from './stockage/favoris'
import { Historique } from './stockage/historique'
import { MagasinPrioritaires } from './stockage/prioritaires'
import { MagasinReglages } from './stockage/reglages'

app.setAppUserModelId('se7en.browser')

// Mode test (développement) : profil à part, pour ne jamais toucher aux réglages ni aux onglets de l'utilisateur.
if (process.env.SE7EN_PROFIL_TEST) app.setPath('userData', process.env.SE7EN_PROFIL_TEST)

// Une seule instance : relancer l'appli remet la fenêtre existante au premier plan.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  durcirApplication()
  declarerProtocolePdf()
  const onglets = new Map<number, GestionnaireOnglets>()

  app.on('second-instance', () => {
    const f = BrowserWindow.getAllWindows()[0]
    if (!f) return
    if (f.isMinimized()) f.restore()
    f.focus()
  })

  app.whenReady().then(() => {
    const dossier = app.getPath('userData')
    const reglages = new MagasinReglages(dossier)
    appliquerTheme(reglages.get().theme)
    const prioritaires = new MagasinPrioritaires(dossier)
    const historique = new Historique(dossier)
    const favoris = new Favoris(dossier)
    const sessionWeb = session.fromPartition(PARTITION_WEB)
    const telechargements = new Telechargements(dossier)
    telechargements.brancher(sessionWeb)

    // PDF : affichés dans la visionneuse isolée (protocole se7en-pdf://) au lieu d'être téléchargés
    const documents = new DocumentsPdf()
    brancherProtocolePdf(sessionWeb, documents)
    redirigerPdfVersVisionneuse(sessionWeb)

    // bloqueur de pubs et de traqueurs (au niveau du réseau, sans script injecté dans les pages)
    const bloqueur = new Bloqueur(dossier)
    bloqueur.brancher(sessionWeb, () => reglages.get().bloqueur, () => reglages.get().bloqueurExceptions)
    bloqueur.on('bloque', (idWc) => [...onglets.values()][0]?.compterBloque(idWc))
    void bloqueur.charger()
    app.on('will-quit', () => documents.vider())
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
    const chat = new ServiceChat(ollama, conversations, skills, documents, memoire, () => reglages.get(), () => [...onglets.values()][0])

    /** L'IA range les onglets par sujet (titres et sites seulement). */
    const ranger = async (g: GestionnaireOnglets): Promise<{ groupes: number } | { erreur: string }> => {
      const r = reglages.get()
      const e = ollama.etat()
      if (e.phase !== 'pret' || !modelePresent(r.modeleTexte, e.modeles)) return { erreur: "Active l'IA locale pour ranger les onglets." }
      const liste = g.ongletsARanger()
      if (liste.length < 3) return { erreur: 'Il faut au moins 3 onglets ouverts pour les ranger.' }
      try {
        const groupes = await proposerGroupes(liste, r.modeleTexte)
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

    enregistrerIpc({ reglages, historique, favoris, telechargements, ollama, chat, conversations, skills, coffre, formulaires, bloqueur, memoire, ranger, ouvrirFichier: (f) => void ouvrirFichier(f), ongletsDe: (f) => onglets.get(f.id) })

    const fenetre = creerFenetrePrincipale()
    const idFenetre = fenetre.id
    const surTouche = creerGestionRaccourcis(fenetre, () => gestionnaire, reglages, favoris, () => void ouvrirFichier(fenetre))
    const gestionnaire = new GestionnaireOnglets(fenetre, {
      moteur: () => reglages.get().moteurRecherche,
      notifier: (etat) => fenetre.webContents.send(CANAUX.ongletsEtat, etat),
      surTouche,
      sauverPrioritaires: (liste) => prioritaires.sauver(liste),
      journal: { visite: (url, titre) => historique.ajouter(url, titre), titre: (url, titre) => historique.majTitre(url, titre) },
      documentPdf: (id) => documents.lire(id)
    })
    gestionnaire.restaurerPrioritaires(prioritaires.lire())
    onglets.set(idFenetre, gestionnaire)
    fenetre.on('closed', () => onglets.delete(idFenetre))
    // les raccourcis marchent aussi quand le focus est dans l'interface
    fenetre.webContents.on('before-input-event', (e, input) => {
      if (surTouche(input)) e.preventDefault()
    })
    gestionnaire.nouveau()
  })

  app.on('window-all-closed', () => app.quit())
}
