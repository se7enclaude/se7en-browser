/* Barre « Activer l'IA locale ? », sous la barre d'adresse, à l'ouverture du navigateur.
 * Ollama ne démarre que si l'utilisateur dit oui ; il s'arrête quand le navigateur se ferme. */
import { useState } from 'react'
import type { EtatOllama } from '../../../shared/ia'
import type { Reglages } from '../../../shared/reglages'
import { IconeIA } from './Icones'

interface Props {
  reglages: Reglages
  modifier: (p: Partial<Reglages>) => void
  ia: EtatOllama | null
}

export function QuestionIA({ reglages, modifier, ia }: Props): React.JSX.Element | null {
  const [repondu, setRepondu] = useState(false)
  const [retenir, setRetenir] = useState(false)

  const demarrage = ia?.tache?.type === 'demarrage'
  const visible = reglages.accueilTermine && reglages.iaDemarrage === 'demander' && (demarrage || (!repondu && ia?.phase === 'arrete'))
  if (!visible) return null

  const repondre = (oui: boolean): void => {
    setRepondu(true)
    if (retenir) modifier({ iaDemarrage: oui ? 'toujours' : 'jamais' })
    if (oui) window.se7en.ia.demarrer()
  }

  return (
    <div className="barre-info" role="dialog" aria-label="Activer l'IA locale">
      <IconeIA />
      {demarrage ? (
        <span className="barre-info-texte">Activation de l'IA locale…</span>
      ) : (
        <>
          <span className="barre-info-texte">
            <strong>Activer l'IA locale ?</strong> <span className="discret">Elle tourne sur ton PC et s'arrête quand tu fermes le navigateur.</span>
          </span>
          <label className="case">
            <input type="checkbox" checked={retenir} onChange={(e) => setRetenir(e.target.checked)} />
            Retenir mon choix
          </label>
          <button className="bouton-verre" onClick={() => repondre(false)}>
            Pas maintenant
          </button>
          <button className="bouton-principal" onClick={() => repondre(true)}>
            Activer
          </button>
        </>
      )}
    </div>
  )
}
