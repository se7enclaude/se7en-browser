/* Interface du navigateur : barre de titre avec onglets, barre d'outils, zone de page. */
import { BarreOutils } from './composants/BarreOutils'
import { BarreTitre } from './composants/BarreTitre'
import { NouvelOnglet } from './composants/NouvelOnglet'
import { OngletsHaut } from './composants/OngletsHaut'
import { ZonePage } from './composants/ZonePage'
import { useOnglets } from './useOnglets'
import { useAttributsTheme, useInfosApp, useReglages } from './useReglages'

export function App(): React.JSX.Element {
  const [reglages] = useReglages()
  const infos = useInfosApp()
  useAttributsTheme(reglages, infos)
  const { etat, actif } = useOnglets()

  return (
    <div className="coque">
      <BarreTitre>
        <OngletsHaut etat={etat} />
      </BarreTitre>
      <BarreOutils actif={actif} />
      <ZonePage actif={actif}>{actif && <NouvelOnglet key={actif.id} onglet={actif} />}</ZonePage>
    </div>
  )
}
