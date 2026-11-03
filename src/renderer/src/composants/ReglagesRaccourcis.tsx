/* Paramètres › Raccourcis clavier : chaque action peut recevoir une autre combinaison.
 * Pendant la saisie, les raccourcis du navigateur sont suspendus (sinon Ctrl+T ouvrirait un onglet au lieu d'être choisi). */
import { useEffect, useState } from 'react'
import { combinaison, combinaisonValide, RACCOURCIS_CONFIGURABLES, raccourcisActuels } from '../../../shared/raccourcis'
import type { Reglages } from '../../../shared/reglages'

export function ReglagesRaccourcis({ reglages, modifier }: { reglages: Reglages; modifier: (p: Partial<Reglages>) => void }): React.JSX.Element {
  const [capture, setCapture] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const actuels = raccourcisActuels(reglages.raccourcis)

  useEffect(() => {
    if (!capture) return
    window.se7en.app.captureRaccourci(true)
    const touche = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') return setCapture(null)
      const c = combinaison({ key: e.key, code: e.code, control: e.ctrlKey, shift: e.shiftKey, alt: e.altKey })
      if (!c) return // touche de modification seule : on attend la suite
      if (!combinaisonValide(c)) return setMessage('Utilise Ctrl ou Alt avec une touche, ou une touche F1 à F12.')
      const deja = RACCOURCIS_CONFIGURABLES.find((r) => r.id !== capture && actuels[r.id] === c)
      if (deja) return setMessage(`${c} sert déjà à « ${deja.libelle} ». Change-le d’abord, ou choisis une autre combinaison.`)
      const defaut = RACCOURCIS_CONFIGURABLES.find((r) => r.id === capture)!.defaut
      const { [capture]: _, ...autres } = reglages.raccourcis
      modifier({ raccourcis: c === defaut ? autres : { ...autres, [capture]: c } })
      setMessage(null)
      setCapture(null)
    }
    window.addEventListener('keydown', touche, true)
    return () => {
      window.removeEventListener('keydown', touche, true)
      window.se7en.app.captureRaccourci(false)
    }
  }, [capture, reglages.raccourcis])

  return (
    <section className="bloc verre-fort">
      <div className="entete-section">
        <h2>Raccourcis clavier</h2>
        {Object.keys(reglages.raccourcis).length > 0 && (
          <button className="bouton-verre petit" onClick={() => modifier({ raccourcis: {} })}>
            Tout remettre par défaut
          </button>
        )}
      </div>
      <p className="discret petit">Clique sur un raccourci puis appuie sur la nouvelle combinaison (Échap pour annuler).</p>
      <div className="liste-raccourcis">
        {RACCOURCIS_CONFIGURABLES.map((r) => (
          <div key={r.id} className="ligne-raccourci">
            <span>{r.libelle}</span>
            <button className={`touche-raccourci${capture === r.id ? ' en-attente' : ''}${reglages.raccourcis[r.id] ? ' perso' : ''}`} onClick={() => setCapture(capture === r.id ? null : r.id)}>
              {capture === r.id ? 'Appuie sur les touches…' : actuels[r.id].replace('Ctrl+,', 'Ctrl+Virgule')}
            </button>
          </div>
        ))}
      </div>
      {message && <p className="message-erreur">{message}</p>}
    </section>
  )
}
