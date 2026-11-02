/* Interface du navigateur : barre de titre (onglets du haut), barre latérale (prioritaires), barre d'outils, zone de page. */
import { Accueil } from './composants/Accueil'
import { BarreLaterale } from './composants/BarreLaterale'
import { BarreOutils } from './composants/BarreOutils'
import { BarreTitre } from './composants/BarreTitre'
import { NouvelOnglet } from './composants/NouvelOnglet'
import { OngletsHaut } from './composants/OngletsHaut'
import { Parametres } from './composants/Parametres'
import { ZonePage } from './composants/ZonePage'
import { useGlisser } from './useGlisser'
import { useOnglets } from './useOnglets'
import { useAttributsTheme, useInfosApp, useReglages } from './useReglages'

export function App(): React.JSX.Element {
  const [reglages, modifier] = useReglages()
  const infos = useInfosApp()
  useAttributsTheme(reglages, infos)
  const { etat, actif } = useOnglets()
  const glisser = useGlisser()

  const disposition = reglages?.disposition ?? 'les-deux'
  const barreDispo = disposition !== 'haut'
  const barreOuverte = barreDispo && !!reglages?.barreLaterale
  // Barre latérale cachée en disposition « à gauche » : les onglets remontent en haut pour rester accessibles.
  const normauxEnHaut = disposition !== 'gauche' || !barreOuverte

  let contenu: React.ReactNode = null
  if (actif && !actif.url) contenu = <NouvelOnglet key={actif.id} onglet={actif} />
  else if (actif?.url === 'se7en://parametres' && reglages) contenu = <Parametres reglages={reglages} modifier={modifier} infos={infos} />

  return (
    <div className="coque">
      <BarreTitre>
        <OngletsHaut etat={etat} glisser={glisser} avecNormaux={normauxEnHaut} avecPrioritaires={!barreOuverte} />
      </BarreTitre>
      <div className="corps">
        <BarreLaterale etat={etat} glisser={glisser} ouverte={barreOuverte} avecNormaux={disposition === 'gauche'} />
        <div className="colonne">
          <BarreOutils
            actif={actif}
            barre={barreDispo ? { ouverte: barreOuverte, basculer: () => modifier({ barreLaterale: !barreOuverte }) } : null}
          />
          <ZonePage actif={actif}>{contenu}</ZonePage>
        </div>
      </div>
      {reglages && !reglages.accueilTermine && <Accueil reglages={reglages} modifier={modifier} />}
    </div>
  )
}
