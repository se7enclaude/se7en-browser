/* Menus en verre : le main prépare le menu (comme un menu natif d'Electron), l'interface le dessine en verre
 * à l'endroit du clic, et renvoie l'entrée choisie. Les actions restent dans le main, l'interface ne reçoit que des libellés.
 * Les pages web passant au-dessus de l'interface, l'interface les fige le temps du menu (leur image se floute dessous). */
import { ipcMain, screen, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { CANAUX } from '../../shared/ipc'
import type { EntreeMenuVerre } from '../../shared/onglets'

/** Menus ouverts : numéro → actions de leurs entrées. */
const menus = new Map<number, { actions: Map<string, () => void>; apres?: () => void }>()
let prochain = 1

/** « Ctrl+Shift+O » → « Ctrl+Maj+O », « Ctrl+, » → « Ctrl+Virgule ». */
function raccourciLisible(a: MenuItemConstructorOptions['accelerator']): string | undefined {
  if (typeof a !== 'string') return undefined
  return a.replace(/Shift/g, 'Maj').replace(/CommandOrControl|CmdOrCtrl/g, 'Ctrl').replace(/\+,$/, '+Virgule')
}

function convertir(modele: MenuItemConstructorOptions[], actions: Map<string, () => void>): EntreeMenuVerre[] {
  const res: EntreeMenuVerre[] = []
  for (const m of modele) {
    if (m.visible === false) continue
    if (m.type === 'separator') {
      // jamais deux séparateurs de suite, ni en tête
      if (res.length && !res.at(-1)!.separateur) res.push({ separateur: true })
      continue
    }
    const id = String(actions.size + 1)
    const click = m.click
    if (click) actions.set(id, () => (click as () => void)())
    const sous = Array.isArray(m.submenu) ? convertir(m.submenu as MenuItemConstructorOptions[], actions) : undefined
    res.push({
      id,
      libelle: m.label ?? '',
      raccourci: raccourciLisible(m.accelerator),
      actif: m.enabled !== false && (!!click || !!sous),
      coche: m.type === 'checkbox' ? !!m.checked : undefined,
      sous
    })
  }
  while (res.at(-1)?.separateur) res.pop()
  return res
}

/** Affiche un menu en verre au niveau du pointeur (ou à `position`, en coordonnées de la fenêtre). */
export function afficherMenu(fenetre: BrowserWindow, modele: MenuItemConstructorOptions[], position?: { x: number; y: number }, apres?: () => void): void {
  if (fenetre.isDestroyed()) return
  const actions = new Map<string, () => void>()
  const entrees = convertir(modele, actions)
  if (!entrees.length) return
  let p = position
  if (!p) {
    const c = screen.getCursorScreenPoint()
    const b = fenetre.getContentBounds()
    p = { x: c.x - b.x, y: c.y - b.y }
  }
  const id = prochain++
  menus.set(id, { actions, apres })
  fenetre.webContents.send(CANAUX.uiCommande, { type: 'menu', id, entrees, x: Math.round(p.x), y: Math.round(p.y) })
}

/** Réponses de l'interface : une entrée choisie (ou rien, menu fermé). */
export function brancherMenusVerre(estInterface: (sender: Electron.WebContents) => boolean): void {
  ipcMain.on(CANAUX.menuChoix, (e, id: unknown, entree: unknown) => {
    if (!estInterface(e.sender) || typeof id !== 'number') return
    const menu = menus.get(id)
    menus.delete(id)
    if (typeof entree === 'string') menu?.actions.get(entree)?.()
    menu?.apres?.()
  })
}
