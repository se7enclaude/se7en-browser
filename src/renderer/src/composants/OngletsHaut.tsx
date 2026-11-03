/* Onglets classiques, dans la barre de titre. Les prioritaires y apparaissent en icônes quand la barre latérale est cachée.
 * Les onglets rangés par l'IA sont précédés de l'étiquette de leur groupe (clic : replier / déplier). */
import { useRef, useState } from 'react'
import { useFlip } from '../useFlip'
import type { EtatOnglet, EtatOnglets, GroupeOnglets } from '../../../shared/onglets'
import type { Glisser } from '../useGlisser'
import { IconePlus, IconeRanger } from './Icones'
import { OngletItem } from './OngletItem'
import { ongletsDeSession, PastilleSession } from './Sessions'

interface Props {
  etat: EtatOnglets
  glisser: Glisser
  avecNormaux: boolean
  avecPrioritaires: boolean
}

/** Étiquette d'un groupe d'onglets (couleur + nom). */
export function EtiquetteGroupe({ groupe, nombre }: { groupe: GroupeOnglets; nombre: number }): React.JSX.Element {
  return (
    <button
      className={`etiquette-groupe couleur-${groupe.couleur}${groupe.replie ? ' replie' : ''}`}
      title={groupe.replie ? `Déplier « ${groupe.nom} » (${nombre} onglets)` : `Replier « ${groupe.nom} »`}
      onClick={() => window.se7en.groupes.basculer(groupe.id)}
      onContextMenu={(e) => {
        e.preventDefault()
        window.se7en.groupes.menu(groupe.id)
      }}
    >
      <span className="point-groupe" />
      {groupe.nom}
      {groupe.replie && <span className="nombre-groupe">{nombre}</span>}
    </button>
  )
}

/** Suite d'onglets avec, devant chaque groupe, son étiquette ; les onglets d'un groupe replié sont cachés. */
export function rendreAvecGroupes(
  onglets: EtatOnglet[],
  groupes: GroupeOnglets[],
  rendre: (o: EtatOnglet) => React.ReactNode
): React.ReactNode[] {
  const res: React.ReactNode[] = []
  let courant: string | null = null
  for (const o of onglets) {
    const g = o.groupe ? groupes.find((x) => x.id === o.groupe) : undefined
    if (g && g.id !== courant)
      res.push(
        <span key={`g-${g.id}`} data-flip={`g-${g.id}`} className="flip-groupe">
          <EtiquetteGroupe groupe={g} nombre={onglets.filter((x) => x.groupe === g.id).length} />
        </span>
      )
    courant = g?.id ?? null
    if (g?.replie) continue
    res.push(<span key={o.id} className={`dans-groupe${g ? ` couleur-${g.couleur}` : ''}`}>{rendre(o)}</span>)
  }
  return res
}

export function BoutonRanger({ etat }: { etat: EtatOnglets }): React.JSX.Element | null {
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const aRanger = etat.onglets.filter((o) => !o.prioritaire && o.url && !o.url.startsWith('se7en://')).length
  if (aRanger < 3) return null
  return (
    <button
      className={`bouton-icone bouton-ranger${occupe ? ' occupe' : ''}`}
      title={message ?? 'Ranger les onglets par sujet avec l’IA'}
      disabled={occupe}
      onClick={async () => {
        setOccupe(true)
        setMessage(null)
        const r = await window.se7en.groupes.ranger()
        setOccupe(false)
        if ('erreur' in r) {
          setMessage(r.erreur)
          alert(r.erreur)
        }
      }}
    >
      <IconeRanger />
    </button>
  )
}

export function OngletsHaut({ etat, glisser, avecNormaux, avecPrioritaires }: Props): React.JSX.Element {
  const prioritaires = etat.onglets.filter((o) => o.prioritaire)
  const normaux = ongletsDeSession(etat)
  const liste = useRef<HTMLDivElement>(null)
  useFlip(liste)
  return (
    <div ref={liste} className="onglets-haut" role="tablist" {...glisser.zone((id) => window.se7en.onglets.prioritaire(id, false))}>
      {avecPrioritaires &&
        prioritaires.map((o) => <OngletItem key={o.id} onglet={o} actif={o.id === etat.actifId} forme="icone" glisser={glisser} />)}
      {avecPrioritaires && prioritaires.length > 0 && avecNormaux && <span className="separateur-vertical" />}
      {avecNormaux && (
        <>
          {avecPrioritaires && <PastilleSession etat={etat} />}
          {rendreAvecGroupes(normaux, etat.groupes, (o) => (
            <OngletItem onglet={o} actif={o.id === etat.actifId} forme="haut" glisser={glisser} />
          ))}
          <button className="bouton-icone nouvel-onglet" title="Nouvel onglet (Ctrl+T)" onClick={() => window.se7en.onglets.nouveau()}>
            <IconePlus />
          </button>
          <BoutonRanger etat={etat} />
        </>
      )}
    </div>
  )
}
