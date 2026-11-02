/* Point d'entrée du processus principal de se7en Browser. */
import { app, BrowserWindow } from 'electron'
import { CANAUX } from '../shared/ipc'
import { creerFenetrePrincipale, appliquerTheme } from './fenetre/fenetrePrincipale'
import { enregistrerIpc } from './ipc/enregistrer'
import { creerGestionRaccourcis } from './navigateur/commandes'
import { GestionnaireOnglets } from './navigateur/onglets'
import { durcirApplication } from './securite/politiques'
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
    const reglages = new MagasinReglages(app.getPath('userData'))
    appliquerTheme(reglages.get().theme)
    const prioritaires = new MagasinPrioritaires(app.getPath('userData'))
    enregistrerIpc(reglages, (f) => onglets.get(f.id))

    const fenetre = creerFenetrePrincipale()
    const idFenetre = fenetre.id
    const surTouche = creerGestionRaccourcis(fenetre, () => gestionnaire, reglages)
    const gestionnaire = new GestionnaireOnglets(fenetre, {
      moteur: () => reglages.get().moteurRecherche,
      notifier: (etat) => fenetre.webContents.send(CANAUX.ongletsEtat, etat),
      surTouche,
      sauverPrioritaires: (liste) => prioritaires.sauver(liste)
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
