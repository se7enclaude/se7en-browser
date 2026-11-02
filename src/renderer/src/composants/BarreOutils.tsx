/* Précédent / suivant / actualiser et barre d'adresse. */
import { useEffect, useRef, useState } from 'react'
import { adresseLisible } from '../../../shared/adresse'
import type { EtatOnglet } from '../../../shared/onglets'
import { IconeActualiser, IconeBarreLaterale, IconeCadenas, IconeCroix, IconePrecedent, IconeRecherche, IconeReglages, IconeSuivant } from './Icones'

interface Props {
  actif: EtatOnglet | undefined
  /** Bouton de la barre latérale (absent en disposition « onglets en haut »). */
  barre: { ouverte: boolean; basculer: () => void } | null
}

export function BarreOutils({ actif, barre }: Props): React.JSX.Element {
  const o = window.se7en.onglets
  const champ = useRef<HTMLInputElement>(null)
  const [brouillon, setBrouillon] = useState<string | null>(null)

  // Ctrl+L (même depuis une page) : focus dans la barre d'adresse
  useEffect(
    () =>
      window.se7en.app.surCommande((c) => {
        if (c.type === 'focus-adresse') {
          champ.current?.focus()
          champ.current?.select()
        }
      }),
    []
  )
  // changer d'onglet abandonne la saisie en cours
  useEffect(() => setBrouillon(null), [actif?.id])

  const id = actif?.id
  const url = actif?.url ?? ''
  const securise = url.startsWith('https://')
  const valeur = brouillon ?? (document.activeElement === champ.current ? url : adresseLisible(url))

  return (
    <div className="barre-outils">
      {barre && (
        <button className={`bouton-icone${barre.ouverte ? ' enfonce' : ''}`} title="Barre latérale (Ctrl+B)" onClick={barre.basculer}>
          <IconeBarreLaterale />
        </button>
      )}
      <button className="bouton-icone" title="Précédent (Alt+←)" disabled={!actif?.peutReculer} onClick={() => id && o.precedent(id)}>
        <IconePrecedent />
      </button>
      <button className="bouton-icone" title="Suivant (Alt+→)" disabled={!actif?.peutAvancer} onClick={() => id && o.suivant(id)}>
        <IconeSuivant />
      </button>
      {actif?.chargement ? (
        <button className="bouton-icone" title="Arrêter" onClick={() => id && o.arreter(id)}>
          <IconeCroix />
        </button>
      ) : (
        <button className="bouton-icone" title="Actualiser (F5)" disabled={!url} onClick={() => id && o.actualiser(id)}>
          <IconeActualiser />
        </button>
      )}

      <form
        className="barre-adresse"
        onSubmit={(e) => {
          e.preventDefault()
          if (!id || !brouillon?.trim()) return
          o.naviguer(id, brouillon)
          setBrouillon(null)
          champ.current?.blur()
          o.focusPage()
        }}
      >
        <span className="barre-adresse-icone" title={securise ? 'Connexion sécurisée' : undefined}>
          {securise && brouillon === null ? <IconeCadenas /> : <IconeRecherche />}
        </span>
        <input
          ref={champ}
          value={valeur}
          spellCheck={false}
          placeholder="Rechercher sur Google ou saisir une adresse"
          onChange={(e) => setBrouillon(e.target.value)}
          onFocus={(e) => {
            setBrouillon(url)
            requestAnimationFrame(() => e.target.select())
          }}
          onBlur={() => setBrouillon(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setBrouillon(null)
              e.currentTarget.blur()
              o.focusPage()
            }
          }}
        />
      </form>
      <button className="bouton-icone" title="Paramètres (Ctrl+,)" onClick={() => o.parametres()}>
        <IconeReglages />
      </button>
    </div>
  )
}
