/* Point d'entrée du processus principal de se7en Browser. */
import { app, BrowserWindow } from 'electron'
import { creerFenetrePrincipale, appliquerTheme } from './fenetre/fenetrePrincipale'
import { enregistrerIpc } from './ipc/enregistrer'
import { durcirApplication } from './securite/politiques'
import { MagasinReglages } from './stockage/reglages'

app.setAppUserModelId('se7en.browser')

// Une seule instance : relancer l'appli remet la fenêtre existante au premier plan.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  durcirApplication()

  app.on('second-instance', () => {
    const f = BrowserWindow.getAllWindows()[0]
    if (!f) return
    if (f.isMinimized()) f.restore()
    f.focus()
  })

  app.whenReady().then(() => {
    const reglages = new MagasinReglages(app.getPath('userData'))
    appliquerTheme(reglages.get().theme)
    enregistrerIpc(reglages)
    creerFenetrePrincipale()
  })

  app.on('window-all-closed', () => app.quit())
}
