/* Branche les canaux IPC de l'interface. Chaque message est vérifié : il doit venir de notre fenêtre. */
import { app, BrowserWindow, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { CANAUX, type InfosApp } from '../../shared/ipc'
import type { Zone } from '../../shared/onglets'
import { estAdresseInterface } from '../securite/politiques'
import type { MagasinReglages } from '../stockage/reglages'
import { appliquerTheme, effetNatifDisponible } from '../fenetre/fenetrePrincipale'
import type { GestionnaireOnglets } from '../navigateur/onglets'
import { ouvrirMenuOnglet } from '../navigateur/menuOnglet'

function fenetreDe(e: IpcMainEvent | IpcMainInvokeEvent): BrowserWindow | null {
  // Une page web (onglet) n'a pas accès à ces canaux : seul le code de l'interface peut les appeler.
  if (!e.senderFrame || !estAdresseInterface(e.senderFrame.url)) return null
  return BrowserWindow.fromWebContents(e.sender)
}

const estId = (v: unknown): v is number => Number.isInteger(v)
const estTexte = (v: unknown): v is string => typeof v === 'string' && v.length <= 8192

export function enregistrerIpc(reglages: MagasinReglages, ongletsDe: (f: BrowserWindow) => GestionnaireOnglets | undefined): void {
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

  // ---------- onglets ----------
  const g = (e: IpcMainEvent | IpcMainInvokeEvent): GestionnaireOnglets | undefined => {
    const f = fenetreDe(e)
    return f ? ongletsDe(f) : undefined
  }
  ipcMain.handle(CANAUX.ongletsLire, (e) => g(e)?.etat() ?? null)
  ipcMain.on(CANAUX.ongletsNouveau, (e, saisie: unknown) => g(e)?.nouveau(estTexte(saisie) ? saisie : ''))
  ipcMain.on(CANAUX.ongletsFermer, (e, id: unknown) => estId(id) && g(e)?.fermer(id))
  ipcMain.on(CANAUX.ongletsActiver, (e, id: unknown) => estId(id) && g(e)?.activer(id))
  ipcMain.on(CANAUX.ongletsDeplacer, (e, id: unknown, versId: unknown) => estId(id) && estId(versId) && g(e)?.deplacer(id, versId))
  ipcMain.on(CANAUX.ongletsMenu, (e, id: unknown) => {
    const f = fenetreDe(e)
    const go = f && ongletsDe(f)
    if (f && go && estId(id)) ouvrirMenuOnglet(f, go, id)
  })
  ipcMain.on(CANAUX.ongletsPrioritaire, (e, id: unknown, oui: unknown) => estId(id) && g(e)?.definirPrioritaire(id, oui === true))
  ipcMain.on(CANAUX.ongletsMasquer, (e, oui: unknown) => g(e)?.definirMasque(oui === true))
  ipcMain.on(CANAUX.ongletsParametres, (e) => g(e)?.ouvrirInterne('se7en://parametres'))
  ipcMain.on(CANAUX.ongletsNaviguer, (e, id: unknown, saisie: unknown) => estId(id) && estTexte(saisie) && g(e)?.naviguer(id, saisie))
  ipcMain.on(CANAUX.ongletsPrecedent, (e, id: unknown) => estId(id) && g(e)?.precedent(id))
  ipcMain.on(CANAUX.ongletsSuivant, (e, id: unknown) => estId(id) && g(e)?.suivant(id))
  ipcMain.on(CANAUX.ongletsActualiser, (e, id: unknown) => estId(id) && g(e)?.actualiser(id))
  ipcMain.on(CANAUX.ongletsArreter, (e, id: unknown) => estId(id) && g(e)?.arreter(id))
  ipcMain.on(CANAUX.ongletsZone, (e, z: unknown) => z && typeof z === 'object' && g(e)?.definirZone(z as Zone))
  ipcMain.on(CANAUX.ongletsFocusPage, (e) => g(e)?.focusPage())
}
