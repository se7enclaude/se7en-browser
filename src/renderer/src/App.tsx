/* Interface du navigateur : barre de titre (onglets du haut), barre latérale (prioritaires), barre d'outils, zone de page. */
import type { EtatOnglet } from '../../shared/onglets'
import { Accueil } from './composants/Accueil'
import { BarreLaterale } from './composants/BarreLaterale'
import { BarreOutils } from './composants/BarreOutils'
import { BarreTitre } from './composants/BarreTitre'
import { NouvelOnglet } from './composants/NouvelOnglet'
import { OngletsHaut } from './composants/OngletsHaut'
import { PageFavoris, PageHistorique, PageTelechargements } from './composants/PagesDonnees'
import { PageIA, useOllama } from './composants/PageIA'
import { QuestionIA } from './composants/QuestionIA'
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
  const ia = useOllama()

  const disposition = reglages?.disposition ?? 'les-deux'
  const barreDispo = disposition !== 'haut'
  const barreOuverte = barreDispo && !!reglages?.barreLaterale
  // Barre latérale cachée en disposition « à gauche » : les onglets remontent en haut pour rester accessibles.
  const normauxEnHaut = disposition !== 'gauche' || !barreOuverte
  const enSplit = !!etat.split && !!actif && (etat.split.gauche === actif.id || etat.split.droite === actif.id)

  /** Ce que l'interface dessine à la place d'une page web. */
  const contenu = (o: EtatOnglet): React.ReactNode => {
    switch (o.url) {
      case '':
        return <NouvelOnglet key={o.id} onglet={o} />
      case 'se7en://parametres':
        return reglages && <Parametres reglages={reglages} modifier={modifier} infos={infos} />
      case 'se7en://historique':
        return <PageHistorique idOnglet={o.id} />
      case 'se7en://favoris':
        return <PageFavoris idOnglet={o.id} />
      case 'se7en://telechargements':
        return <PageTelechargements />
      case 'se7en://ia':
        return reglages && <PageIA reglages={reglages} />
      default:
        return null
    }
  }

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
            enSplit={enSplit}
            barre={barreDispo ? { ouverte: barreOuverte, basculer: () => modifier({ barreLaterale: !barreOuverte }) } : null}
          />
          {reglages && <QuestionIA reglages={reglages} modifier={modifier} ia={ia} />}
          <ZonePage etat={etat} contenu={contenu} />
        </div>
      </div>
      {reglages && !reglages.accueilTermine && <Accueil reglages={reglages} modifier={modifier} />}
    </div>
  )
}
