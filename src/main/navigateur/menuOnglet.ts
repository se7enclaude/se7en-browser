/* Menu clic droit d'un onglet. Menu natif de Windows : il passe toujours au-dessus des pages web. */
import { Menu, type BrowserWindow } from 'electron'
import type { GestionnaireOnglets } from './onglets'

export function ouvrirMenuOnglet(fenetre: BrowserWindow, g: GestionnaireOnglets, id: number): void {
  const etat = g.etat()
  const o = etat.onglets.find((x) => x.id === id)
  if (!o) return
  Menu.buildFromTemplate([
    o.prioritaire
      ? { label: 'Retirer des prioritaires', click: () => g.definirPrioritaire(id, false) }
      : { label: 'Épingler en prioritaire', enabled: !!o.url, click: () => g.definirPrioritaire(id, true) },
    { label: 'Dupliquer', enabled: !!o.url, click: () => g.dupliquer(id) },
    { label: 'Actualiser', enabled: !!o.url && !o.endormi, click: () => g.actualiser(id) },
    { type: 'separator' },
    etat.split && (etat.split.gauche === id || etat.split.droite === id)
      ? { label: 'Quitter la vue partagée', click: () => g.quitterSplit() }
      : id === etat.actifId
        ? { label: 'Vue partagée avec un nouvel onglet', click: () => g.diviser() }
        : { label: "Vue partagée avec l'onglet actif", click: () => g.diviser(id) },
    { type: 'separator' },
    { label: o.prioritaire ? 'Mettre en veille' : 'Fermer', accelerator: 'Ctrl+W', click: () => g.fermer(id) },
    { label: 'Fermer les autres onglets', visible: !o.prioritaire, click: () => g.fermerAutres(id) }
  ]).popup({ window: fenetre })
}

/** Menu principal (bouton en haut à droite). */
export function ouvrirMenuPrincipal(fenetre: BrowserWindow, g: GestionnaireOnglets): void {
  const etat = g.etat()
  Menu.buildFromTemplate([
    { label: 'Nouvel onglet', accelerator: 'Ctrl+T', click: () => g.nouveau() },
    etat.split
      ? { label: 'Quitter la vue partagée', click: () => g.quitterSplit() }
      : { label: 'Vue partagée', click: () => g.diviser() },
    { type: 'separator' },
    { label: 'Historique', accelerator: 'Ctrl+H', click: () => g.ouvrirInterne('se7en://historique') },
    { label: 'Favoris', accelerator: 'Ctrl+Shift+O', click: () => g.ouvrirInterne('se7en://favoris') },
    { label: 'Téléchargements', accelerator: 'Ctrl+J', click: () => g.ouvrirInterne('se7en://telechargements') },
    { type: 'separator' },
    { label: 'Paramètres', accelerator: 'Ctrl+,', click: () => g.ouvrirInterne('se7en://parametres') }
  ]).popup({ window: fenetre })
}
