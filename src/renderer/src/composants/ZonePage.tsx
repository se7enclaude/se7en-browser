/* Emplacement de la page web. Le main y pose la vue de l'onglet actif ; l'interface indique sa position exacte.
 * Quand l'onglet n'a rien chargé (Nouvel onglet) ou a planté, c'est l'interface qui dessine ici. */
import { useEffect, useRef, type ReactNode } from 'react'
import type { EtatOnglet } from '../../../shared/onglets'

export function ZonePage({ actif, children }: { actif: EtatOnglet | undefined; children?: ReactNode }): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const envoyer = (): void => {
      const r = el.getBoundingClientRect()
      // 1 px de marge : le liseré de verre reste visible autour de la page
      window.se7en.onglets.zone({ x: r.left + 1, y: r.top + 1, width: Math.max(0, r.width - 2), height: Math.max(0, r.height - 2) })
    }
    const obs = new ResizeObserver(envoyer)
    obs.observe(el)
    window.addEventListener('resize', envoyer)
    envoyer()
    return () => {
      obs.disconnect()
      window.removeEventListener('resize', envoyer)
    }
  }, [])

  return (
    <main ref={ref} className="zone-page verre">
      {actif?.chargement && <div className="progression" />}
      {actif?.plantee ? (
        <div className="page-plantee">
          <h2>Cette page a planté</h2>
          <button className="bouton-verre" onClick={() => window.se7en.onglets.actualiser(actif.id)}>
            Recharger
          </button>
        </div>
      ) : (
        !actif?.url && children
      )}
    </main>
  )
}
