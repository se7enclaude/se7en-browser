/* Un onglet, dans l'une de ses trois formes : en haut, en ligne (barre latérale) ou en icône seule. */
import { useRef } from 'react'
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
  const ref = useRef<HTMLDivElement>(null)
  const classes = ['onglet', `onglet-${forme}`, actif && 'actif', onglet.endormi && 'endormi', glisser.id === onglet.id && 'glisse']
  /** L'onglet se replie avant de disparaître (un prioritaire, lui, se met juste en veille). */
  const fermer = (): void => {
    const el = ref.current
    if (!el || onglet.prioritaire || forme === 'icone' || matchMedia('(prefers-reduced-motion: reduce)').matches) return o.fermer(onglet.id)
    const r = el.getBoundingClientRect()
    el.style.pointerEvents = 'none'
    const vertical = forme === 'ligne'
    const depart = vertical ? { height: `${r.height}px`, opacity: 1 } : { width: `${r.width}px`, minWidth: `${r.width}px`, opacity: 1 }
    const fin = vertical
      ? { height: '0px', opacity: 0, transform: 'scale(0.96)', marginTop: '0px', marginBottom: '0px' }
      : { width: '0px', minWidth: '0px', opacity: 0, transform: 'scale(0.9)', paddingLeft: '0px', paddingRight: '0px' }
    el.style.flex = 'none'
    // fermé à la fin de l'animation, ou au bout de 220 ms quoi qu'il arrive (une fenêtre cachée n'anime rien)
    let fait = false
    const finir = (): void => {
      if (fait) return
      fait = true
      o.fermer(onglet.id)
    }
    el.animate([depart, fin], { duration: 170, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }).finished.then(finir, finir)
    setTimeout(finir, 220)
  }
  return (
    <div
      ref={ref}
      data-flip={onglet.id}
      role="tab"
      aria-selected={actif}
      className={classes.filter(Boolean).join(' ')}
      title={onglet.titre}
      draggable
      onMouseDown={(e) => e.button === 0 && o.activer(onglet.id)}
      onAuxClick={(e) => e.button === 1 && fermer()}
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
            onClick={fermer}
          >
            <IconeCroix />
          </button>
        </>
      )}
    </div>
  )
}
