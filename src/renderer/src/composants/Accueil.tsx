/* Écran du premier lancement : disposition des onglets, puis thème et teinte. Tout reste modifiable dans les paramètres. */
import { useEffect, useState } from 'react'
import type { Reglages } from '../../../shared/reglages'
import { ChoixDisposition, ChoixTeinte, ChoixTheme } from './ChoixApparence'

export function Accueil({ reglages, modifier }: { reglages: Reglages; modifier: (p: Partial<Reglages>) => void }): React.JSX.Element {
  const [etape, setEtape] = useState(0)

  // l'écran passe par-dessus les pages déjà ouvertes
  useEffect(() => {
    window.se7en.onglets.masquer(true)
    return () => window.se7en.onglets.masquer(false)
  }, [])

  return (
    <div className="accueil">
      <section className="accueil-carte verre-fort" key={etape}>
        {etape === 0 && (
          <>
            <div className="logo grand">
              <span className="logo-7">7</span>
            </div>
            <h1>Bienvenue dans se7en Browser</h1>
            <p className="discret">Un navigateur léger, en verre, avec une IA qui reste sur ton PC. Deux choix et c'est parti.</p>
            <button className="bouton-principal" onClick={() => setEtape(1)}>
              Commencer
            </button>
          </>
        )}
        {etape === 1 && (
          <>
            <h2>Où veux-tu tes onglets ?</h2>
            <p className="discret">Les onglets prioritaires restent épinglés à gauche d'une session à l'autre. Ctrl+B les cache ou les montre.</p>
            <ChoixDisposition reglages={reglages} modifier={modifier} />
            <div className="accueil-actions">
              <button className="bouton-verre" onClick={() => setEtape(0)}>
                Retour
              </button>
              <button className="bouton-principal" onClick={() => setEtape(2)}>
                Suivant
              </button>
            </div>
          </>
        )}
        {etape === 2 && (
          <>
            <h2>Ton style</h2>
            <p className="discret">Auto suit le thème de Windows.</p>
            <div className="ligne-reglage">
              <span>Thème</span>
              <ChoixTheme reglages={reglages} modifier={modifier} />
            </div>
            <div className="ligne-reglage">
              <span>Couleur du verre</span>
              <ChoixTeinte reglages={reglages} modifier={modifier} />
            </div>
            <div className="accueil-actions">
              <button className="bouton-verre" onClick={() => setEtape(1)}>
                Retour
              </button>
              <button
                className="bouton-principal"
                onClick={() => {
                  modifier({ accueilTermine: true })
                  // on enchaîne sur la préparation de l'IA locale
                  window.se7en.onglets.interne('se7en://ia')
                }}
              >
                C'est parti
              </button>
            </div>
          </>
        )}
        <div className="points-etapes" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className={i === etape ? 'actif' : ''} />
          ))}
        </div>
      </section>
    </div>
  )
}
