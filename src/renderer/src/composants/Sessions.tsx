/* Sessions d'onglets : des espaces (« 🎮 Jeux vidéo », « 💼 Recherche travail »…), chacun avec ses onglets.
 * Un clic change de session ; clic droit pour renommer ou supprimer ; on y glisse un onglet pour l'y ranger.
 * Les onglets des sessions sont gardés d'un lancement à l'autre (rouverts endormis). */
import { useState } from 'react'
import { SESSION_PRINCIPALE, type EtatOnglets, type SessionOnglets } from '../../../shared/onglets'
import type { Glisser } from '../useGlisser'
import { MenuVerre, type ElementMenu, type PositionMenu } from './MenuVerre'

const EMOJIS = ['🎮', '💼', '📚', '🎵', '🛒', '✈️', '💡', '🧪', '🏋️', '🎬', '💬', '📁']

/** Les onglets normaux de la session affichée (les prioritaires sont communs à toutes). */
export function ongletsDeSession(etat: EtatOnglets): EtatOnglets['onglets'] {
  return etat.onglets.filter((o) => !o.prioritaire && o.session === etat.sessionActive)
}

function FormulaireSession({ session, fermer }: { session?: SessionOnglets; fermer: () => void }): React.JSX.Element {
  const [nom, setNom] = useState(session?.nom ?? '')
  const [emoji, setEmoji] = useState(session?.emoji ?? '🎮')
  return (
    <form
      className="formulaire-session"
      onSubmit={(e) => {
        e.preventDefault()
        if (!nom.trim()) return
        if (session) window.se7en.onglets.renommerSession(session.id, nom.trim(), emoji)
        else window.se7en.onglets.creerSession(nom.trim(), emoji)
        fermer()
      }}
    >
      <div className="choix-emoji">
        {EMOJIS.map((x) => (
          <button type="button" key={x} className={x === emoji ? 'choisi' : ''} onClick={() => setEmoji(x)}>
            {x}
          </button>
        ))}
      </div>
      <input
        className="champ"
        autoFocus
        value={nom}
        maxLength={30}
        placeholder="Nom de la session (ex. Jeux vidéo)"
        onChange={(e) => setNom(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && fermer()}
      />
      <div className="actions-session">
        <button className="bouton-principal petit" disabled={!nom.trim()}>
          {session ? 'Enregistrer' : 'Créer'}
        </button>
        <button type="button" className="bouton-verre petit" onClick={fermer}>
          Annuler
        </button>
      </div>
    </form>
  )
}

/** Section « Sessions » de la barre latérale. */
export function ListeSessions({ etat, glisser }: { etat: EtatOnglets; glisser: Glisser }): React.JSX.Element {
  const [edition, setEdition] = useState<SessionOnglets | 'nouvelle' | null>(null)
  const [menu, setMenu] = useState<{ session: SessionOnglets; position: PositionMenu } | null>(null)
  const [survol, setSurvol] = useState<string | null>(null)
  const o = window.se7en.onglets
  const nombre = (id: string): number => etat.onglets.filter((x) => !x.prioritaire && x.session === id).length

  const elementsMenu = (s: SessionOnglets): ElementMenu[] => [
    { libelle: 'Renommer…', action: () => setEdition(s) },
    {
      libelle: 'Supprimer la session et ses onglets',
      actif: s.id !== SESSION_PRINCIPALE,
      action: () => {
        if (confirm(`Supprimer la session « ${s.nom} » et fermer ses ${nombre(s.id)} onglet(s) ?`)) o.supprimerSession(s.id)
      }
    }
  ]

  return (
    <div className="sessions">
      <div className="titre-section">
        Sessions
        <button className="bouton-ajout-session" title="Nouvelle session" onClick={() => setEdition('nouvelle')}>
          +
        </button>
      </div>
      <div className="liste-sessions">
        {etat.sessions.map((s) => (
          <button
            key={s.id}
            className={`session${s.id === etat.sessionActive ? ' active' : ''}${survol === s.id ? ' depot' : ''}`}
            title={`${s.nom} · ${nombre(s.id)} onglet(s)`}
            onClick={() => o.changerSession(s.id)}
            onContextMenu={(e) => {
              e.preventDefault()
              setMenu({ session: s, position: { type: 'point', x: e.clientX, y: e.clientY } })
            }}
            // glisser un onglet sur une session l'y range
            onDragOver={(e) => {
              if (glisser.id === null) return
              e.preventDefault()
              setSurvol(s.id)
            }}
            onDragLeave={() => setSurvol((x) => (x === s.id ? null : x))}
            onDrop={(e) => {
              e.preventDefault()
              if (glisser.id !== null) o.deplacerVersSession(glisser.id, s.id)
              glisser.lacher()
              setSurvol(null)
            }}
          >
            <span className="emoji-session">{s.emoji}</span>
            <span className="nom-session">{s.nom}</span>
            <span className="nombre-session">{nombre(s.id)}</span>
          </button>
        ))}
      </div>
      {edition && <FormulaireSession session={edition === 'nouvelle' ? undefined : edition} fermer={() => setEdition(null)} />}
      {menu && (
        <MenuVerre
          elements={elementsMenu(menu.session)}
          position={menu.position}
          fermer={(choix) => {
            setMenu(null)
            choix?.action?.()
          }}
        />
      )}
    </div>
  )
}

/** Barre latérale cachée : la session actuelle en petite pastille devant les onglets du haut, qui ouvre la liste. */
export function PastilleSession({ etat }: { etat: EtatOnglets }): React.JSX.Element | null {
  const [ouvert, setOuvert] = useState<PositionMenu | null>(null)
  if (etat.sessions.length < 2) return null
  const active = etat.sessions.find((s) => s.id === etat.sessionActive)
  return (
    <>
      <button
        className="pastille-session"
        title="Changer de session"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setOuvert({ type: 'point', x: r.left, y: r.bottom + 6 })
        }}
      >
        {active?.emoji} {active?.nom}
      </button>
      {ouvert && (
        <MenuVerre
          elements={etat.sessions.map((s) => ({ libelle: `${s.emoji} ${s.nom}`, coche: s.id === etat.sessionActive, action: () => window.se7en.onglets.changerSession(s.id) }))}
          position={ouvert}
          fermer={(choix) => {
            setOuvert(null)
            choix?.action?.()
          }}
        />
      )}
    </>
  )
}
