/* Emplacement des pages. Le main y pose la vue de chaque onglet visible ; l'interface indique leur position exacte.
 * Un seul volet d'habitude, deux en vue partagée (séparés par une poignée qu'on peut glisser).
 * Quand un onglet n'a pas de page web (Nouvel onglet, page interne) ou a planté, c'est l'interface qui dessine son volet. */
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import type { EtatOnglet, EtatOnglets, ZoneOnglet } from '../../../shared/onglets'

interface Props {
  etat: EtatOnglets
  /** Ce que l'interface dessine pour un onglet sans page web. */
  contenu: (onglet: EtatOnglet) => ReactNode
}

export function ZonePage({ etat, contenu }: Props): React.JSX.Element {
  const volets = useRef(new Map<number, HTMLDivElement>())
  const zone = useRef<HTMLDivElement>(null)
  const [ratioGlisse, setRatioGlisse] = useState<number | null>(null)

  const actif = etat.onglets.find((o) => o.id === etat.actifId)
  const split = etat.split
  const enSplit = !!split && !!actif && (split.gauche === actif.id || split.droite === actif.id)
  const visibles = (enSplit ? [split.gauche, split.droite] : actif ? [actif.id] : [])
    .map((id) => etat.onglets.find((o) => o.id === id))
    .filter((o): o is EtatOnglet => !!o)
  const ratio = ratioGlisse ?? split?.ratio ?? 0.5
  const cle = visibles.map((o) => o.id).join(',')

  // Envoie la position de chaque volet au main, à chaque changement de taille.
  useEffect(() => {
    const envoyer = (): void => {
      const liste: ZoneOnglet[] = []
      for (const [id, el] of volets.current) {
        const r = el.getBoundingClientRect()
        // 1 px de marge : le liseré de verre reste visible autour de la page
        liste.push({ id, zone: { x: r.left + 1, y: r.top + 1, width: Math.max(0, r.width - 2), height: Math.max(0, r.height - 2) } })
      }
      window.se7en.onglets.zones(liste)
    }
    const obs = new ResizeObserver(envoyer)
    for (const el of volets.current.values()) obs.observe(el)
    window.addEventListener('resize', envoyer)
    envoyer()
    return () => {
      obs.disconnect()
      window.removeEventListener('resize', envoyer)
    }
  }, [cle])

  const glisserPoignee = (): void => {
    const z = zone.current?.getBoundingClientRect()
    if (!z) return
    // Pendant le glissement, les pages sont cachées : sinon la souris passerait « dans » une page
    // et l'interface ne recevrait plus ses mouvements.
    window.se7en.onglets.masquer(true)
    const calcul = (x: number): number => Math.min(0.8, Math.max(0.2, (x - z.left) / z.width))
    const bouger = (ev: PointerEvent): void => setRatioGlisse(calcul(ev.clientX))
    const lacher = (ev: PointerEvent): void => {
      window.se7en.onglets.ratio(calcul(ev.clientX))
      window.se7en.onglets.masquer(false)
      setRatioGlisse(null)
      window.removeEventListener('pointermove', bouger)
      window.removeEventListener('pointerup', lacher)
    }
    window.addEventListener('pointermove', bouger)
    window.addEventListener('pointerup', lacher)
  }

  return (
    <main ref={zone} className={`zone-page${enSplit ? ' partagee' : ''}`}>
      {visibles.map((o, i) => (
        <Fragment key={o.id}>
        {i === 1 && <div className="poignee" onPointerDown={glisserPoignee} title="Glisser pour redimensionner" />}
        <div
          ref={(el) => {
            if (el) volets.current.set(o.id, el)
            else volets.current.delete(o.id)
          }}
          className={`volet verre${enSplit && o.id === etat.actifId ? ' actif' : ''}`}
          // la poignée fait 8 px : chaque volet en cède la moitié
          style={enSplit ? { flexBasis: `calc(${(i === 0 ? ratio : 1 - ratio) * 100}% - 4px)` } : undefined}
          onMouseDown={() => enSplit && o.id !== etat.actifId && window.se7en.onglets.activer(o.id)}
        >
          {o.chargement && <div className="progression" />}
          {o.plantee ? (
            <div className="page-plantee">
              <h2>Cette page a planté</h2>
              <button className="bouton-verre" onClick={() => window.se7en.onglets.actualiser(o.id)}>
                Recharger
              </button>
            </div>
          ) : (
            contenu(o)
          )}
        </div>
        </Fragment>
      ))}
    </main>
  )
}
