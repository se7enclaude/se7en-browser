/* Menu clic droit d'une page web (menu en verre, voir menuVerre.ts) : actions habituelles (copier, coller, liens, images) et actions de l'IA
 * (expliquer une sélection, réécrire le texte d'un champ, demander sur une zone de l'écran).

 * Aucune action de l'IA ne modifie la page sans confirmation. */
import { clipboard, type BrowserWindow, type ContextMenuParams, type MenuItemConstructorOptions, type WebContents } from 'electron'
import { estAdresseAutorisee } from '../../shared/adresse'
import { ACTIONS_ECRITURE } from '../../shared/ecriture'
import { DEMANDE_EXPLIQUE_PAGE } from '../../shared/chat'
import { afficherMenu } from './menuVerre'

export interface ActionsMenuPage {
  /** Question envoyée au panneau IA, avec la page (et sa sélection) jointe. */
  demander: (texte: string) => void
  /** Ouvre le panneau IA, page jointe, sans envoyer de question. */
  ouvrirPanneau: () => void
  ecrire: (wc: WebContents, idAction: string) => void
  zone: () => void
  nouvelOnglet: (url: string) => void
  iaPrete: () => boolean
  /** Traduire la page (ou remettre l'original si elle est déjà traduite). */
  traduire: () => void
  traduite: () => boolean
  /** Ouvre l'aperçu « Remplir ce formulaire avec mon coffre ». */
  remplirFormulaire: () => void
  /** Position de la page dans la fenêtre (pour placer le menu au clic). */
  origine: () => { x: number; y: number } | null
}

const court = (t: string, n = 28): string => {
  const s = t.replace(/\s+/g, ' ').trim()
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

export function ouvrirMenuPage(fenetre: BrowserWindow, wc: WebContents, p: ContextMenuParams, a: ActionsMenuPage): void {
  const modele: MenuItemConstructorOptions[] = []
  const selection = p.selectionText.trim()
  const ia = a.iaPrete()

  // ---------- IA ----------
  if (selection && !p.isEditable) {
    modele.push(
      { label: `✦ Expliquer « ${court(selection)} »`, enabled: ia, click: () => a.demander('Explique simplement le texte sélectionné.') },
      { label: '✦ Résumer la sélection', enabled: ia, click: () => a.demander('Résume le texte sélectionné en quelques points.') },
      { label: '✦ Traduire en français', enabled: ia, click: () => a.demander('Traduis le texte sélectionné en français.') },
      { label: '✦ Demander à l’IA…', click: () => a.ouvrirPanneau() },
      { type: 'separator' }
    )
  }
  if (p.isEditable) {
    modele.push(
      { label: '✦ Remplir ce formulaire avec mon coffre…', click: () => a.remplirFormulaire() },
      {
        label: '✦ Aide à l’écriture',
        submenu: ACTIONS_ECRITURE.map((x) => ({ label: x.libelle, click: () => a.ecrire(wc, x.id) }))
      },
      { type: 'separator' }
    )
  }

  // ---------- édition ----------
  if (p.isEditable) {
    modele.push(
      { label: 'Annuler', accelerator: 'Ctrl+Z', enabled: p.editFlags.canUndo, click: () => wc.undo() },
      { type: 'separator' },
      { label: 'Couper', accelerator: 'Ctrl+X', enabled: p.editFlags.canCut, click: () => wc.cut() },
      { label: 'Copier', accelerator: 'Ctrl+C', enabled: p.editFlags.canCopy, click: () => wc.copy() },
      { label: 'Coller', accelerator: 'Ctrl+V', enabled: p.editFlags.canPaste, click: () => wc.paste() },
      { label: 'Tout sélectionner', accelerator: 'Ctrl+A', click: () => wc.selectAll() },
      { type: 'separator' }
    )
  } else if (selection) {
    modele.push({ label: 'Copier', accelerator: 'Ctrl+C', click: () => wc.copy() }, { type: 'separator' })
  }

  // ---------- liens et images ----------
  if (p.linkURL && estAdresseAutorisee(p.linkURL)) {
    modele.push(
      { label: 'Ouvrir le lien dans un nouvel onglet', click: () => a.nouvelOnglet(p.linkURL) },
      { label: 'Copier l’adresse du lien', click: () => clipboard.writeText(p.linkURL) },
      { type: 'separator' }
    )
  }
  if (p.mediaType === 'image' && p.srcURL) {
    if (estAdresseAutorisee(p.srcURL)) modele.push({ label: 'Ouvrir l’image dans un nouvel onglet', click: () => a.nouvelOnglet(p.srcURL) })
    modele.push({ label: 'Copier l’image', click: () => wc.copyImageAt(p.x, p.y) }, { type: 'separator' })
  }

  // ---------- page ----------
  if (!p.isEditable && !selection && !p.linkURL) {
    modele.push(
      { label: 'Précédent', enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
      { label: 'Suivant', enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() },
      { label: 'Actualiser', click: () => wc.reload() },
      { type: 'separator' },
      { label: '✦ Résumer la page', enabled: ia, click: () => a.demander('/resume') },
      { label: '✦ Explique-moi cette page', enabled: ia, click: () => a.demander(DEMANDE_EXPLIQUE_PAGE) },
      { label: '✦ Remplir un formulaire avec mon coffre…', click: () => a.remplirFormulaire() },
      a.traduite()
        ? { label: 'Afficher la page d’origine', click: () => a.traduire() }
        : { label: '✦ Traduire la page en français', enabled: ia, click: () => a.traduire() }
    )
  }
  modele.push({ label: '✦ Demander sur une zone de l’écran', enabled: ia, click: () => a.zone() })

  while (modele.at(-1)?.type === 'separator') modele.pop()
  // menu en verre, à l'endroit du clic (coordonnées de la page + position de la page dans la fenêtre)
  const b = a.origine()
  // après le choix, le clavier revient à la page (pour coller, taper…)
  afficherMenu(fenetre, modele, b ? { x: b.x + p.x, y: b.y + p.y } : undefined, () => !wc.isDestroyed() && wc.focus())
}
