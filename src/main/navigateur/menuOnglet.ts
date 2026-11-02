/* Menu clic droit d'un onglet. Menu natif de Windows : il passe toujours au-dessus des pages web. */
import { Menu, type BrowserWindow } from 'electron'
import type { GestionnaireOnglets } from './onglets'

export function ouvrirMenuOnglet(fenetre: BrowserWindow, g: GestionnaireOnglets, id: number): void {
  const o = g.etat().onglets.find((x) => x.id === id)
  if (!o) return
  Menu.buildFromTemplate([
    o.prioritaire
      ? { label: 'Retirer des prioritaires', click: () => g.definirPrioritaire(id, false) }
      : { label: 'Épingler en prioritaire', enabled: !!o.url, click: () => g.definirPrioritaire(id, true) },
    { label: 'Dupliquer', enabled: !!o.url, click: () => g.dupliquer(id) },
    { label: 'Actualiser', enabled: !!o.url && !o.endormi, click: () => g.actualiser(id) },
    { type: 'separator' },
    { label: o.prioritaire ? 'Mettre en veille' : 'Fermer', accelerator: 'Ctrl+W', click: () => g.fermer(id) },
    { label: 'Fermer les autres onglets', visible: !o.prioritaire, click: () => g.fermerAutres(id) }
  ]).popup({ window: fenetre })
}
