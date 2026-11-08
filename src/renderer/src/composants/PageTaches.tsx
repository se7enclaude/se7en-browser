/* Page interne se7en://taches : les pages que le navigateur surveille pour toi (prix, changement, résumé du jour). */
import { useEffect, useState } from 'react'
import type { EtatOnglets } from '../../../shared/onglets'
import { formatPrix, INTERVALLES_MIN, libelleIntervalle, lireNombre, type DemandeTache, type Tache, type TypeTache } from '../../../shared/taches'

function useTaches(): Tache[] {
  const [l, setL] = useState<Tache[]>([])
  useEffect(() => {
    void window.se7en.taches.lister().then(setL)
    return window.se7en.taches.surChangement(setL)
  }, [])
  return l
}

const date = (t: number): string =>
  new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Petite courbe des prix relevés, dernier point mis en avant. */
function Courbe({ valeurs }: { valeurs: number[] }): React.JSX.Element | null {
  if (valeurs.length < 2) return null
  const min = Math.min(...valeurs)
  const max = Math.max(...valeurs)
  const L = 160
  const H = 36
  const pts = valeurs.map((v, i) => [(i / (valeurs.length - 1)) * L, max === min ? H / 2 : H - 4 - ((v - min) / (max - min)) * (H - 8)])
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [xf, yf] = pts.at(-1)!
  return (
    <svg className="courbe-prix" viewBox={`0 0 ${L} ${H}`} width={L} height={H} aria-hidden="true">
      <path d={`${d} L${L},${H} L0,${H} Z`} className="aire" />
      <path d={d} className="trait" />
      <circle cx={xf} cy={yf} r="3" className="point" />
    </svg>
  )
}

function Resume({ t }: { t: Tache }): React.JSX.Element {
  const releves = t.historique.filter((p) => !p.erreur)
  const dernier = t.historique.at(-1)
  if (t.type === 'prix') {
    const valeurs = releves.map((p) => p.valeur!).filter((v) => typeof v === 'number')
    const actuel = valeurs.at(-1)
    return (
      <div className="etat-tache">
        <span className="valeur-tache">{actuel !== undefined ? formatPrix(actuel, t.devise) : '—'}</span>
        <span className="discret petit">
          {t.seuil !== null ? `Alerte sous ${formatPrix(t.seuil, t.devise)}` : 'Alerte à chaque baisse'}
          {valeurs.length > 1 && ` · plus bas ${formatPrix(Math.min(...valeurs), t.devise)}`}
        </span>
        <Courbe valeurs={valeurs.slice(-30)} />
      </div>
    )
  }
  if (t.type === 'changement') {
    return (
      <div className="etat-tache">
        <span className="valeur-tache petite">
          {t.texteGuette ? (dernier?.present ? `« ${t.texteGuette} » est sur la page` : `« ${t.texteGuette} » pas encore là`) : `${releves.length} relevé${releves.length > 1 ? 's' : ''}`}
        </span>
        <span className="discret petit">{t.texteGuette ? 'Alerte quand le texte apparaît' : 'Alerte quand la page change'}</span>
      </div>
    )
  }
  const resume = [...releves].reverse().find((p) => p.resume)?.resume
  return (
    <div className="etat-tache">
      <span className="discret petit">Chaque jour à {t.heure.replace(':', 'h')}</span>
      {resume ? <p className="resume-tache">{resume}</p> : <span className="discret petit">Premier résumé à la prochaine échéance (IA locale activée).</span>}
    </div>
  )
}

function CarteTache({ t }: { t: Tache }): React.JSX.Element {
  const api = window.se7en.taches
  const dernier = t.historique.at(-1)
  return (
    <article className={`carte-tache bloc verre-fort${t.active ? '' : ' en-pause'}`}>
      <div className="tete-tache">
        <span className={`type-tache ${t.type}`}>{t.type === 'prix' ? 'Prix' : t.type === 'changement' ? 'Changement' : 'Résumé du jour'}</span>
        <button className="titre-tache" title={t.url} onClick={() => window.se7en.social.ouvrirLien(t.url)}>
          {t.titre}
        </button>
        <span className="discret petit hote-tache">{new URL(t.url).hostname}</span>
      </div>
      <Resume t={t} />
      {t.alerte && (
        <p className="alerte-tache">
          <strong>{date(t.alerte.date)}</strong> · {t.alerte.texte.split('\n')[0]}
        </p>
      )}
      {dernier?.erreur && <p className="message-erreur petit">{dernier.erreur}</p>}
      <div className="pied-tache">
        <span className="discret petit">
          {t.active ? (t.type === 'resume' ? `Prochain : ${date(t.prochaine)}` : libelleIntervalle(t.intervalleMin)) : 'En pause'}
          {t.derniere && ` · vérifiée ${date(t.derniere)}`}
        </span>
        <span className="espace" />
        {t.type !== 'resume' && (
          <select className="champ petit" value={t.intervalleMin} onChange={(e) => api.modifier(t.id, { intervalleMin: Number(e.target.value) })} aria-label="Fréquence">
            {INTERVALLES_MIN.map((m) => (
              <option key={m} value={m}>
                {libelleIntervalle(m)}
              </option>
            ))}
          </select>
        )}
        <button className="bouton-verre petit" onClick={() => api.verifier(t.id)}>
          Vérifier maintenant
        </button>
        <button className="bouton-verre petit" onClick={() => api.modifier(t.id, { active: !t.active })}>
          {t.active ? 'Pause' : 'Reprendre'}
        </button>
        <button className="bouton-verre petit" onClick={() => api.supprimer(t.id)}>
          Supprimer
        </button>
      </div>
    </article>
  )
}

/** Formulaire : surveiller un onglet ouvert. */
function NouvelleTache({ onglets }: { onglets: EtatOnglets }): React.JSX.Element {
  const pages = onglets.onglets.filter((o) => /^https?:/.test(o.url) && !o.prive)
  const [id, setId] = useState<number | null>(null)
  const [type, setType] = useState<TypeTache>('prix')
  const [seuil, setSeuil] = useState('')
  const [texte, setTexte] = useState('')
  const [heure, setHeure] = useState('08:00')
  const [intervalle, setIntervalle] = useState(60)
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)
  const choisie = pages.find((p) => p.id === id) ?? pages[0]
  const creer = async (): Promise<void> => {
    if (!choisie) return
    const d: DemandeTache = { type, seuil: type === 'prix' && seuil.trim() ? lireNombre(seuil) : null, texteGuette: type === 'changement' ? texte.trim() : '', heure, intervalleMin: intervalle }
    const r = await window.se7en.taches.creer(choisie.url, choisie.titre, d)
    setMessage('erreur' in r ? { ok: false, texte: r.erreur } : { ok: true, texte: `« ${r.titre} » est surveillée.` })
  }
  return (
    <section className="bloc verre-fort nouvelle-tache">
      <h2>Surveiller une page</h2>
      {pages.length === 0 ? (
        <p className="discret">Ouvre d'abord la page à surveiller dans un onglet (une fiche produit, une billetterie, un blog…).</p>
      ) : (
        <>
          <div className="ligne-reglage">
            <span>Page</span>
            <select className="champ" value={choisie?.id} onChange={(e) => setId(Number(e.target.value))}>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.titre || p.url}
                </option>
              ))}
            </select>
          </div>
          <div className="liste-chips">
            {(['prix', 'changement', 'resume'] as const).map((k) => (
              <button key={k} className={`chip${type === k ? ' actif' : ''}`} onClick={() => setType(k)}>
                {k === 'prix' ? 'Le prix baisse' : k === 'changement' ? 'La page change' : 'Résumé chaque jour'}
              </button>
            ))}
          </div>
          {type === 'prix' && (
            <div className="ligne-reglage">
              <span>Prévenir sous (facultatif)</span>
              <input className="champ" inputMode="decimal" placeholder="ex. 300" value={seuil} onChange={(e) => setSeuil(e.target.value)} />
            </div>
          )}
          {type === 'changement' && (
            <div className="ligne-reglage">
              <span>Texte à guetter (facultatif)</span>
              <input className="champ" placeholder="ex. en stock" value={texte} onChange={(e) => setTexte(e.target.value)} />
            </div>
          )}
          {type === 'resume' ? (
            <div className="ligne-reglage">
              <span>Heure</span>
              <input className="champ" type="time" value={heure} onChange={(e) => setHeure(e.target.value)} />
            </div>
          ) : (
            <div className="ligne-reglage">
              <span>Vérifier</span>
              <select className="champ" value={intervalle} onChange={(e) => setIntervalle(Number(e.target.value))}>
                {INTERVALLES_MIN.map((m) => (
                  <option key={m} value={m}>
                    {libelleIntervalle(m)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="ligne-reglage">
            {message && <span className={message.ok ? 'message-ok' : 'message-erreur'}>{message.texte}</span>}
            <span className="espace" />
            <button className="bouton-principal" disabled={type === 'prix' && !!seuil.trim() && lireNombre(seuil) === null} onClick={() => void creer()}>
              Surveiller
            </button>
          </div>
        </>
      )}
    </section>
  )
}

export function PageTaches({ onglets }: { onglets: EtatOnglets }): React.JSX.Element {
  const taches = useTaches()
  return (
    <div className="page-interne">
      <div className="entete-page">
        <h1>Tâches</h1>
      </div>
      <p className="discret">
        Le navigateur surveille ces pages pour toi et te prévient par une notification Windows. Elles sont lues sur ton PC, dans une session à part (sans tes cookies ni
        tes connexions), tant que le navigateur est ouvert. Astuce : dans le panneau IA, écris « préviens-moi quand ce prix baisse sous 300 € ».
      </p>
      <NouvelleTache onglets={onglets} />
      {taches.length === 0 ? (
        <p className="discret vide-taches">Aucune tâche pour l'instant.</p>
      ) : (
        <div className="liste-taches">
          {taches.map((t) => (
            <CarteTache key={t.id} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}
