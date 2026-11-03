/* Précédent / suivant / actualiser et barre d'adresse. */
import { useEffect, useRef, useState } from 'react'
import { adresseLisible } from '../../../shared/adresse'
import type { EtatOnglet, EtatOnglets } from '../../../shared/onglets'
import { BoutonVpn } from './BoutonVpn'
import { MenuPrincipal } from './MenuPrincipal'
import { useFavoris, useTelechargements } from '../useDonnees'
import { ChoixRechercheIA, modeSaisie } from './ChoixRechercheIA'
import {
  IconeActualiser,
  IconeBarreLaterale,
  IconeBouclier,
  IconeCadenas,
  IconeCroix,
  IconeEtoile,
  IconeTraduire,
  IconePrive,
  IconeIA,
  IconePrecedent,
  IconeRecherche,
  IconeReglages,
  IconeSplit,
  IconeSuivant,
  IconeTelecharger
} from './Icones'

interface Props {
  actif: EtatOnglet | undefined
  /** Pour le menu principal (vue partagée, onglets à ranger). */
  etat: EtatOnglets
  enSplit: boolean
  /** Bouton de la barre latérale (absent en disposition « onglets en haut »). */
  barre: { ouverte: boolean; basculer: () => void } | null
  /** Panneau IA : ouvert ou non, et « Demande ou cherche ». */
  ia: { ouverte: boolean; basculer: () => void; demander: (texte: string) => void }
  bloqueurActif: boolean
}

export function BarreOutils({ actif, etat, enSplit, barre, ia, bloqueurActif }: Props): React.JSX.Element {
  const [menuOuvert, setMenuOuvert] = useState(false)
  const o = window.se7en.onglets
  const favoris = useFavoris()
  const telechargements = useTelechargements()
  const champ = useRef<HTMLInputElement>(null)
  const [brouillon, setBrouillon] = useState<string | null>(null)
  const [force, setForce] = useState<'recherche' | 'ia' | null>(null)

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
  const mode = brouillon === null ? null : modeSaisie(brouillon, force)

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
          // « Demande ou cherche » : une question part dans le panneau IA, avec la page actuelle
          if (mode === 'ia') ia.demander(brouillon.trim())
          else o.naviguer(id, brouillon)
          setBrouillon(null)
          setForce(null)
          champ.current?.blur()
          if (mode !== 'ia') o.focusPage()
        }}
      >
        <span className="barre-adresse-icone" title={securise ? 'Connexion sécurisée' : undefined}>
          {securise && brouillon === null ? <IconeCadenas /> : <IconeRecherche />}
        </span>
        <input
          ref={champ}
          value={valeur}
          spellCheck={false}
          placeholder="Chercher, saisir une adresse ou demander à l'IA"
          onChange={(e) => setBrouillon(e.target.value)}
          onFocus={(e) => {
            setBrouillon(url)
            requestAnimationFrame(() => e.target.select())
          }}
          onBlur={() => {
            setBrouillon(null)
            setForce(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Tab' && (mode === 'recherche' || mode === 'ia')) {
              e.preventDefault()
              setForce(mode === 'ia' ? 'recherche' : 'ia')
            }
            if (e.key === 'Escape') {
              setBrouillon(null)
              e.currentTarget.blur()
              o.focusPage()
            }
          }}
        />
        {(mode === 'recherche' || mode === 'ia') && <ChoixRechercheIA mode={mode} changer={setForce} />}
        {estWeb && brouillon === null && actif && (
          <button
            type="button"
            className={`bouton-bouclier${bloqueurActif ? '' : ' eteint'}`}
            title={bloqueurActif ? `Bloqueur : ${actif.bloques} pub(s) et traqueur(s) bloqué(s)` : 'Bloqueur désactivé'}
            onClick={() => window.se7en.bloqueur.menu(actif.id)}
          >
            <IconeBouclier />
            {bloqueurActif && actif.bloques > 0 && <span className="compteur-bloques">{actif.bloques > 99 ? '99+' : actif.bloques}</span>}
          </button>
        )}
        {actif?.prive && (
          <span className="badge-prive" title="Onglet privé : rien n’est gardé">
            <IconePrive /> Privé
          </span>
        )}
        {estWeb && actif && brouillon === null && (
          <button
            type="button"
            className={`bouton-etoile bouton-traduire${actif.traduction && actif.traduction.etat !== 'erreur' ? ' actif' : ''}${actif.traduction?.etat === 'en-cours' ? ' en-cours' : ''}`}
            title={actif.traduction ? 'Afficher la page d’origine' : 'Traduire la page en français (IA locale)'}
            onClick={() => (actif.traduction ? window.se7en.traduction.original(actif.id) : window.se7en.traduction.traduire(actif.id))}
          >
            <IconeTraduire />
          </button>
        )}
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
      <BoutonVpn />
      <button className={`bouton-icone bouton-ia${ia.ouverte ? ' enfonce' : ''}`} title="IA locale (Ctrl+Espace)" onClick={ia.basculer}>
        <IconeIA />
      </button>
      <div className="ancre-menu">
        <button className={`bouton-icone bouton-menu${menuOuvert ? ' enfonce' : ''}`} title="Menu" aria-expanded={menuOuvert} onClick={() => setMenuOuvert((v) => !v)}>
          <IconeReglages />
        </button>
        {menuOuvert && <MenuPrincipal etat={etat} fermer={() => setMenuOuvert(false)} />}
      </div>
    </div>
  )
}
