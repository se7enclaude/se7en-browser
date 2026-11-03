/* Menu principal, en verre, accroché au bouton qui l'ouvre : il se déroule depuis le bouton (et s'enroule en se fermant).
 * Les pages web passant au-dessus de l'interface, elles sont figées le temps du menu : leur image se floute sous le verre.
 * Clavier : ↑ ↓ pour choisir, Entrée pour valider, Échap pour fermer. */
import { useEffect, useRef, useState } from 'react'
import type { EtatOnglets } from '../../../shared/onglets'
import { useFigerPages } from '../pagesFigees'

interface Entree {
  libelle: string
  raccourci?: string
  actif?: boolean
  action: () => void
}

function entrees(etat: EtatOnglets): (Entree | 'separateur')[] {
  const o = window.se7en.onglets
  const aRanger = etat.onglets.filter((x) => !x.prioritaire && x.url && !x.url.startsWith('se7en://')).length >= 3
  return [
    { libelle: 'Nouvel onglet', raccourci: 'Ctrl+T', action: () => o.nouveau() },
    { libelle: 'Ouvrir un fichier PDF…', raccourci: 'Ctrl+O', action: () => window.se7en.app.ouvrirFichier() },
    etat.split ? { libelle: 'Quitter la vue partagée', action: () => o.quitterSplit() } : { libelle: 'Vue partagée', action: () => o.diviser() },
    { libelle: 'Ranger les onglets avec l’IA', actif: aRanger, action: () => void window.se7en.groupes.ranger() },
    'separateur',
    { libelle: 'Historique', raccourci: 'Ctrl+H', action: () => o.interne('se7en://historique') },
    { libelle: 'Favoris', raccourci: 'Ctrl+Maj+O', action: () => o.interne('se7en://favoris') },
    { libelle: 'Téléchargements', raccourci: 'Ctrl+J', action: () => o.interne('se7en://telechargements') },
    { libelle: 'Amis', action: () => o.interne('se7en://amis') },
    'separateur',
    { libelle: 'Paramètres', raccourci: 'Ctrl+Virgule', action: () => o.interne('se7en://parametres') }
  ]
}

const DUREE_FERMETURE = 160

export function MenuPrincipal({ etat, fermer }: { etat: EtatOnglets; fermer: () => void }): React.JSX.Element {
  useFigerPages()
  const [sortie, setSortie] = useState(false)
  const [choix, setChoix] = useState(-1)
  const menu = useRef<HTMLDivElement>(null)
  const liste = entrees(etat)
  const actives = liste.flatMap((e, i) => (e !== 'separateur' && e.actif !== false ? [i] : []))

  /** Le menu s'enroule, puis l'action a lieu (la page revient avant, sans à-coup). */
  const quitter = (action?: () => void): void => {
    if (sortie) return
    setSortie(true)
    setTimeout(() => {
      fermer()
      action?.()
    }, DUREE_FERMETURE)
  }

  useEffect(() => {
    menu.current?.focus({ preventScroll: true })
  }, [])
  useEffect(() => {
    const dehors = (e: PointerEvent): void => {
      if (!menu.current?.contains(e.target as Node) && !(e.target as Element).closest?.('.bouton-menu')) quitter()
    }
    const clavier = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') return quitter()
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const pos = actives.indexOf(choix)
        const suivant = e.key === 'ArrowDown' ? (pos + 1) % actives.length : (pos <= 0 ? actives.length : pos) - 1
        setChoix(actives[suivant])
      }
      if (e.key === 'Enter' && choix >= 0) {
        const x = liste[choix]
        if (x !== 'separateur') quitter(x.action)
      }
    }
    // la fenêtre perd le focus (clic dans une page, autre application) : le menu se referme
    const perdu = (): void => quitter()
    window.addEventListener('pointerdown', dehors)
    window.addEventListener('keydown', clavier)
    window.addEventListener('blur', perdu)
    return () => {
      window.removeEventListener('pointerdown', dehors)
      window.removeEventListener('keydown', clavier)
      window.removeEventListener('blur', perdu)
    }
  })

  let rang = 0
  return (
    <div ref={menu} className={`menu-verre${sortie ? ' sortie' : ''}`} role="menu" tabIndex={-1}>
      {liste.map((e, i) =>
        e === 'separateur' ? (
          <div key={i} className="separateur-menu" />
        ) : (
          <button
            key={i}
            role="menuitem"
            className={`entree-menu${i === choix ? ' choisie' : ''}`}
            disabled={e.actif === false}
            // chaque ligne arrive un peu après la précédente : le menu « se déroule »
            style={{ animationDelay: `${40 + rang++ * 18}ms` }}
            onMouseEnter={() => setChoix(i)}
            onClick={() => quitter(e.action)}
          >
            <span>{e.libelle}</span>
            {e.raccourci && <kbd>{e.raccourci}</kbd>}
          </button>
        )
      )}
    </div>
  )
}
