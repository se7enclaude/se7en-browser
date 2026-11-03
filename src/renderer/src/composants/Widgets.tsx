/* Widgets du Nouvel onglet : on les ajoute soi-même (bouton « Widgets »), on les pose où on veut et on les
 * redimensionne en tirant leur coin. La disposition est gardée dans les réglages. */
import { useEffect, useRef, useState } from 'react'
import type { EtatOnglet } from '../../../shared/onglets'
import {
  CATALOGUE_WIDGETS,
  descriptionMeteo,
  devinerTransporteur,
  LANGUES,
  lienSuivi,
  MAX_WIDGETS,
  nouveauWidget,
  numeroColis,
  placement,
  echelle,
  RE_NUMERO_COLIS,
  SOURCES_ACTUALITES,
  TAILLE_MIN,
  TRANSPORTEURS,
  type Colis,
  type Equipe,
  type Match,
  type TypeWidget,
  type Ville,
  type WidgetPlace
} from '../../../shared/widgets'
import { IconeCroix } from './Icones'
import { WidgetAmis } from './WidgetAmis'

/** Pas de la grille sur laquelle les widgets s'aimantent. */
const GRILLE = 8
/** En dessous, la page est trop étroite (vue partagée…) : les widgets se cachent. */
const LARGEUR_MIN = 640

const aimanter = (v: number): number => Math.round(v / GRILLE) * GRILLE
const borne = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v))

interface Geste {
  id: string
  mode: 'deplacer' | 'taille'
  x0: number
  y0: number
  depart: { left: number; top: number; width: number; height: number }
}

export function ZoneWidgets({ onglet }: { onglet: EtatOnglet }): React.JSX.Element | null {
  const [widgets, setWidgets] = useState<WidgetPlace[] | null>(null)
  const [edition, setEdition] = useState(false)
  const [taille, setTaille] = useState({ l: 0, h: 0 })
  const zone = useRef<HTMLDivElement>(null)
  const geste = useRef<Geste | null>(null)
  const courants = useRef<WidgetPlace[]>([])
  courants.current = widgets ?? []

  useEffect(() => {
    void window.se7en.reglages.lire().then((r) => setWidgets(r.widgets))
    // un autre Nouvel onglet a changé la disposition (on ne l'écrase pas pendant un geste)
    return window.se7en.reglages.surChangement((r) => !geste.current && setWidgets(r.widgets))
  }, [])

  useEffect(() => {
    const el = zone.current
    if (!el) return
    const obs = new ResizeObserver(() => setTaille({ l: el.clientWidth, h: el.clientHeight }))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!edition) return
    const touche = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setEdition(false)
    }
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
  }, [edition])

  const enregistrer = (liste: WidgetPlace[]): void => {
    setWidgets(liste)
    void window.se7en.reglages.modifier({ widgets: liste })
  }
  const changer = (id: string, partiel: Partial<WidgetPlace>): void => enregistrer(courants.current.map((w) => (w.id === id ? { ...w, ...partiel } : w)))
  const ajouter = (type: TypeWidget): void => {
    const liste = courants.current
    enregistrer([...liste, nouveauWidget(type, liste, `${type}-${Date.now().toString(36)}`)])
  }
  const retirer = (id: string): void => enregistrer(courants.current.filter((w) => w.id !== id))

  const commencer = (e: React.PointerEvent<HTMLElement>, w: WidgetPlace, mode: Geste['mode']): void => {
    if (!edition || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    geste.current = {
      id: w.id,
      mode,
      x0: e.clientX,
      y0: e.clientY,
      depart: placement(w, taille.l, taille.h)
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    // le widget saisi passe devant les autres
    setWidgets((l) => l && [...l.filter((x) => x.id !== w.id), w])
  }
  const bouger = (e: React.PointerEvent): void => {
    const g = geste.current
    if (!g) return
    const dx = e.clientX - g.x0
    const dy = e.clientY - g.y0
    const { l: L, h: H } = taille
    setWidgets((liste) =>
      liste
        ? liste.map((w) => {
            if (w.id !== g.id) return w
            const d = g.depart
            if (g.mode === 'deplacer') {
              const left = borne(aimanter(d.left + dx), 0, L - d.width)
              const top = borne(aimanter(d.top + dy), 0, H - d.height)
              return { ...w, x: L ? left / L : 0, y: H ? top / H : 0 }
            }
            return {
              ...w,
              l: borne(aimanter(d.width + dx), TAILLE_MIN.l, L - d.left),
              h: borne(aimanter(d.height + dy), TAILLE_MIN.h, H - d.top)
            }
          })
        : liste
    )
  }
  const finir = (): void => {
    if (!geste.current) return
    geste.current = null
    enregistrer(courants.current)
  }

  const aller = (url: string): void => {
    window.se7en.onglets.naviguer(onglet.id, url)
    window.se7en.onglets.focusPage()
  }
  const visible = taille.l >= LARGEUR_MIN
  const presents = new Set((widgets ?? []).map((w) => w.type))

  return (
    <div ref={zone} className={`zone-widgets${edition ? ' edition' : ''}`} onPointerMove={bouger} onPointerUp={finir} onPointerCancel={finir}>
      {visible &&
        widgets?.map((w) => {
          const p = placement(w, taille.l, taille.h)
          return (
            <section
              key={w.id}
              className={`widget widget-${w.type}${geste.current?.id === w.id ? ' saisi' : ''}`}
              style={{
                left: p.left,
                top: p.top,
                width: p.width,
                height: p.height,
                // agrandir un widget grossit aussi son contenu (texte, icônes, images)
                ['--echelle' as string]: echelle(w.type, p.width)
              }}
              onPointerDown={(e) => commencer(e, w, 'deplacer')}
            >
              <ContenuWidget w={w} changer={(partiel) => changer(w.id, partiel)} aller={aller} />
              {edition && (
                <>
                  <button className="retirer-widget" title="Retirer ce widget" onPointerDown={(e) => e.stopPropagation()} onClick={() => retirer(w.id)}>
                    <IconeCroix />
                  </button>
                  <span className="poignee-widget" title="Tirer pour redimensionner" onPointerDown={(e) => commencer(e, w, 'taille')} />
                </>
              )}
            </section>
          )
        })}

      {visible && !edition && (
        <button className="bouton-widgets verre-fort" title="Ajouter, déplacer ou redimensionner les widgets" onClick={() => setEdition(true)}>
          <IconeWidgets />
          Widgets
        </button>
      )}
      {visible && edition && (
        <div className="catalogue-widgets verre-fort">
          <span className="titre-widget">Glisse les widgets pour les placer, tire leur coin pour changer leur taille</span>
          <div className="liste-catalogue">
            {CATALOGUE_WIDGETS.map((c) => (
              <button
                key={c.type}
                className="ajout-widget"
                title={c.description}
                disabled={(!c.plusieurs && presents.has(c.type)) || (widgets?.length ?? 0) >= MAX_WIDGETS}
                onClick={() => ajouter(c.type)}
              >
                + {c.nom}
              </button>
            ))}
          </div>
          <button className="bouton-principal petit" onClick={() => setEdition(false)}>
            Terminé
          </button>
        </div>
      )}
    </div>
  )
}

const IconeWidgets = (): React.JSX.Element => (
  <svg viewBox="0 0 16 16" aria-hidden className="icone">
    <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1.2" />
    <rect x="9" y="2.5" width="4.5" height="4.5" rx="1.2" />
    <rect x="2.5" y="9" width="4.5" height="4.5" rx="1.2" />
    <path d="M11.25 9v4.5M9 11.25h4.5" />
  </svg>
)

function ContenuWidget({ w, changer, aller }: { w: WidgetPlace; changer: (p: Partial<WidgetPlace>) => void; aller: (url: string) => void }): React.JSX.Element | null {
  switch (w.type) {
    case 'amis':
      return <WidgetAmis />
    case 'meteo':
      return <WidgetMeteo ville={w.ville} changer={(ville) => changer({ ville })} />
    case 'actualites':
      return <WidgetActualites source={w.source ?? SOURCES_ACTUALITES[0].id} changer={(source) => changer({ source })} aller={aller} />
    case 'jeux-gratuits':
      return <WidgetJeuxGratuits aller={aller} />
    case 'sorties':
      return <WidgetSorties aller={aller} />
    case 'sport':
      return <WidgetSport equipes={w.equipes ?? []} changer={(equipes) => changer({ equipes })} />
    case 'colis':
      return <WidgetColis colis={w.colis ?? []} changer={(colis) => changer({ colis })} aller={aller} />
    case 'traducteur':
      return <WidgetTraducteur langue={w.langue ?? 'fr'} changer={(langue) => changer({ langue })} />
  }
}

function Entete({ titre, children }: { titre: React.ReactNode; children?: React.ReactNode }): React.JSX.Element {
  return (
    <div className="entete-widget">
      <strong>{titre}</strong>
      <span className="espace" />
      {children}
    </div>
  )
}

/** Charge une donnée de widget, et la recharge toutes les `intervalle` ms (null : service indisponible). */
function useDonnee<T>(charger: (() => Promise<T | null>) | null, cles: unknown[], intervalle: number): { donnee: T | null; etat: 'chargement' | 'ok' | 'erreur' } {
  const [res, setRes] = useState<{
    donnee: T | null
    etat: 'chargement' | 'ok' | 'erreur'
  }>({ donnee: null, etat: 'chargement' })
  useEffect(() => {
    if (!charger) return
    let fini = false
    const lancer = (): void => void charger().then((d) => !fini && setRes((r) => (d === null ? { donnee: r.donnee, etat: r.donnee ? 'ok' : 'erreur' } : { donnee: d, etat: 'ok' })))
    setRes({ donnee: null, etat: 'chargement' })
    lancer()
    const i = setInterval(lancer, intervalle)
    return () => {
      fini = true
      clearInterval(i)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, cles)
  return res
}

function Etat({ etat, vide }: { etat: 'chargement' | 'ok' | 'erreur'; vide?: boolean }): React.JSX.Element | null {
  if (etat === 'chargement') return <p className="discret petit">Chargement…</p>
  if (etat === 'erreur') return <p className="discret petit">Service indisponible pour l’instant. Nouvel essai dans quelques minutes.</p>
  if (vide) return <p className="discret petit">Rien pour l’instant.</p>
  return null
}

// ---------- Météo ----------

function WidgetMeteo({ ville, changer }: { ville?: Ville; changer: (v: Ville) => void }): React.JSX.Element {
  const [choix, setChoix] = useState(!ville)
  const { donnee: m, etat } = useDonnee(ville && !choix ? () => window.se7en.widgets.meteo(ville) : null, [ville?.lat, ville?.lon, choix], 15 * 60_000)
  if (!ville || choix)
    return (
      <div className="corps-widget">
        <Entete titre="Météo">
          {ville && (
            <button className="lien-discret" onClick={() => setChoix(false)}>
              Annuler
            </button>
          )}
        </Entete>
        <ChoixVille
          choisir={(v) => {
            changer(v)
            setChoix(false)
          }}
        />
      </div>
    )
  const d = m && descriptionMeteo(m.code, m.jour)
  return (
    <div className="corps-widget meteo">
      <Entete titre={ville.nom}>
        <button className="lien-discret" title={ville.detail} onClick={() => setChoix(true)}>
          Changer
        </button>
      </Entete>
      {!m ? (
        <Etat etat={etat} />
      ) : (
        <>
          <div className="meteo-maintenant">
            <span className="meteo-emoji">{d!.emoji}</span>
            <span className="meteo-temperature">{Math.round(m.temperature)}°</span>
            <span className="meteo-detail">
              <strong>{d!.texte}</strong>
              <span className="discret">
                Ressenti {Math.round(m.ressentie)}° · vent {Math.round(m.vent)} km/h
              </span>
            </span>
          </div>
          <div className="meteo-heures">
            {m.heures.map((h) => (
              <span key={h.heure} className="meteo-heure">
                <span className="discret">{h.heure}</span>
                <span>{descriptionMeteo(h.code).emoji}</span>
                <strong>{Math.round(h.temperature)}°</strong>
                {h.pluie >= 30 && <span className="meteo-pluie">{h.pluie} %</span>}
              </span>
            ))}
          </div>
          <div className="meteo-jours">
            {m.jours.map((j, i) => (
              <span key={j.date} className="meteo-jour">
                <span className="meteo-nom-jour">
                  {i === 0
                    ? 'Aujourd’hui'
                    : new Date(`${j.date}T12:00`).toLocaleDateString('fr-FR', {
                        weekday: 'long'
                      })}
                </span>
                <span>{descriptionMeteo(j.code).emoji}</span>
                <span className="meteo-pluie">{j.pluie >= 30 ? `${j.pluie} %` : ''}</span>
                <span className="discret">{Math.round(j.min)}°</span>
                <strong>{Math.round(j.max)}°</strong>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ChoixVille({ choisir }: { choisir: (v: Ville) => void }): React.JSX.Element {
  const [saisie, setSaisie] = useState('')
  const [villes, setVilles] = useState<Ville[] | null>(null)
  const [cherche, setCherche] = useState(false)
  return (
    <>
      <form
        className="ajout-ami-widget"
        onSubmit={(e) => {
          e.preventDefault()
          if (saisie.trim().length < 2) return
          setCherche(true)
          void window.se7en.widgets.villes(saisie).then((v) => {
            setVilles(v ?? [])
            setCherche(false)
          })
        }}
      >
        <input className="champ" autoFocus value={saisie} maxLength={80} onChange={(e) => setSaisie(e.target.value)} placeholder="Ta ville (ex. Lyon)" />
        <button className="bouton-verre petit" disabled={saisie.trim().length < 2 || cherche}>
          Chercher
        </button>
      </form>
      {villes?.length === 0 && <p className="discret petit">Aucune ville trouvée.</p>}
      <div className="section-widget">
        {villes?.map((v) => (
          <button key={`${v.lat},${v.lon}`} className="ligne-widget" onClick={() => choisir(v)}>
            <span className="texte-ligne-widget">
              <strong>{v.nom}</strong>
              <span className="discret">{v.detail}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  )
}

// ---------- Actualités ----------

function WidgetActualites({ source, changer, aller }: { source: string; changer: (s: string) => void; aller: (url: string) => void }): React.JSX.Element {
  const { donnee, etat } = useDonnee(() => window.se7en.widgets.actualites(source), [source], 10 * 60_000)
  return (
    <div className="corps-widget">
      <Entete titre="Actualités">
        <select className="choix-widget" value={source} onChange={(e) => changer(e.target.value)}>
          {SOURCES_ACTUALITES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nom}
            </option>
          ))}
        </select>
      </Entete>
      {!donnee ? (
        <Etat etat={etat} />
      ) : (
        <div className="section-widget">
          {donnee.map((a) => (
            <button key={a.lien} className="ligne-widget actu" title={a.titre} onClick={() => aller(a.lien)}>
              <span className="texte-ligne-widget">
                <span className="titre-actu">{a.titre}</span>
                {a.date > 0 && <span className="discret">{depuis(a.date)}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Jeux ----------

function WidgetJeuxGratuits({ aller }: { aller: (url: string) => void }): React.JSX.Element {
  const { donnee, etat } = useDonnee(() => window.se7en.widgets.jeux(), [], 30 * 60_000)
  return (
    <div className="corps-widget">
      <Entete titre="Jeux gratuits" />
      {!donnee || donnee.length === 0 ? (
        <Etat etat={etat} vide />
      ) : (
        <div className="section-widget">
          {donnee.map((j) => (
            <button key={j.lien} className="ligne-widget jeu" title={j.titre} onClick={() => aller(j.lien)}>
              {j.image ? <img className="jaquette" src={j.image} alt="" /> : <span className="jaquette" />}
              <span className="texte-ligne-widget">
                <strong>{j.titre}</strong>
                <span className="discret">
                  <span className="plateforme">{j.plateforme}</span>{' '}
                  {j.bientot ? `Gratuit dès le ${jourCourt(j.debut)}` : j.fin ? `Gratuit jusqu’au ${jourCourt(j.fin)}` : 'Gratuit en ce moment'}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function WidgetSorties({ aller }: { aller: (url: string) => void }): React.JSX.Element {
  const { donnee, etat } = useDonnee(() => window.se7en.widgets.sorties(), [], 6 * 3_600_000)
  return (
    <div className="corps-widget">
      <Entete titre="Sorties jeux vidéo" />
      {!donnee || donnee.length === 0 ? (
        <Etat etat={etat} vide />
      ) : (
        <div className="section-widget">
          {donnee.map((j) => (
            <button key={j.lien} className="ligne-widget jeu" title={j.titre} onClick={() => aller(j.lien)}>
              {j.image ? <img className="jaquette" src={j.image} alt="" /> : <span className="jaquette" />}
              <span className="texte-ligne-widget">
                <strong>{j.titre}</strong>
                <span className="discret">{j.date}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Sport ----------

function WidgetSport({ equipes, changer }: { equipes: Equipe[]; changer: (e: Equipe[]) => void }): React.JSX.Element {
  const [ajout, setAjout] = useState(equipes.length === 0)
  return (
    <div className="corps-widget">
      <Entete titre="Résultats sportifs">
        {!ajout && equipes.length < 6 && (
          <button className="lien-discret" onClick={() => setAjout(true)}>
            + Équipe
          </button>
        )}
      </Entete>
      {equipes.map((e) => (
        <ResultatEquipe key={e.id} equipe={e} retirer={() => changer(equipes.filter((x) => x.id !== e.id))} />
      ))}
      {ajout && (
        <ChoixEquipe
          dejaSuivies={equipes.map((e) => e.id)}
          choisir={(e) => {
            changer([...equipes, e])
            setAjout(false)
          }}
          annuler={equipes.length ? () => setAjout(false) : undefined}
        />
      )}
    </div>
  )
}

function ResultatEquipe({ equipe, retirer }: { equipe: Equipe; retirer: () => void }): React.JSX.Element {
  const { donnee: r, etat } = useDonnee(() => window.se7en.widgets.resultats(equipe), [equipe.id], 10 * 60_000)
  const score = (m: Match): React.ReactNode => (
    <>
      <span className={m.domicile === equipe.nom ? 'equipe-suivie' : ''}>{m.domicile}</span>{' '}
      <strong className="score">
        {m.scoreDomicile} – {m.scoreExterieur}
      </strong>{' '}
      <span className={m.exterieur === equipe.nom ? 'equipe-suivie' : ''}>{m.exterieur}</span>
    </>
  )
  return (
    <div className="bloc-equipe">
      <div className="entete-equipe">
        {r?.ecusson ? <img className="ecusson" src={r.ecusson} alt="" /> : <span className="ecusson" />}
        <strong>{equipe.nom}</strong>
        <span className="espace" />
        <button className="retirer-tache" title="Ne plus suivre" onClick={retirer}>
          <IconeCroix />
        </button>
      </div>
      {!r ? (
        <Etat etat={etat} />
      ) : (
        <>
          {r.dernier && r.dernier.scoreDomicile !== null && (
            <div className="match">
              <span className="discret">Dernier · {jourCourt(r.dernier.date)}</span>
              <span>{score(r.dernier)}</span>
            </div>
          )}
          {r.prochain && r.prochain.scoreDomicile !== null && r.prochain.date <= Date.now() ? (
            // match commencé : le score du moment
            <div className="match">
              <span className="en-direct">● En direct{r.prochain.ligue ? ` · ${r.prochain.ligue}` : ''}</span>
              <span>{score(r.prochain)}</span>
            </div>
          ) : (
            r.prochain && (
              <div className="match">
                <span className="discret">
                  Prochain · {jourEtHeure(r.prochain.date)}
                  {r.prochain.ligue ? ` · ${r.prochain.ligue}` : ''}
                </span>
                <span>
                  {r.prochain.domicile} – {r.prochain.exterieur}
                </span>
              </div>
            )
          )}
          {!r.dernier && !r.prochain && <p className="discret petit">Aucun match trouvé.</p>}
        </>
      )}
    </div>
  )
}

function ChoixEquipe({ dejaSuivies, choisir, annuler }: { dejaSuivies: string[]; choisir: (e: Equipe) => void; annuler?: () => void }): React.JSX.Element {
  const [saisie, setSaisie] = useState('')
  const [res, setRes] = useState<(Equipe & { sport: string })[] | 'erreur' | null>(null)
  return (
    <>
      <form
        className="ajout-ami-widget"
        onSubmit={(e) => {
          e.preventDefault()
          if (saisie.trim().length >= 2) void window.se7en.widgets.equipes(saisie).then((r) => setRes(r ?? 'erreur'))
        }}
      >
        <input className="champ" autoFocus value={saisie} maxLength={60} onChange={(e) => setSaisie(e.target.value)} placeholder="Ton équipe (ex. Paris SG, Lakers)" />
        <button className="bouton-verre petit" disabled={saisie.trim().length < 2}>
          Chercher
        </button>
        {annuler && (
          <button type="button" className="bouton-verre petit" onClick={annuler}>
            Annuler
          </button>
        )}
      </form>
      {res === 'erreur' && <Etat etat="erreur" />}
      {Array.isArray(res) && res.length === 0 && <p className="discret petit">Aucune équipe trouvée. Essaie son nom complet (ex. « Los Angeles Lakers »).</p>}
      <div className="section-widget">
        {Array.isArray(res) &&
          res
            .filter((e) => !dejaSuivies.includes(e.id))
            .map((e) => (
              <button key={e.id} className="ligne-widget" onClick={() => choisir({ id: e.id, nom: e.nom, ligue: e.ligue })}>
                <span className="texte-ligne-widget">
                  <strong>{e.nom}</strong>
                  <span className="discret">{[e.sport, e.ligue].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
            ))}
      </div>
    </>
  )
}

// ---------- Colis ----------

function WidgetColis({ colis, changer, aller }: { colis: Colis[]; changer: (c: Colis[]) => void; aller: (url: string) => void }): React.JSX.Element {
  const [numero, setNumero] = useState('')
  const [nom, setNom] = useState('')
  const [transporteur, setTransporteur] = useState<string | null>(null)
  const propre = numeroColis(numero)
  const valide = RE_NUMERO_COLIS.test(propre) && !colis.some((c) => c.numero === propre)
  const choisi = transporteur ?? (propre.length >= 6 ? devinerTransporteur(propre) : 'laposte')
  return (
    <div className="corps-widget">
      <Entete titre="Suivi de colis" />
      {colis.length === 0 && <p className="discret petit">Colle un numéro de suivi : un clic ouvrira la page de suivi du transporteur.</p>}
      <div className="section-widget">
        {colis.map((c) => (
          <div key={c.numero} className="ligne-widget colis" role="button" tabIndex={0} title="Voir où en est le colis" onClick={() => aller(lienSuivi(c))}>
            <span className="pastille-lettre">📦</span>
            <span className="texte-ligne-widget">
              <strong>{c.nom || c.numero}</strong>
              <span className="discret">
                {TRANSPORTEURS.find((t) => t.id === c.transporteur)?.nom} · {c.numero}
              </span>
            </span>
            <span className="espace" />
            <button
              className="retirer-tache"
              title="Colis reçu : le retirer"
              onClick={(e) => {
                e.stopPropagation()
                changer(colis.filter((x) => x.numero !== c.numero))
              }}
            >
              <IconeCroix />
            </button>
          </div>
        ))}
      </div>
      <form
        className="formulaire-colis"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valide) return
          changer([
            ...colis,
            {
              numero: propre,
              nom: nom.trim().slice(0, 60),
              transporteur: choisi
            }
          ])
          setNumero('')
          setNom('')
          setTransporteur(null)
        }}
      >
        <input className="champ" value={numero} maxLength={50} onChange={(e) => setNumero(e.target.value)} placeholder="Numéro de suivi" spellCheck={false} />
        {propre.length >= 6 && (
          <>
            <input className="champ" value={nom} maxLength={60} onChange={(e) => setNom(e.target.value)} placeholder="Ce que c’est (facultatif)" />
            <div className="ajout-ami-widget">
              <select className="choix-widget" value={choisi} onChange={(e) => setTransporteur(e.target.value)}>
                {TRANSPORTEURS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nom}
                  </option>
                ))}
              </select>
              <button className="bouton-principal petit" disabled={!valide}>
                Ajouter
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}

// ---------- Traducteur ----------

function WidgetTraducteur({ langue, changer }: { langue: string; changer: (l: string) => void }): React.JSX.Element {
  const [texte, setTexte] = useState('')
  const [res, setRes] = useState<{ texte: string } | { erreur: string } | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [copie, setCopie] = useState(false)
  const traduire = async (): Promise<void> => {
    if (!texte.trim() || enCours) return
    setEnCours(true)
    setRes(await window.se7en.widgets.traduire(texte, langue))
    setEnCours(false)
  }
  return (
    <div className="corps-widget">
      <Entete titre="Traducteur">
        <span className="discret petit">vers</span>
        <select className="choix-widget" value={langue} onChange={(e) => changer(e.target.value)}>
          {LANGUES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.nom}
            </option>
          ))}
        </select>
      </Entete>
      <textarea
        className="notes-widget"
        value={texte}
        maxLength={4000}
        placeholder="Écris ou colle un texte dans n’importe quelle langue… (Ctrl+Entrée pour traduire)"
        onChange={(e) => setTexte(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            void traduire()
          }
        }}
      />
      <div className="ajout-ami-widget">
        <button className="bouton-principal petit" disabled={!texte.trim() || enCours} onClick={() => void traduire()}>
          {enCours ? 'Traduction…' : 'Traduire'}
        </button>
        {res && 'texte' in res && (
          <button
            className="bouton-verre petit"
            onClick={() =>
              void navigator.clipboard.writeText(res.texte).then(() => {
                setCopie(true)
                setTimeout(() => setCopie(false), 1500)
              })
            }
          >
            {copie ? 'Copié ✓' : 'Copier'}
          </button>
        )}
      </div>
      {res && ('texte' in res ? <p className="traduction-widget">{res.texte}</p> : <p className="petit message-erreur">{res.erreur}</p>)}
    </div>
  )
}

// ---------- Dates ----------

function depuis(date: number): string {
  const min = Math.round((Date.now() - date) / 60000)
  if (min < 1) return 'à l’instant'
  if (min < 60) return `il y a ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `il y a ${h} h`
  const j = Math.round(h / 24)
  return j === 1 ? 'hier' : `il y a ${j} jours`
}

const jourCourt = (ms: number): string => new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
const jourEtHeure = (ms: number): string =>
  new Date(ms).toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
