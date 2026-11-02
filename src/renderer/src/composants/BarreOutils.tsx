/* Précédent / suivant / actualiser et barre d'adresse. */
import { useEffect, useRef, useState } from 'react'
import { adresseLisible } from '../../../shared/adresse'
import type { EtatOnglet } from '../../../shared/onglets'
import { useFavoris, useTelechargements } from '../useDonnees'
import {
  IconeActualiser,
  IconeBarreLaterale,
  IconeCadenas,
  IconeCroix,
  IconeEtoile,
  IconePrecedent,
  IconeRecherche,
  IconeReglages,
  IconeSplit,
  IconeSuivant,
  IconeTelecharger
} from './Icones'

interface Props {
  actif: EtatOnglet | undefined
  enSplit: boolean
  /** Bouton de la barre latérale (absent en disposition « onglets en haut »). */
  barre: { ouverte: boolean; basculer: () => void } | null
}

export function BarreOutils({ actif, enSplit, barre }: Props): React.JSX.Element {
  const o = window.se7en.onglets
  const favoris = useFavoris()
  const telechargements = useTelechargements()
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
  const estWeb = /^https?:\/\//.test(url)
  const favori = favoris.some((f) => f.url === url)
  const enCours = telechargements.filter((t) => t.etat === 'en-cours')
  const total = enCours.reduce((s, t) => s + t.total, 0)
  const progres = total > 0 ? Math.round((enCours.reduce((s, t) => s + t.recus, 0) / total) * 100) : 25
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
        {estWeb && brouillon === null && (
          <button
            type="button"
            className={`bouton-etoile${favori ? ' actif' : ''}`}
            title={favori ? 'Retirer des favoris (Ctrl+D)' : 'Ajouter aux favoris (Ctrl+D)'}
            onClick={() => id && window.se7en.favoris.basculer(id)}
          >
            <IconeEtoile pleine={favori} />
          </button>
        )}
      </form>
      <button
        className={`bouton-icone${enSplit ? ' enfonce' : ''}`}
        title={enSplit ? 'Quitter la vue partagée' : 'Vue partagée'}
        onClick={() => (enSplit ? o.quitterSplit() : o.diviser())}
      >
        <IconeSplit />
      </button>
      {telechargements.length > 0 && (
        <button className="bouton-icone bouton-telechargements" title="Téléchargements (Ctrl+J)" onClick={() => o.interne('se7en://telechargements')}>
          <IconeTelecharger />
          {enCours.length > 0 && (
            <svg className="anneau" viewBox="0 0 30 30" aria-hidden>
              <circle cx="15" cy="15" r="13" pathLength="100" strokeDasharray={`${progres} 100`} />
            </svg>
          )}
        </button>
      )}
      <button className="bouton-icone" title="Menu" onClick={() => window.se7en.app.menu()}>
        <IconeReglages />
      </button>
    </div>
  )
}
