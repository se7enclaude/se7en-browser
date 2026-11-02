/* Un onglet, dans l'une de ses trois formes : en haut, en ligne (barre latérale) ou en icône seule. */
import type { EtatOnglet } from '../../../shared/onglets'
import { IconeAmis, IconeCroix, IconeEtoile, IconeGlobe, IconeHistorique, IconeIA, IconePdf, IconeReglages, IconeTelecharger } from './Icones'
import type { Glisser } from '../useGlisser'

export function IconeOnglet({ onglet }: { onglet: EtatOnglet }): React.JSX.Element {
  if (onglet.chargement) return <span className="roue" aria-label="Chargement" />
  if (onglet.url === 'se7en://parametres') return <IconeReglages />
  if (onglet.url === 'se7en://historique') return <IconeHistorique />
  if (onglet.url === 'se7en://favoris') return <IconeEtoile />
  if (onglet.url === 'se7en://telechargements') return <IconeTelecharger />
  if (onglet.url === 'se7en://ia') return <IconeIA />
  if (onglet.url === 'se7en://amis') return <IconeAmis />
  if (onglet.pdf) return <IconePdf />
  if (onglet.favicon) return <img className="favicon" src={onglet.favicon} alt="" draggable={false} />
  return <IconeGlobe />
}

interface Props {
  onglet: EtatOnglet
  actif: boolean
  forme: 'haut' | 'ligne' | 'icone'
  glisser: Glisser
}

export function OngletItem({ onglet, actif, forme, glisser }: Props): React.JSX.Element {
  const o = window.se7en.onglets
  const classes = ['onglet', `onglet-${forme}`, actif && 'actif', onglet.endormi && 'endormi', glisser.id === onglet.id && 'glisse']
  return (
    <div
      role="tab"
      aria-selected={actif}
      className={classes.filter(Boolean).join(' ')}
      title={onglet.titre}
      draggable
      onMouseDown={(e) => e.button === 0 && o.activer(onglet.id)}
      onAuxClick={(e) => e.button === 1 && o.fermer(onglet.id)}
      onContextMenu={(e) => {
        e.preventDefault()
        o.menu(onglet.id)
      }}
      {...glisser.sur(onglet.id)}
    >
      <IconeOnglet onglet={onglet} />
      {forme !== 'icone' && (
        <>
          <span className="onglet-titre">{onglet.titre}</span>
          <button
            className="onglet-fermer"
            title={onglet.prioritaire ? 'Mettre en veille (Ctrl+W)' : "Fermer l'onglet (Ctrl+W)"}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => o.fermer(onglet.id)}
          >
            <IconeCroix />
          </button>
        </>
      )}
    </div>
  )
}
