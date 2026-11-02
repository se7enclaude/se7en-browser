/* Barre latérale gauche : les onglets prioritaires (épinglés, gardés entre les sessions),
 * et en disposition « à gauche » les onglets normaux en dessous. Ctrl+B l'affiche ou la cache. */
import type { EtatOnglets } from '../../../shared/onglets'
import type { Glisser } from '../useGlisser'
import { IconePlus } from './Icones'
import { OngletItem } from './OngletItem'
import { BoutonRanger, rendreAvecGroupes } from './OngletsHaut'

interface Props {
  etat: EtatOnglets
  glisser: Glisser
  ouverte: boolean
  avecNormaux: boolean
}

export function BarreLaterale({ etat, glisser, ouverte, avecNormaux }: Props): React.JSX.Element {
  const o = window.se7en.onglets
  const prioritaires = etat.onglets.filter((x) => x.prioritaire)
  const normaux = etat.onglets.filter((x) => !x.prioritaire)

  return (
    <aside className={`barre-laterale${ouverte ? ' ouverte' : ''}`} aria-hidden={!ouverte}>
      <div className="barre-laterale-contenu">
        <div className="titre-section">Prioritaires</div>
        <div className="liste-onglets" {...glisser.zone((id) => o.prioritaire(id, true))}>
          {prioritaires.map((x) => (
            <OngletItem key={x.id} onglet={x} actif={x.id === etat.actifId} forme="ligne" glisser={glisser} />
          ))}
          {prioritaires.length === 0 && (
            <div className={`depot-vide${glisser.id !== null ? ' actif' : ''}`}>
              Glisse un onglet ici, ou clic droit › « Épingler en prioritaire »
            </div>
          )}
          {prioritaires.length > 0 && glisser.id !== null && <div className="depot-fin">Lâcher pour épingler</div>}
        </div>

        {avecNormaux && (
          <>
            <div className="separateur" />
            <div className="ligne-actions-laterales">
              <button className="ligne-nouvel-onglet" onClick={() => o.nouveau()}>
                <IconePlus />
                <span>Nouvel onglet</span>
              </button>
              <BoutonRanger etat={etat} />
            </div>
            <div className="liste-onglets defile" {...glisser.zone((id) => o.prioritaire(id, false))}>
              {rendreAvecGroupes(normaux, etat.groupes, (x) => (
                <OngletItem onglet={x} actif={x.id === etat.actifId} forme="ligne" glisser={glisser} />
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
