/* Fenêtre principale : sans cadre, avec l'effet de verre natif de Windows 11 quand il existe. */
import { app, BrowserWindow, nativeTheme } from 'electron'
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

/** Le thème de Windows suit le choix de l'utilisateur : la teinte du verre natif change avec lui. */
export function appliquerTheme(theme: Theme): void {
  nativeTheme.themeSource = theme === 'clair' ? 'light' : theme === 'sombre' ? 'dark' : 'system'
}

export function creerFenetrePrincipale(): BrowserWindow {
  const natif = effetNatifDisponible()
  const fenetre = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 720,
    minHeight: 480,
    show: false,
    frame: false,
    // Avec l'effet natif, le fond doit être transparent pour laisser voir l'acrylique ;
    // sur Windows 10, fond opaque et le verre est simulé en CSS.
    backgroundColor: natif ? '#00000000' : nativeTheme.shouldUseDarkColors ? '#1b1d22' : '#eef0f4',
    ...(natif ? { backgroundMaterial: 'acrylic' as const } : {}),
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
  fenetre.on('maximize', envoyerEtat)
  fenetre.on('unmaximize', envoyerEtat)
  fenetre.on('restore', envoyerEtat)
  fenetre.on('focus', envoyerEtat)
  fenetre.on('blur', envoyerEtat)
  fenetre.webContents.on('did-finish-load', envoyerEtat)
  // en mode test, la fenêtre s'affiche sans prendre le focus (on ne dérange pas l'utilisateur)
  fenetre.once('ready-to-show', () => (process.env.SE7EN_PROFIL_TEST ? fenetre.showInactive() : fenetre.show()))

  if (process.env.ELECTRON_RENDERER_URL) fenetre.loadURL(process.env.ELECTRON_RENDERER_URL)
  else fenetre.loadFile(join(__dirname, '../renderer/index.html'))
  return fenetre
}
