/* Aide à l'écriture : la proposition de l'IA s'affiche ici, au-dessus de la page.
 * Elle peut être retouchée ; le champ de la page n'est modifié qu'au clic sur « Remplacer ». */
import { useEffect, useRef, useState } from 'react'
import type { EtatEcriture } from '../../../shared/ecriture'
import { IconeCroix, IconeIA } from './Icones'

export function BandeauEcriture(): React.JSX.Element | null {
  const [etat, setEtat] = useState<EtatEcriture | null>(null)
  const [texte, setTexte] = useState('')
  // tant que l'utilisateur n'a pas retouché la proposition, elle suit ce que l'IA écrit
  const modifie = useRef(false)
  const idActuel = useRef<string | null>(null)

  useEffect(
    () =>
      window.se7en.ecriture.surEtat((e) => {
        setEtat(e)
        if (!e) return
        if (e.id !== idActuel.current) {
          idActuel.current = e.id
          modifie.current = false
        }
        if (!modifie.current) setTexte(e.proposition)
      }),
    []
  )
  if (!etat) return null

  return (
    <section className="bandeau-ecriture verre-fort">
      <header>
        <IconeIA />
        <strong>{etat.action}</strong>
        {etat.phase === 'ecriture' && <span className="discret attente">L’IA écrit…</span>}
        <span className="espace" />
        <button className="bouton-icone" title="Fermer" onClick={() => window.se7en.ecriture.annuler()}>
          <IconeCroix />
        </button>
      </header>
      {etat.phase === 'erreur' ? (
        <p className="message-erreur">{etat.erreur}</p>
      ) : (
        <>
          <textarea
            className="champ proposition"
            value={texte}
            readOnly={etat.phase !== 'pret'}
            onChange={(e) => {
              modifie.current = true
              setTexte(e.target.value)
            }}
            rows={Math.min(8, Math.max(2, texte.split('\n').length + 1))}
          />
          <div className="actions-ecriture">
            <span className="discret petit">Tu peux retoucher le texte avant de le mettre dans le champ.</span>
            <span className="espace" />
            <button className="bouton-verre" disabled={etat.phase !== 'pret'} onClick={() => void navigator.clipboard.writeText(texte)}>
              Copier
            </button>
            <button className="bouton-principal" disabled={etat.phase !== 'pret' || !texte.trim()} onClick={() => window.se7en.ecriture.appliquer(etat.id, texte)}>
              Remplacer
            </button>
          </div>
        </>
      )}
    </section>
  )
}
