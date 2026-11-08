/* Mise à jour du navigateur : pastille dans la barre de titre, et réglages dans Paramètres › À propos. */
import { useEffect, useState } from 'react'
import type { EtatMiseAJour } from '../../../shared/miseAJour'
import type { Reglages } from '../../../shared/reglages'
import { Interrupteur } from './ReglagesViePrivee'

export function useMiseAJour(): EtatMiseAJour | null {
  const [e, setE] = useState<EtatMiseAJour | null>(null)
  useEffect(() => {
    void window.se7en.miseAJour.etat().then(setE)
    return window.se7en.miseAJour.surChangement(setE)
  }, [])
  return e
}

/** Barre de titre : la mise à jour est prête → « Redémarrer pour mettre à jour ». */
export function PastilleMiseAJour(): React.JSX.Element | null {
  const e = useMiseAJour()
  if (e?.phase !== 'prete') return null
  return (
    <button className="pastille-maj" title={e.notes || 'Une nouvelle version est prête'} onClick={() => window.se7en.miseAJour.installer()}>
      Redémarrer pour la version {e.version}
    </button>
  )
}

export function ReglagesMiseAJour({ reglages, modifier, version }: { reglages: Reglages; modifier: (p: Partial<Reglages>) => void; version?: string }): React.JSX.Element {
  const e = useMiseAJour()
  const texte = !e
    ? ''
    : e.phase === 'recherche'
      ? 'Recherche…'
      : e.phase === 'telechargement'
        ? `Téléchargement de la version ${e.version} : ${Math.round((e.progression ?? 0) * 100)} %`
        : e.phase === 'prete'
          ? `La version ${e.version} est prête : elle s’installera à la fermeture du navigateur.`
          : e.phase === 'erreur'
            ? `Mise à jour impossible : ${e.erreur}`
            : e.version
              ? `La version ${e.version} est disponible.`
              : e.verifiee
                ? 'Tu as la dernière version.'
                : ''
  return (
    <>
      <div className="ligne-reglage">
        <span>se7en Browser {version}</span>
        {e?.phase === 'prete' ? (
          <button className="bouton-principal" onClick={() => window.se7en.miseAJour.installer()}>
            Redémarrer et mettre à jour
          </button>
        ) : (
          <button className="bouton-verre" disabled={e?.phase === 'recherche' || e?.phase === 'telechargement'} onClick={() => void window.se7en.miseAJour.verifier()}>
            Rechercher une mise à jour
          </button>
        )}
      </div>
      {texte && <p className="discret petit">{texte}</p>}
      <div className="ligne-reglage">
        <span>Mettre à jour le navigateur automatiquement</span>
        <Interrupteur label="Mise à jour automatique" actif={reglages.miseAJourAuto} changer={(v) => modifier({ miseAJourAuto: v })} />
      </div>
      <div className="ligne-reglage">
        <span>Mettre à jour les modèles Qwen de l’IA automatiquement (seulement quand une nouvelle version est publiée)</span>
        <Interrupteur label="Mise à jour des modèles" actif={reglages.modelesAuto} changer={(v) => modifier({ modelesAuto: v })} />
      </div>
    </>
  )
}
