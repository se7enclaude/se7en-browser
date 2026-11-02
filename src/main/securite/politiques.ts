/* Règles de sécurité communes à toutes les vues. */
import { app, type WebContents, type WebPreferences } from 'electron'

/** Réglages imposés à l'interface du navigateur (notre propre code React). */
export function preferencesInterface(preload: string): WebPreferences {
  return {
    preload,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    spellcheck: false
  }
}

/** Vrai si l'adresse appartient à l'interface elle-même (serveur Vite en dev, fichiers locaux en prod). */
export function estAdresseInterface(url: string): boolean {
  const dev = process.env.ELECTRON_RENDERER_URL
  if (dev && url.startsWith(dev)) return true
  return !app.isPackaged ? url.startsWith('file://') : url.startsWith('file://') && url.includes('/out/renderer/')
}

/** Empêche l'interface de naviguer ailleurs ou d'ouvrir des fenêtres : elle ne fait que piloter le navigateur. */
export function verrouillerInterface(wc: WebContents): void {
  wc.on('will-navigate', (e, url) => {
    if (!estAdresseInterface(url)) e.preventDefault()
  })
  wc.setWindowOpenHandler(() => ({ action: 'deny' }))
  wc.session.setPermissionRequestHandler((_wc, _perm, rappel) => rappel(false))
}

/** Bloque, pour toute l'appli, l'ajout de <webview> et les preloads injectés par une page. */
export function durcirApplication(): void {
  app.on('web-contents-created', (_e, wc) => {
    wc.on('will-attach-webview', (e) => e.preventDefault())
  })
}
