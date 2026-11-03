/* Bandeau « naviguer ensemble » : invitation reçue (rejoindre ou non), invitation envoyée, session en cours
 * (qui guide, prendre la main, arrêter). Visible sur tous les onglets tant qu'il y a quelque chose en cours. */
import { useEffect, useState } from 'react'
import type { EtatEnsemble } from '../../../shared/social'
import { IconeEnsemble } from './Icones'

export function BandeauEnsemble(): React.JSX.Element | null {
  const [e, setE] = useState<EtatEnsemble>(null)
  useEffect(() => {
    void window.se7en.ensemble.etat().then(setE)
    return window.se7en.ensemble.surEtat(setE)
  }, [])
  if (!e) return null
  const en = window.se7en.ensemble
  return (
    <div className={`bandeau-ensemble${e.etat === 'actif' ? ' actif' : ''}`} role="status">
      <IconeEnsemble />
      {e.etat === 'invitation-recue' && (
        <>
          <span>
            <strong>{e.pseudo}</strong> t’invite à naviguer ensemble{e.titre ? <> sur « {e.titre} »</> : null}.
          </span>
          <span className="espace" />
          <button className="bouton-principal petit" onClick={() => en.repondre(true)}>
            Rejoindre
          </button>
          <button className="bouton-verre petit" onClick={() => en.repondre(false)}>
            Non merci
          </button>
        </>
      )}
      {e.etat === 'invitation-envoyee' && (
        <>
          <span>Invitation envoyée à {e.pseudo}…</span>
          <span className="espace" />
          <button className="bouton-verre petit" onClick={() => en.arreter()}>
            Annuler
          </button>
        </>
      )}
      {e.etat === 'actif' && (
        <>
          <span>
            Tu navigues avec <strong>{e.pseudo}</strong> · {e.role === 'guide' ? 'c’est toi qui guides' : `${e.pseudo} guide`}
          </span>
          <span className="espace" />
          {e.ongletId !== null && (
            <button className="bouton-verre petit" onClick={() => window.se7en.onglets.activer(e.ongletId!)}>
              Voir l’onglet
            </button>
          )}
          {e.role === 'suit' && (
            <button className="bouton-verre petit" onClick={() => en.prendreLaMain()}>
              Prendre la main
            </button>
          )}
          <button className="bouton-verre petit" onClick={() => en.arreter()}>
            Arrêter
          </button>
        </>
      )}
    </div>
  )
}
