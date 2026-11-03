/* Petite fenêtre de discussion, en bas à droite, au-dessus des pages : on répond à un message sans quitter sa page.
 * C'est une vue à part (une interface dessinée sous les pages serait cachée par elles) qui charge discussion.html
 * avec le même preload que l'interface du navigateur. Elle se ferme, ou s'ouvre en grand dans la page Amis. */
import { WebContentsView, type BrowserWindow } from 'electron'
import { join } from 'node:path'
import { CANAUX } from '../../shared/ipc'
import type { CibleSocial } from '../../shared/social'
import { preferencesInterface, verrouillerInterface } from '../securite/politiques'

export const LARGEUR_DISCUSSION = 400
const HAUTEUR = 560
const MARGE = 14

/** Vues d'interface en plus de la fenêtre principale (pour que l'IPC les reconnaisse et leur diffuse les évènements). */
export const vuesInterface = new Map<number, BrowserWindow>()

export class MiniDiscussion {
  private vue: WebContentsView | null = null
  private prete: Promise<void> | null = null
  private ouverte = false

  constructor(private readonly fenetre: BrowserWindow) {
    fenetre.on('resize', () => this.placer())
  }

  estOuverte(): boolean {
    return this.ouverte
  }

  async ouvrir(cible: CibleSocial): Promise<void> {
    if (this.fenetre.isDestroyed()) return
    await this.creer()
    if (!this.vue || this.vue.webContents.isDestroyed()) return
    this.ouverte = true
    // tout en haut, au-dessus des pages ouvertes entre-temps
    this.fenetre.contentView.addChildView(this.vue)
    this.placer()
    this.vue.webContents.send(CANAUX.uiCommande, { type: 'discussion', cible })
    this.vue.webContents.focus()
  }

  fermer(): void {
    this.ouverte = false
    this.placer()
    if (!this.fenetre.isDestroyed()) this.fenetre.webContents.focus()
  }

  private creer(): Promise<void> {
    if (this.prete) return this.prete
    const vue = new WebContentsView({ webPreferences: preferencesInterface(join(__dirname, '../preload/ui.js')) })
    vue.setBackgroundColor('#00000000')
    vue.setBorderRadius(24)
    vue.setVisible(false)
    verrouillerInterface(vue.webContents)
    this.fenetre.contentView.addChildView(vue)
    vuesInterface.set(vue.webContents.id, this.fenetre)
    vue.webContents.once('destroyed', () => vuesInterface.delete(vue.webContents.id))
    this.vue = vue
    const url = process.env.ELECTRON_RENDERER_URL
    this.prete = (url ? vue.webContents.loadURL(`${url}/discussion.html`) : vue.webContents.loadFile(join(__dirname, '../renderer/discussion.html'))).catch(() => undefined)
    return this.prete
  }

  private placer(): void {
    if (!this.vue || this.fenetre.isDestroyed()) return
    if (!this.ouverte) return this.vue.setVisible(false)
    const { width, height } = this.fenetre.getContentBounds()
    const h = Math.min(HAUTEUR, height - 140)
    this.vue.setBounds({ x: width - LARGEUR_DISCUSSION - MARGE, y: height - h - MARGE, width: LARGEUR_DISCUSSION, height: h })
    this.vue.setVisible(true)
  }
}
