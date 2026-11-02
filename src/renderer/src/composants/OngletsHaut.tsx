/* Onglets classiques, dans la barre de titre. Glisser-déposer pour les réordonner, clic molette pour fermer. */
import { useState } from 'react'
import type { EtatOnglet, EtatOnglets } from '../../../shared/onglets'
import { IconeCroix, IconeGlobe, IconePlus } from './Icones'

export function IconeOnglet({ onglet }: { onglet: EtatOnglet }): React.JSX.Element {
  if (onglet.chargement) return <span className="roue" aria-label="Chargement" />
  if (onglet.favicon) return <img className="favicon" src={onglet.favicon} alt="" draggable={false} />
  return <IconeGlobe />
}

export function OngletsHaut({ etat }: { etat: EtatOnglets }): React.JSX.Element {
  const o = window.se7en.onglets
  const [glisse, setGlisse] = useState<number | null>(null)

  return (
    <div className="onglets-haut" role="tablist">
      {etat.onglets.map((onglet, index) => (
        <div
          key={onglet.id}
          role="tab"
          aria-selected={onglet.id === etat.actifId}
          className={`onglet${onglet.id === etat.actifId ? ' actif' : ''}${glisse === onglet.id ? ' glisse' : ''}`}
          title={onglet.titre}
          draggable
          onMouseDown={(e) => e.button === 0 && o.activer(onglet.id)}
          onAuxClick={(e) => e.button === 1 && o.fermer(onglet.id)}
          onDragStart={(e) => {
            setGlisse(onglet.id)
            e.dataTransfer.effectAllowed = 'move'
          }}
          onDragEnd={() => setGlisse(null)}
          onDragOver={(e) => {
            if (glisse === null || glisse === onglet.id) return
            e.preventDefault()
            o.deplacer(glisse, index)
          }}
        >
          <IconeOnglet onglet={onglet} />
          <span className="onglet-titre">{onglet.titre}</span>
          <button
            className="onglet-fermer"
            title="Fermer l'onglet (Ctrl+W)"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => o.fermer(onglet.id)}
          >
            <IconeCroix />
          </button>
        </div>
      ))}
      <button className="bouton-icone nouvel-onglet" title="Nouvel onglet (Ctrl+T)" onClick={() => o.nouveau()}>
        <IconePlus />
      </button>
    </div>
  )
}
