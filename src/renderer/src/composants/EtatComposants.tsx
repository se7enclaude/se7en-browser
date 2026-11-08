/* Composants téléchargés (Ollama, modèles, extensions, listes du bloqueur) : « À jour » ou « Mise à jour disponible »,
 * et le petit bandeau quand une nouvelle version est trouvée (une seule fois par version). */
import { useEffect, useState } from 'react'
import { texteOllama, type EtatComposants, type TexteEtat } from '../../../shared/composants'
import type { EtatOllama } from '../../../shared/ia'
import { estPageInterne } from '../../../shared/adresse'

export function useComposants(): EtatComposants | null {
  const [e, setE] = useState<EtatComposants | null>(null)
  useEffect(() => {
    void window.se7en.composants.etat().then(setE)
    return window.se7en.composants.surChangement(setE)
  }, [])
  return e
}

/** Texte d'état, coloré selon « à jour » / « mise à jour disponible ». */
export function EtatMaj({ t, className = '' }: { t: TexteEtat; className?: string }): React.JSX.Element | null {
  if (!t.texte) return null
  return <span className={`etat-maj ${t.etat} ${className}`}>{t.texte}</span>
}

/** Ligne « Ollama : à jour / mise à jour disponible », avec le bouton seulement s'il y a une mise à jour. */
export function LigneMajOllama({ ia, composants }: { ia: EtatOllama; composants: EtatComposants | null }): React.JSX.Element | null {
  if (!composants || ia.phase === 'absent' || ia.phase === 'verification') return null
  const t = texteOllama(composants.ollama, ia.version && ia.version !== '?' ? ia.version : null)
  if (!t.texte) return null
  return (
    <div className="ligne-reglage ligne-maj">
      <span>
        Ollama · <EtatMaj t={t} />
      </span>
      {t.etat === 'mise-a-jour' && !ia.tache && (
        <button className="bouton-principal petit" title="Télécharge le dernier installeur officiel d'Ollama et l'installe sans fenêtre" onClick={() => window.se7en.composants.mettreAJourOllama()}>
          Mettre à jour Ollama
        </button>
      )}
    </div>
  )
}

/** Bouton « Rechercher les mises à jour » des composants (sans attendre les 12 heures). */
export function BoutonVerifierComposants({ composants }: { composants: EtatComposants | null }): React.JSX.Element {
  return (
    <button className="lien-discret" disabled={!composants || composants.enCours} onClick={() => void window.se7en.composants.verifier()}>
      {composants?.enCours ? 'Recherche des mises à jour…' : 'Rechercher les mises à jour'}
    </button>
  )
}

/** Bandeau en haut du navigateur : une nouvelle version d'un composant a été trouvée. */
export function BandeauComposants(): React.JSX.Element | null {
  const e = useComposants()
  const n = e?.nouveautes.at(-1)
  if (!n) return null
  return (
    <div className="bandeau-plantage" role="status">
      <span>{n.texte}</span>
      <span className="espace" />
      <button
        className="bouton-verre petit"
        onClick={() => {
          window.se7en.composants.vu(n.cle)
          if (estPageInterne(n.page)) window.se7en.onglets.interne(n.page)
        }}
      >
        Voir
      </button>
      <button className="bouton-verre petit" onClick={() => window.se7en.composants.vu(n.cle)}>
        Plus tard
      </button>
    </div>
  )
}
