/* Point d'entrée du processus principal de se7en Browser. */
import { app, BrowserWindow, session } from 'electron'
import { CANAUX } from '../shared/ipc'
import { creerFenetrePrincipale, appliquerTheme } from './fenetre/fenetrePrincipale'
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
    const telechargements = new Telechargements(dossier)
    telechargements.brancher(session.fromPartition(PARTITION_WEB))
    // l'historique est écrit par paquets : on vide ce qui attend avant de quitter
    app.on('before-quit', () => historique.vider())

    enregistrerIpc({ reglages, historique, favoris, telechargements, ongletsDe: (f) => onglets.get(f.id) })

    const fenetre = creerFenetrePrincipale()
    const idFenetre = fenetre.id
    const surTouche = creerGestionRaccourcis(fenetre, () => gestionnaire, reglages, favoris)
    const gestionnaire = new GestionnaireOnglets(fenetre, {
      moteur: () => reglages.get().moteurRecherche,
      notifier: (etat) => fenetre.webContents.send(CANAUX.ongletsEtat, etat),
      surTouche,
      sauverPrioritaires: (liste) => prioritaires.sauver(liste),
      journal: { visite: (url, titre) => historique.ajouter(url, titre), titre: (url, titre) => historique.majTitre(url, titre) }
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
