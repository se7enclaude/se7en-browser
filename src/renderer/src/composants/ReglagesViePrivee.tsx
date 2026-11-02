/* Paramètres › Confidentialité (bloqueur) et Mémoire de l'IA. */
import { useEffect, useState } from 'react'
import type { Souvenir } from '../../../shared/chat'
import type { Reglages } from '../../../shared/reglages'
import { IconeCroix } from './Icones'

interface Props {
  reglages: Reglages
  modifier: (p: Partial<Reglages>) => void
}

export function Interrupteur({ actif, changer, label }: { actif: boolean; changer: (v: boolean) => void; label: string }): React.JSX.Element {
  return <button role="switch" aria-checked={actif} aria-label={label} className={`interrupteur${actif ? ' actif' : ''}`} onClick={() => changer(!actif)} />
}

export function ReglagesBloqueur({ reglages, modifier }: Props): React.JSX.Element {
  return (
    <section className="bloc verre-fort">
      <h2>Confidentialité</h2>
      <div className="ligne-reglage">
        <span>Bloquer les publicités et les traqueurs</span>
        <Interrupteur label="Bloquer les publicités et les traqueurs" actif={reglages.bloqueur} changer={(v) => modifier({ bloqueur: v })} />
      </div>
      <p className="discret petit">
        Listes EasyList et EasyPrivacy (préparées par Ghostery), renouvelées chaque semaine. Le blocage se fait sur le réseau, sans rien ajouter aux pages. Le bouclier de la barre
        d'adresse montre ce qui a été bloqué, et permet de désactiver le bloqueur sur un site.
      </p>
      {reglages.bloqueurExceptions.length > 0 && (
        <>
          <span className="etiquette-petite">Sites où le bloqueur est désactivé</span>
          <div className="liste-chips">
            {reglages.bloqueurExceptions.map((h) => (
              <button key={h} className="chip actif" title="Réactiver le bloqueur sur ce site" onClick={() => modifier({ bloqueurExceptions: reglages.bloqueurExceptions.filter((x) => x !== h) })}>
                <span>{h}</span>
                <IconeCroix />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

export function ReglagesMemoire({ reglages, modifier }: Props): React.JSX.Element {
  const [souvenirs, setSouvenirs] = useState<Souvenir[]>([])
  const [nouveau, setNouveau] = useState('')
  useEffect(() => {
    window.se7en.memoire.lire().then(setSouvenirs)
  }, [])

  return (
    <section className="bloc verre-fort">
      <h2>Mémoire de l'IA</h2>
      <div className="ligne-reglage">
        <span>L'IA se souvient de ce que je lui demande de retenir</span>
        <Interrupteur label="Mémoire de l'IA" actif={reglages.memoire} changer={(v) => modifier({ memoire: v })} />
      </div>
      <p className="discret petit">
        Dans le panneau IA, écris « retiens que… » ou « oublie… ». Seul ce que tu tapes toi-même est retenu : jamais le contenu d'une page. Tout reste sur ce PC.
      </p>
      {souvenirs.length === 0 && <p className="vide">Rien en mémoire pour l'instant.</p>}
      {souvenirs.map((s) => (
        <div key={s.id} className="ligne-liste">
          <span className="titre-liste">{s.texte}</span>
          <span className="espace" />
          <button className="bouton-icone discret-survol" title="Oublier" onClick={async () => setSouvenirs(await window.se7en.memoire.supprimer(s.id))}>
            <IconeCroix />
          </button>
        </div>
      ))}
      <form
        className="ligne-reglage"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!nouveau.trim()) return
          setSouvenirs(await window.se7en.memoire.ajouter(nouveau.trim()))
          setNouveau('')
        }}
      >
        <input className="champ large" value={nouveau} onChange={(e) => setNouveau(e.target.value)} placeholder="Ajouter quelque chose à retenir (ex. Je suis végétarien)" />
        <button className="bouton-verre" type="submit" disabled={!nouveau.trim()}>
          Ajouter
        </button>
        <button
          className="bouton-verre"
          type="button"
          disabled={souvenirs.length === 0}
          onClick={async () => {
            if (confirm("Effacer tout ce que l'IA a retenu ?")) setSouvenirs(await window.se7en.memoire.effacer())
          }}
        >
          Tout oublier
        </button>
      </form>
    </section>
  )
}

/** Mémoire de navigation : pages vues ces 30 derniers jours, pour que l'IA les retrouve. */
export function ReglagesNavigation({ reglages, modifier }: Props): React.JSX.Element {
  const [nombre, setNombre] = useState(0)
  useEffect(() => {
    window.se7en.navigation.nombre().then(setNombre)
  }, [reglages.memoireNavigation])

  return (
    <section className="bloc verre-fort">
      <h2>Mémoire de navigation</h2>
      <div className="ligne-reglage">
        <span>L'IA peut retrouver les pages que j'ai vues</span>
        <Interrupteur label="Mémoire de navigation" actif={reglages.memoireNavigation} changer={(v) => modifier({ memoireNavigation: v })} />
      </div>
      <p className="discret petit">
        Le texte des pages visitées est gardé sur ce PC pendant 30 jours, puis effacé tout seul. Les pages avec un mot de passe (connexion, paiement) ne sont
        jamais gardées. Demande par exemple dans le panneau IA : « retrouve l'article sur les SSD que j'ai lu cette semaine ».
      </p>
      <div className="ligne-reglage">
        <span className="discret">
          {nombre} page{nombre > 1 ? 's' : ''} en mémoire
        </span>
        <button
          className="bouton-verre"
          disabled={nombre === 0}
          onClick={async () => {
            if (confirm('Effacer toute la mémoire de navigation ? L’historique et les favoris ne sont pas touchés.')) setNombre(await window.se7en.navigation.effacer())
          }}
        >
          Effacer
        </button>
      </div>
    </section>
  )
}
