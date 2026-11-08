/* Menu principal : un menu en verre accroché au bouton ⚙ de la barre d'outils, qui se déroule depuis lui. */
import type { EtatOnglets } from '../../../shared/onglets'
import { MenuVerre, type ElementMenu } from './MenuVerre'

function elements(etat: EtatOnglets): ElementMenu[] {
  const o = window.se7en.onglets
  const aRanger = etat.onglets.filter((x) => !x.prioritaire && x.url && !x.url.startsWith('se7en://')).length >= 3
  return [
    { libelle: 'Nouvel onglet', raccourci: 'Ctrl+T', action: () => o.nouveau() },
    { libelle: 'Nouvel onglet privé', raccourci: 'Ctrl+Maj+N', action: () => o.nouveauPrive() },
    { libelle: 'Ouvrir un fichier PDF…', raccourci: 'Ctrl+O', action: () => window.se7en.app.ouvrirFichier() },
    etat.split ? { libelle: 'Quitter la vue partagée', action: () => o.quitterSplit() } : { libelle: 'Vue partagée', action: () => o.diviser() },
    { libelle: 'Ranger les onglets avec l’IA', actif: aRanger, action: () => void window.se7en.groupes.ranger() },
    { separateur: true },
    { libelle: 'Historique', raccourci: 'Ctrl+H', action: () => o.interne('se7en://historique') },
    { libelle: 'Favoris', raccourci: 'Ctrl+Maj+O', action: () => o.interne('se7en://favoris') },
    { libelle: 'Téléchargements', raccourci: 'Ctrl+J', action: () => o.interne('se7en://telechargements') },
    { libelle: 'Amis', action: () => o.interne('se7en://amis') },
    { libelle: 'Tâches', action: () => o.interne('se7en://taches') },
    { separateur: true },
    { libelle: 'Paramètres', raccourci: 'Ctrl+Virgule', action: () => o.interne('se7en://parametres') }
  ]
}

export function MenuPrincipal({ etat, fermer }: { etat: EtatOnglets; fermer: () => void }): React.JSX.Element {
  return (
    <MenuVerre
      elements={elements(etat)}
      position={{ type: 'ancre' }}
      fermer={(choix) => {
        fermer()
        choix?.action?.()
      }}
    />
  )
}
