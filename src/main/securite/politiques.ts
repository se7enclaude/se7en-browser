/* Règles de sécurité communes à toutes les vues. */
import { app, session, type WebContents, type WebPreferences } from 'electron'

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

/** Session des pages web : séparée de celle de l'interface (cookies, cache, permissions à part). */
export const PARTITION_WEB = 'persist:web'

/** Permissions accordées sans demander : sans risque pour la vie privée. Les autres sont refusées
 * (une demande à l'utilisateur viendra plus tard, site par site). */
const PERMISSIONS_SURES = new Set(['fullscreen', 'clipboard-sanitized-write', 'pointerLock'])

/** Réglages imposés à toutes les pages web : aucun accès à Node ni au navigateur lui-même. */
export function preferencesPage(prive = false): WebPreferences {
  return {
    partition: prive ? PARTITION_PRIVEE : PARTITION_WEB,
    contextIsolation: true,
    nodeIntegration: false,
    nodeIntegrationInSubFrames: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    navigateOnDragDrop: false,
    spellcheck: true
  }
}

/** Onglets privés : session en mémoire seulement (rien n'est écrit sur le disque), partagée par les onglets privés
 * et vidée quand le dernier se ferme. */
export const PARTITION_PRIVEE = 'prive'

let sessionWebPreparee = false
/** Règles de la session web, appliquées une seule fois. */
export function preparerSessionWeb(): void {
  if (sessionWebPreparee) return
  sessionWebPreparee = true
  for (const s of [session.fromPartition(PARTITION_WEB), session.fromPartition(PARTITION_PRIVEE)]) {
    s.setPermissionRequestHandler((_wc, permission, rappel) => rappel(PERMISSIONS_SURES.has(permission)))
    s.setPermissionCheckHandler((_wc, permission) => PERMISSIONS_SURES.has(permission))
    s.setSpellCheckerLanguages(['fr', 'en-US'])
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
  // permissions de l'interface : écrire dans le presse-papiers (bouton « Copier »), et le micro seul (messages vocaux,
  // enregistrés seulement quand l'utilisateur appuie sur le bouton) ; jamais la caméra ni l'écran
  wc.session.setPermissionRequestHandler((_wc, perm, rappel, details) => {
    const micro = perm === 'media' && (details as { mediaTypes?: string[] }).mediaTypes?.every((t) => t === 'audio') === true
    rappel(perm === 'clipboard-sanitized-write' || micro)
  })
}

/** Bloque, pour toute l'appli, l'ajout de <webview> et les preloads injectés par une page. */
export function durcirApplication(): void {
  app.on('web-contents-created', (_e, wc) => {
    wc.on('will-attach-webview', (e) => e.preventDefault())
  })
}
