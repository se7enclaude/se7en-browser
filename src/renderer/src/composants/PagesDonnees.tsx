/* Pages internes : se7en://historique, se7en://favoris, se7en://telechargements. */
import { useEffect, useState } from 'react'
import { adresseLisible } from '../../../shared/adresse'
import type { EntreeHistorique, Favori, Telechargement } from '../../../shared/donnees'
import { initiale, taille, useFavoris, useTelechargements } from '../useDonnees'
import { IconeCorbeille, IconeCroix, IconeDossier, IconeLecture, IconePause, IconeRecherche } from './Icones'

/** Ouvre l'adresse dans l'onglet de la page interne (comme un lien), ou dans un nouvel onglet avec Ctrl / clic molette. */
function ouvrir(url: string, idOnglet: number, nouvelOnglet: boolean): void {
  if (nouvelOnglet) window.se7en.onglets.nouveau(url)
  else window.se7en.onglets.naviguer(idOnglet, url)
}

function Pastille({ url, favicon }: { url: string; favicon?: string | null }): React.JSX.Element {
  return favicon ? <img className="favicon" src={favicon} alt="" /> : <span className="pastille-lettre">{initiale(url)}</span>
}

function Recherche({ valeur, changer, texte }: { valeur: string; changer: (v: string) => void; texte: string }): React.JSX.Element {
  return (
    <label className="recherche-page">
      <IconeRecherche />
      <input value={valeur} onChange={(e) => changer(e.target.value)} placeholder={texte} spellCheck={false} />
    </label>
  )
}

// ---------- Historique ----------

function jour(date: number): string {
  const d = new Date(date)
  const auj = new Date()
  const hier = new Date(auj.getFullYear(), auj.getMonth(), auj.getDate() - 1)
  if (d.toDateString() === auj.toDateString()) return "Aujourd'hui"
  if (d.toDateString() === hier.toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: d.getFullYear() === auj.getFullYear() ? undefined : 'numeric' })
}

export function PageHistorique({ idOnglet }: { idOnglet: number }): React.JSX.Element {
  const [texte, setTexte] = useState('')
  const [entrees, setEntrees] = useState<EntreeHistorique[]>([])
  const favoris = useFavoris()
  const icones = new Map(favoris.map((f) => [f.url, f.favicon]))

  const charger = (): void => void window.se7en.historique.chercher(texte).then(setEntrees)
  useEffect(charger, [texte])

  const groupes: [string, EntreeHistorique[]][] = []
  for (const e of entrees) {
    const j = jour(e.date)
    const g = groupes.at(-1)
    if (g && g[0] === j) g[1].push(e)
    else groupes.push([j, [e]])
  }

  return (
    <div className="page-interne">
      <div className="entete-page">
        <h1>Historique</h1>
        <button
          className="bouton-verre"
          disabled={entrees.length === 0}
          onClick={async () => {
            if (!confirm("Effacer tout l'historique de navigation ? Les favoris et les onglets ne sont pas touchés.")) return
            await window.se7en.historique.effacer()
            charger()
          }}
        >
          Effacer l'historique
        </button>
      </div>
      <Recherche valeur={texte} changer={setTexte} texte="Rechercher dans l'historique" />
      {groupes.length === 0 && <p className="vide">{texte ? 'Rien trouvé.' : "L'historique est vide."}</p>}
      {groupes.map(([j, liste]) => (
        <section key={j} className="bloc verre-fort">
          <h2 className="titre-jour">{j}</h2>
          {liste.map((e) => (
            <div key={e.id} className="ligne-liste">
              <span className="heure">{new Date(e.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
              <Pastille url={e.url} favicon={icones.get(e.url)} />
              <a
                className="lien-liste"
                href={e.url}
                onClick={(ev) => {
                  ev.preventDefault()
                  ouvrir(e.url, idOnglet, ev.ctrlKey)
                }}
                onAuxClick={(ev) => ev.button === 1 && ouvrir(e.url, idOnglet, true)}
              >
                <span className="titre-liste">{e.titre}</span>
                <span className="adresse-liste">{adresseLisible(e.url)}</span>
              </a>
              <button
                className="bouton-icone discret-survol"
                title="Retirer de l'historique"
                onClick={() => window.se7en.historique.supprimer([e.id]).then(charger)}
              >
                <IconeCroix />
              </button>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

// ---------- Favoris ----------

export function PageFavoris({ idOnglet }: { idOnglet: number }): React.JSX.Element {
  const [texte, setTexte] = useState('')
  const favoris = useFavoris()
  const mots = texte.toLowerCase().split(/\s+/).filter(Boolean)
  const liste = favoris.filter((f: Favori) => mots.every((m) => `${f.titre} ${f.url}`.toLowerCase().includes(m)))

  return (
    <div className="page-interne">
      <div className="entete-page">
        <h1>Favoris</h1>
      </div>
      <Recherche valeur={texte} changer={setTexte} texte="Rechercher dans les favoris" />
      {favoris.length === 0 ? (
        <p className="vide">Pas encore de favori. Clique sur l'étoile de la barre d'adresse, ou Ctrl+D.</p>
      ) : (
        <section className="bloc verre-fort">
          {liste.length === 0 && <p className="vide">Rien trouvé.</p>}
          {liste.map((f) => (
            <div key={f.id} className="ligne-liste">
              <Pastille url={f.url} favicon={f.favicon} />
              <a
                className="lien-liste"
                href={f.url}
                onClick={(ev) => {
                  ev.preventDefault()
                  ouvrir(f.url, idOnglet, ev.ctrlKey)
                }}
                onAuxClick={(ev) => ev.button === 1 && ouvrir(f.url, idOnglet, true)}
              >
                <span className="titre-liste">{f.titre}</span>
                <span className="adresse-liste">{adresseLisible(f.url)}</span>
              </a>
              <button className="bouton-icone discret-survol" title="Retirer des favoris" onClick={() => window.se7en.favoris.supprimer(f.id)}>
                <IconeCorbeille />
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

// ---------- Téléchargements ----------

function LigneTelechargement({ t }: { t: Telechargement }): React.JSX.Element {
  const a = (action: Parameters<typeof window.se7en.telechargements.action>[1]) => () => window.se7en.telechargements.action(t.id, action)
  const enCours = t.etat === 'en-cours' || t.etat === 'en-pause'
  const pourcent = t.total > 0 ? Math.min(100, (t.recus / t.total) * 100) : 0
  const statut =
    t.etat === 'termine'
      ? taille(t.recus)
      : t.etat === 'annule'
        ? 'Annulé'
        : t.etat === 'interrompu'
          ? 'Interrompu'
          : `${taille(t.recus)}${t.total ? ` sur ${taille(t.total)}` : ''}${t.etat === 'en-pause' ? ' · en pause' : ''}`

  return (
    <div className={`ligne-telechargement etat-${t.etat}`}>
      <div className="infos-telechargement">
        {t.etat === 'termine' ? (
          <button className="nom-fichier lien" title="Ouvrir le fichier" onClick={a('ouvrir')}>
            {t.nom}
          </button>
        ) : (
          <span className="nom-fichier">{t.nom}</span>
        )}
        <span className="adresse-liste">
          {statut} · {adresseLisible(t.url)}
        </span>
        {enCours && (
          <div className="barre-progres">
            <div style={{ width: `${pourcent}%` }} className={t.total ? '' : 'indetermine'} />
          </div>
        )}
      </div>
      <div className="actions-telechargement">
        {t.etat === 'en-cours' && (
          <button className="bouton-icone" title="Pause" onClick={a('pause')}>
            <IconePause />
          </button>
        )}
        {t.etat === 'en-pause' && (
          <button className="bouton-icone" title="Reprendre" onClick={a('reprendre')}>
            <IconeLecture />
          </button>
        )}
        {enCours && (
          <button className="bouton-icone" title="Annuler" onClick={a('annuler')}>
            <IconeCroix />
          </button>
        )}
        {t.etat === 'termine' && (
          <button className="bouton-icone" title="Afficher dans le dossier" onClick={a('montrer')}>
            <IconeDossier />
          </button>
        )}
        {!enCours && (
          <button className="bouton-icone discret-survol" title="Retirer de la liste" onClick={a('retirer')}>
            <IconeCorbeille />
          </button>
        )}
      </div>
    </div>
  )
}

export function PageTelechargements(): React.JSX.Element {
  const liste = useTelechargements()
  return (
    <div className="page-interne">
      <div className="entete-page">
        <h1>Téléchargements</h1>
        <button className="bouton-verre" disabled={!liste.some((t) => t.etat !== 'en-cours' && t.etat !== 'en-pause')} onClick={() => window.se7en.telechargements.effacer()}>
          Vider la liste
        </button>
      </div>
      <p className="discret">Les fichiers vont dans ton dossier Téléchargements. Vider la liste ne supprime pas les fichiers.</p>
      {liste.length === 0 ? (
        <p className="vide">Aucun téléchargement.</p>
      ) : (
        <section className="bloc verre-fort">
          {liste.map((t) => (
            <LigneTelechargement key={t.id} t={t} />
          ))}
        </section>
      )}
    </div>
  )
}
