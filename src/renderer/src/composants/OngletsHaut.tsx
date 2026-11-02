/* Onglets classiques, dans la barre de titre. Les prioritaires y apparaissent en icônes quand la barre latérale est cachée. */
import type { EtatOnglets } from '../../../shared/onglets'
import type { Glisser } from '../useGlisser'
import { IconePlus } from './Icones'
import { OngletItem } from './OngletItem'

interface Props {
  etat: EtatOnglets
  glisser: Glisser
  avecNormaux: boolean
  avecPrioritaires: boolean
}

export function OngletsHaut({ etat, glisser, avecNormaux, avecPrioritaires }: Props): React.JSX.Element {
  const prioritaires = etat.onglets.filter((o) => o.prioritaire)
  const normaux = etat.onglets.filter((o) => !o.prioritaire)
  return (
    <div className="onglets-haut" role="tablist" {...glisser.zone((id) => window.se7en.onglets.prioritaire(id, false))}>
      {avecPrioritaires &&
        prioritaires.map((o) => <OngletItem key={o.id} onglet={o} actif={o.id === etat.actifId} forme="icone" glisser={glisser} />)}
      {avecPrioritaires && prioritaires.length > 0 && avecNormaux && <span className="separateur-vertical" />}
      {avecNormaux && (
        <>
          {normaux.map((o) => (
            <OngletItem key={o.id} onglet={o} actif={o.id === etat.actifId} forme="haut" glisser={glisser} />
          ))}
          <button className="bouton-icone nouvel-onglet" title="Nouvel onglet (Ctrl+T)" onClick={() => window.se7en.onglets.nouveau()}>
            <IconePlus />
          </button>
        </>
      )}
    </div>
  )
}
