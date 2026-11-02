/* Barre de titre maison : zone de déplacement de la fenêtre et boutons réduire / agrandir / fermer. */
import { useEffect, useState, type ReactNode } from 'react'
import type { EtatFenetre } from '../../../shared/ipc'

export function BarreTitre({ children }: { children?: ReactNode }): React.JSX.Element {
  const [etat, setEtat] = useState<EtatFenetre>({ agrandie: false, focus: true })
  useEffect(() => window.se7en.fenetre.surEtat(setEtat), [])
  const f = window.se7en.fenetre

  return (
    <header className={`barre-titre${etat.focus ? '' : ' inactive'}`} onDoubleClick={(e) => e.target === e.currentTarget && f.agrandir()}>
      <div className="logo" aria-label="se7en Browser">
        <span className="logo-7">7</span>
      </div>
      <div className="barre-titre-centre">{children}</div>
      <div className="boutons-fenetre">
        <button className="bouton-fenetre" title="Réduire" onClick={f.reduire}>
          <svg viewBox="0 0 10 10" aria-hidden><path d="M1 5h8" /></svg>
        </button>
        <button className="bouton-fenetre" title={etat.agrandie ? 'Restaurer' : 'Agrandir'} onClick={f.agrandir}>
          {etat.agrandie ? (
            <svg viewBox="0 0 10 10" aria-hidden><rect x="1" y="3" width="6" height="6" rx="1.5" /><path d="M3 3V2.5A1.5 1.5 0 0 1 4.5 1H7.5A1.5 1.5 0 0 1 9 2.5V5.5A1.5 1.5 0 0 1 7.5 7H7" /></svg>
          ) : (
            <svg viewBox="0 0 10 10" aria-hidden><rect x="1.5" y="1.5" width="7" height="7" rx="1.8" /></svg>
          )}
        </button>
        <button className="bouton-fenetre fermer" title="Fermer" onClick={f.fermer}>
          <svg viewBox="0 0 10 10" aria-hidden><path d="M2 2l6 6M8 2l-6 6" /></svg>
        </button>
      </div>
    </header>
  )
}
