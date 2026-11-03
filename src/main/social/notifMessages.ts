/* Petite notification en bas à droite du navigateur à chaque message reçu.
 * Les pages web sont des vues natives posées au-dessus de l'interface : la notification est donc sa propre vue,
 * transparente, remise tout en haut à chaque affichage, et taillée exactement à la pile de notifications. */
import { ipcMain, WebContentsView, type BrowserWindow } from 'electron'
import { join } from 'node:path'
import { CANAUX } from '../../shared/ipc'
import type { CibleSocial, NotifMessage } from '../../shared/social'
import { preferencesInterface } from '../securite/politiques'

const LARGEUR = 380
const MARGE = 6

export class NotifMessages {
  private vue: WebContentsView | null = null
  private prete: Promise<void> | null = null
  private hauteur = 0

  constructor(
    private readonly fenetre: BrowserWindow,
    /** Clic sur une notification : ouvrir la conversation avec cet ami. */
    private readonly ouvrir: (cible: CibleSocial) => void,
    /** Place prise à droite (la petite fenêtre de discussion ouverte) : les notifications se mettent à sa gauche. */
    private readonly decalage: () => number = () => 0
  ) {
    ipcMain.on(CANAUX.notifTaille, (e, h: unknown) => {
      if (e.sender !== this.vue?.webContents || typeof h !== 'number' || !Number.isFinite(h)) return
      this.hauteur = Math.max(0, Math.min(600, Math.round(h)))
      this.placer()
    })
    ipcMain.on(CANAUX.notifOuvrir, (e, c: unknown) => {
      const cible = c as CibleSocial | null
      if (e.sender === this.vue?.webContents && (cible?.type === 'ami' || cible?.type === 'groupe') && typeof cible.id === 'string') this.ouvrir({ type: cible.type, id: cible.id })
    })
    fenetre.on('resize', () => this.placer())
  }

  async afficher(n: NotifMessage): Promise<void> {
    if (this.fenetre.isDestroyed()) return
    await this.creer()
    if (!this.vue || this.vue.webContents.isDestroyed()) return
    // au-dessus des pages ouvertes depuis la dernière fois
    this.fenetre.contentView.addChildView(this.vue)
    this.vue.webContents.send(CANAUX.notifMessage, n)
  }

  private creer(): Promise<void> {
    if (this.prete) return this.prete
    const vue = new WebContentsView({ webPreferences: preferencesInterface(join(__dirname, '../preload/notif.js')) })
    vue.setBackgroundColor('#00000000')
    vue.setVisible(false)
    // la notification ne navigue nulle part et n'ouvre aucune fenêtre
    vue.webContents.on('will-navigate', (e) => e.preventDefault())
    vue.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    this.fenetre.contentView.addChildView(vue)
    this.vue = vue
    const url = process.env.ELECTRON_RENDERER_URL
    this.prete = (url ? vue.webContents.loadURL(`${url}/notif.html`) : vue.webContents.loadFile(join(__dirname, '../renderer/notif.html'))).catch(() => undefined)
    return this.prete
  }

  private placer(): void {
    if (!this.vue || this.fenetre.isDestroyed()) return
    if (!this.hauteur) return this.vue.setVisible(false)
    const { width, height } = this.fenetre.getContentBounds()
    this.vue.setBounds({ x: width - LARGEUR - MARGE - this.decalage(), y: height - this.hauteur - MARGE, width: LARGEUR, height: this.hauteur })
    this.vue.setVisible(true)
  }
}
