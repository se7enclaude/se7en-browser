/* Branche les canaux IPC de l'interface. Chaque message est vérifié : il doit venir de notre fenêtre. */
import { app, BrowserWindow, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { CANAUX, type InfosApp } from '../../shared/ipc'
import { estAdresseInterface } from '../securite/politiques'
import type { MagasinReglages } from '../stockage/reglages'
import { appliquerTheme, effetNatifDisponible } from '../fenetre/fenetrePrincipale'

function fenetreDe(e: IpcMainEvent | IpcMainInvokeEvent): BrowserWindow | null {
  // Une page web (onglet) n'a pas accès à ces canaux : seul le code de l'interface peut les appeler.
  if (!e.senderFrame || !estAdresseInterface(e.senderFrame.url)) return null
  return BrowserWindow.fromWebContents(e.sender)
}

export function enregistrerIpc(reglages: MagasinReglages): void {
  ipcMain.on(CANAUX.fenetreReduire, (e) => fenetreDe(e)?.minimize())
  ipcMain.on(CANAUX.fenetreAgrandir, (e) => {
    const f = fenetreDe(e)
    if (f) f.isMaximized() ? f.unmaximize() : f.maximize()
  })
  ipcMain.on(CANAUX.fenetreFermer, (e) => fenetreDe(e)?.close())

  ipcMain.handle(CANAUX.appInfos, (e): InfosApp | null =>
    fenetreDe(e) ? { version: app.getVersion(), effetNatif: effetNatifDisponible() } : null
  )
  ipcMain.handle(CANAUX.reglagesLire, (e) => (fenetreDe(e) ? reglages.get() : null))
  ipcMain.handle(CANAUX.reglagesModifier, (e, partiel: unknown) => (fenetreDe(e) ? reglages.modifier(partiel) : null))

  // Toute modification est renvoyée à toutes les fenêtres, et le thème natif suit.
  reglages.on('change', (r) => {
    appliquerTheme(r.theme)
    for (const f of BrowserWindow.getAllWindows()) f.webContents.send(CANAUX.reglagesChange, r)
  })
}
