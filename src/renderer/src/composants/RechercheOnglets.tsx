/* Ctrl+Maj+A : chercher parmi les onglets ouverts (titre et adresse), y compris les prioritaires et ceux en veille. */
import { useEffect, useMemo, useState } from 'react'
import { adresseLisible } from '../../../shared/adresse'
import type { EtatOnglets } from '../../../shared/onglets'
import { normaliser } from '../../../shared/coffre'
import { IconeRecherche } from './Icones'
import { IconeOnglet } from './OngletItem'
import { useFigerPages } from '../pagesFigees'

export function RechercheOnglets({ etat, fermer }: { etat: EtatOnglets; fermer: () => void }): React.JSX.Element {
  const [texte, setTexte] = useState('')
  const [choix, setChoix] = useState(0)

  // les pages passent au-dessus de l'interface : figées (et floutées sous le verre) le temps de la recherche
  useFigerPages()

  const liste = useMemo(() => {
    const mots = normaliser(texte).split(' ').filter(Boolean)
    return etat.onglets.filter((o) => {
      const cible = normaliser(`${o.titre} ${o.url}`)
      return mots.every((m) => cible.includes(m))
    })
  }, [texte, etat.onglets])
  useEffect(() => setChoix(0), [texte])

  const ouvrir = (id: number): void => {
    window.se7en.onglets.activer(id)
    fermer()
  }

  return (
    <div className="fond-recherche-onglets" onMouseDown={(e) => e.target === e.currentTarget && fermer()}>
      <div className="recherche-onglets verre-fort">
        <label className="champ-recherche-onglets">
          <IconeRecherche />
          <input
            autoFocus
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            placeholder={`Chercher parmi ${etat.onglets.length} onglet${etat.onglets.length > 1 ? 's' : ''}`}
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === 'Escape') fermer()
              if (e.key === 'ArrowDown') (e.preventDefault(), setChoix((c) => Math.min(c + 1, liste.length - 1)))
              if (e.key === 'ArrowUp') (e.preventDefault(), setChoix((c) => Math.max(c - 1, 0)))
              if (e.key === 'Enter' && liste[choix]) ouvrir(liste[choix].id)
            }}
          />
          <kbd>Échap</kbd>
        </label>
        <div className="resultats-onglets">
          {liste.length === 0 && <p className="vide">Aucun onglet ne correspond.</p>}
          {liste.map((o, i) => (
            <button key={o.id} className={`resultat-onglet${i === choix ? ' actif' : ''}`} onMouseEnter={() => setChoix(i)} onClick={() => ouvrir(o.id)}>
              <IconeOnglet onglet={o} />
              <span className="titre-resultat">{o.titre || 'Nouvel onglet'}</span>
              <span className="adresse-resultat">{o.url ? adresseLisible(o.url) : ''}</span>
              {o.id === etat.actifId && <span className="etiquette-resultat">actif</span>}
              {o.endormi && <span className="etiquette-resultat">en veille</span>}
              {o.prioritaire && <span className="etiquette-resultat">prioritaire</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
