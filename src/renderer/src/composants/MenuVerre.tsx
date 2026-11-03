/* Menu en verre : accroché sous un bouton (menu principal) ou à l'endroit d'un clic droit (menus préparés par le main).
 * Il se déroule à l'ouverture et s'enroule à la fermeture ; l'action choisie a lieu une fois le menu refermé.
 * Les pages web passant au-dessus de l'interface, elles sont figées le temps du menu : leur image se floute sous le verre.
 * Clavier : ↑ ↓ pour choisir, → pour ouvrir un sous-menu, ← pour le refermer, Entrée pour valider, Échap pour fermer. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useFigerPages } from '../pagesFigees'

export interface ElementMenu {
  id?: string
  libelle?: string
  raccourci?: string
  /** false : grisé. */
  actif?: boolean
  coche?: boolean
  separateur?: boolean
  sous?: ElementMenu[]
  action?: () => void
}

export type PositionMenu = { type: 'ancre' } | { type: 'point'; x: number; y: number }

const DUREE_FERMETURE = 160
const MARGE = 8

interface Props {
  elements: ElementMenu[]
  position: PositionMenu
  /** Appelé une fois le menu refermé, avec l'élément choisi (ou rien). */
  fermer: (choix?: ElementMenu) => void
}

export function MenuVerre({ elements, position, fermer }: Props): React.JSX.Element {
  useFigerPages()
  const [sortie, setSortie] = useState(false)
  const racine = useRef<HTMLDivElement>(null)

  const quitter = (choix?: ElementMenu): void => {
    if (sortie) return
    setSortie(true)
    setTimeout(() => fermer(choix), DUREE_FERMETURE)
  }

  useEffect(() => {
    const dehors = (e: PointerEvent): void => {
      const cible = e.target as Element
      if (!racine.current?.contains(cible) && !cible.closest?.('.bouton-menu')) quitter()
    }
    const perdu = (): void => quitter()
    window.addEventListener('pointerdown', dehors)
    window.addEventListener('blur', perdu)
    return () => {
      window.removeEventListener('pointerdown', dehors)
      window.removeEventListener('blur', perdu)
    }
  })

  return (
    <div ref={racine} className="racine-menu">
      <Panneau elements={elements} position={position} sortie={sortie} quitter={quitter} premier />
    </div>
  )
}

interface PropsPanneau {
  elements: ElementMenu[]
  position: PositionMenu
  sortie: boolean
  quitter: (choix?: ElementMenu) => void
  premier?: boolean
  /** Sous-menu : ← le referme. */
  refermer?: () => void
}

function Panneau({ elements, position, sortie, quitter, premier, refermer }: PropsPanneau): React.JSX.Element {
  const [choix, setChoix] = useState(-1)
  const [sousOuvert, setSousOuvert] = useState<{ index: number; x: number; y: number } | null>(null)
  const [place, setPlace] = useState<{ left: number; top: number; origine: string } | null>(null)
  const panneau = useRef<HTMLDivElement>(null)
  const actifs = elements.flatMap((e, i) => (!e.separateur && e.actif !== false ? [i] : []))

  // au point du clic : décalé pour rester dans la fenêtre (vers la gauche ou vers le haut s'il le faut)
  useLayoutEffect(() => {
    if (position.type !== 'point' || !panneau.current) return
    const r = panneau.current.getBoundingClientRect()
    const versGauche = position.x + r.width + MARGE > innerWidth
    const versHaut = position.y + r.height + MARGE > innerHeight
    const left = versGauche ? Math.max(MARGE, position.x - r.width) : position.x
    const top = versHaut ? Math.max(MARGE, Math.min(position.y, innerHeight - MARGE) - r.height) : position.y
    setPlace({ left, top, origine: `${versHaut ? 'bottom' : 'top'} ${versGauche ? 'right' : 'left'}` })
  }, [position.type === 'point' ? position.x : 0, position.type === 'point' ? position.y : 0])

  const ouvrirSous = (i: number): void => {
    const ligne = panneau.current?.querySelector<HTMLElement>(`[data-index="${i}"]`)
    const r = ligne?.getBoundingClientRect()
    if (r) setSousOuvert({ index: i, x: r.right - 4, y: r.top - 6 })
  }
  const valider = (i: number): void => {
    const e = elements[i]
    if (!e || e.separateur || e.actif === false) return
    if (e.sous) return ouvrirSous(i)
    quitter(e)
  }

  // clavier : seulement le panneau le plus profond répond
  useEffect(() => {
    if (sousOuvert) return
    const clavier = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') return quitter()
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const pos = actifs.indexOf(choix)
        const suivant = e.key === 'ArrowDown' ? (pos + 1) % actifs.length : (pos <= 0 ? actifs.length : pos) - 1
        setChoix(actifs[suivant])
      } else if (e.key === 'Enter' && choix >= 0) {
        e.preventDefault()
        valider(choix)
      } else if (e.key === 'ArrowRight' && choix >= 0 && elements[choix]?.sous) ouvrirSous(choix)
      else if (e.key === 'ArrowLeft' && refermer) refermer()
    }
    window.addEventListener('keydown', clavier)
    return () => window.removeEventListener('keydown', clavier)
  })

  const style: React.CSSProperties =
    position.type === 'point'
      ? { position: 'fixed', left: place?.left ?? position.x, top: place?.top ?? position.y, transformOrigin: place?.origine ?? 'top left', visibility: place ? 'visible' : 'hidden' }
      : {}
  let rang = 0
  return (
    <>
      <div
        ref={panneau}
        className={`menu-verre${position.type === 'ancre' ? ' ancre' : ''}${premier ? '' : ' sous-menu'}${sortie ? ' sortie' : ''}`}
        role="menu"
        style={style}
      >
        {elements.map((e, i) =>
          e.separateur ? (
            <div key={i} className="separateur-menu" />
          ) : (
            <button
              key={i}
              data-index={i}
              role="menuitem"
              className={`entree-menu${i === choix ? ' choisie' : ''}${e.sous && sousOuvert?.index === i ? ' ouverte' : ''}`}
              disabled={e.actif === false}
              // chaque ligne arrive un peu après la précédente : le menu « se déroule »
              style={{ animationDelay: `${40 + rang++ * 18}ms` }}
              onMouseEnter={() => {
                setChoix(i)
                if (e.sous) ouvrirSous(i)
                else setSousOuvert(null)
              }}
              onClick={() => valider(i)}
            >
              {e.coche !== undefined && <span className={`coche${e.coche ? ' oui' : ''}`}>{e.coche ? '✓' : ''}</span>}
              <span className="libelle-entree">{e.libelle}</span>
              {e.raccourci && <kbd>{e.raccourci}</kbd>}
              {e.sous && <span className="fleche-sous">›</span>}
            </button>
          )
        )}
      </div>
      {sousOuvert && elements[sousOuvert.index]?.sous && (
        <Panneau
          key={sousOuvert.index}
          elements={elements[sousOuvert.index].sous!}
          position={{ type: 'point', x: sousOuvert.x, y: sousOuvert.y }}
          sortie={sortie}
          quitter={quitter}
          refermer={() => setSousOuvert(null)}
        />
      )}
    </>
  )
}
