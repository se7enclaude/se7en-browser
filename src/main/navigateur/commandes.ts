/* Exécute un raccourci clavier sur le navigateur. */
import type { BrowserWindow, Input } from 'electron'
import { CANAUX } from '../../shared/ipc'
import type { CommandeUi } from '../../shared/onglets'
import type { MagasinReglages } from '../stockage/reglages'
import type { GestionnaireOnglets } from './onglets'
import { actionDuRaccourci } from './raccourcis'

export function creerGestionRaccourcis(fenetre: BrowserWindow, onglets: () => GestionnaireOnglets, reglages: MagasinReglages) {
  const versUi = (c: CommandeUi): void => {
    fenetre.webContents.focus()
    fenetre.webContents.send(CANAUX.uiCommande, c)
  }

  /** Renvoie vrai si la touche était un raccourci du navigateur (elle n'atteint alors pas la page). */
  return (input: Input): boolean => {
    const action = actionDuRaccourci(input)
    if (!action) return false
    const g = onglets()
    const id = g.etat().actifId
    switch (action.type) {
      case 'nouvel-onglet':
        g.nouveau()
        versUi({ type: 'focus-adresse' })
        break
      case 'fermer-onglet':
        if (id !== null) g.fermer(id)
        break
      case 'rouvrir-onglet':
        g.rouvrir()
        break
      case 'onglet-suivant':
        g.activerVoisin(1)
        break
      case 'onglet-precedent':
        g.activerVoisin(-1)
        break
      case 'onglet-numero':
        g.activerNumero(action.index)
        break
      case 'focus-adresse':
        versUi({ type: 'focus-adresse' })
        break
      case 'actualiser':
        if (id !== null) g.actualiser(id, action.forcer)
        break
      case 'precedent':
        if (id !== null) g.precedent(id)
        break
      case 'suivant':
        if (id !== null) g.suivant(id)
        break
      case 'arreter':
        if (id !== null) g.arreter(id)
        break
      case 'basculer-barre':
        void reglages.modifier({ barreLaterale: !reglages.get().barreLaterale })
        break
      case 'parametres':
        g.ouvrirInterne('se7en://parametres')
        break
    }
    return true
  }
}
