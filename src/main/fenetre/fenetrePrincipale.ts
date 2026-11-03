/* Fenêtre principale : sans cadre, fond opaque (le verre est dessiné par l'interface, sans matière native de Windows). */
import { app, BrowserWindow, nativeTheme, systemPreferences } from 'electron'
import { release } from 'node:os'
import { join } from 'node:path'
import { CANAUX, type EtatFenetre } from '../../shared/ipc'
import type { Theme } from '../../shared/reglages'
import { preferencesInterface, verrouillerInterface } from '../securite/politiques'

/** Windows 11 22H2 (build 22621) ou plus récent : backgroundMaterial est pris en charge. */
export function effetNatifDisponible(): boolean {
  if (process.platform !== 'win32') return false
  const build = Number(release().split('.')[2] ?? 0)
  return build >= 22621
}

/** Le thème de Windows suit le choix de l'utilisateur (barre de titre, menus natifs, fond de la fenêtre). */
export function appliquerTheme(theme: Theme): void {
  nativeTheme.themeSource = theme === 'clair' ? 'light' : theme === 'sombre' ? 'dark' : 'system'
}

/** Fondu d'ouverture (200 ms), sauf si Windows demande de réduire les animations. */
function apparaitreEnFondu(fenetre: BrowserWindow): void {
  if (!systemPreferences.getAnimationSettings().shouldRenderRichAnimation) return fenetre.setOpacity(1)
  const debut = Date.now()
  const pas = (): void => {
    if (fenetre.isDestroyed()) return
    const t = Math.min(1, (Date.now() - debut) / 200)
    fenetre.setOpacity(1 - (1 - t) ** 3)
    if (t < 1) setTimeout(pas, 12)
  }
  pas()
}

export function creerFenetrePrincipale(): BrowserWindow {
  // Fond opaque, de la couleur du fond ambiant : l'interface peint déjà son propre « verre » partout.
  // Pas de matière native de Windows (acrylique ou Mica) : elle ne se voyait pas, mais laissait passer
  // des traits clairs (bords des fenêtres derrière) sous le flou du panneau IA.
  const couleurFond = (): string => (nativeTheme.shouldUseDarkColors ? '#2a2928' : '#e8e5de')
  const fenetre = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 720,
    minHeight: 480,
    show: false,
    frame: false,
    backgroundColor: couleurFond(),
    title: 'se7en Browser',
    icon: join(app.getAppPath(), 'build', 'icon.png'),
    webPreferences: preferencesInterface(join(__dirname, '../preload/ui.js'))
  })

  verrouillerInterface(fenetre.webContents)

  const envoyerEtat = (): void => {
    if (fenetre.isDestroyed()) return
    const etat: EtatFenetre = { agrandie: fenetre.isMaximized(), focus: fenetre.isFocused() }
    fenetre.webContents.send(CANAUX.fenetreEtat, etat)
  }
  const majFond = (): void => {
    if (!fenetre.isDestroyed()) fenetre.setBackgroundColor(couleurFond())
  }
  nativeTheme.on('updated', majFond)
  fenetre.once('closed', () => nativeTheme.off('updated', majFond))
  fenetre.on('maximize', envoyerEtat)
  fenetre.on('unmaximize', envoyerEtat)
  fenetre.on('restore', envoyerEtat)
  fenetre.on('focus', envoyerEtat)
  fenetre.on('blur', envoyerEtat)
  fenetre.webContents.on('did-finish-load', envoyerEtat)
  // la fenêtre apparaît en fondu, une fois l'interface dessinée (jamais un cadre vide)
  // en mode test, elle s'affiche sans prendre le focus (on ne dérange pas l'utilisateur)
  fenetre.once('ready-to-show', () => {
    fenetre.setOpacity(0)
    if (process.env.SE7EN_PROFIL_TEST) fenetre.showInactive()
    else fenetre.show()
    apparaitreEnFondu(fenetre)
  })

  if (process.env.ELECTRON_RENDERER_URL) fenetre.loadURL(process.env.ELECTRON_RENDERER_URL)
  else fenetre.loadFile(join(__dirname, '../renderer/index.html'))
  return fenetre
}
