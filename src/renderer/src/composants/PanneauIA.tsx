/* Panneau IA, à droite (Ctrl+Espace) : chat en flux avec l'IA locale, « discute avec la page », @onglets, /Skills,
 * résumé en un clic, historique des conversations. L'IA ne fait que répondre : aucune action sur les pages. */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FluxChat, MessageChat, PageJointe, ResumeConversation, Skill, ZoneCapture } from '../../../shared/chat'
import { modelePresent, type EtatOllama } from '../../../shared/ia'
import type { EtatOnglet, EtatOnglets } from '../../../shared/onglets'
import type { Reglages } from '../../../shared/reglages'
import { IconeCroix, IconeHistorique, IconeIA, IconePlus, IconeZone } from './Icones'
import { ReponseFluide } from './Markdown'
import { RemplissagePdf } from './RemplissagePdf'
import { IconeOnglet } from './OngletItem'

/** Question envoyée depuis ailleurs (barre « Demande ou cherche »). `n` change à chaque nouvelle demande. */
export interface DemandeExterne {
  texte: string
  avecPage: boolean
  /** Zone de l'écran choisie (modèle vision). */
  zone?: ZoneCapture
  n: number
}

/** Gmail ouvert sur un e-mail : l'IA propose une réponse, insérée dans la zone de réponse sur clic. */
const estGmail = (url: string | undefined): boolean => !!url && /^https:\/\/mail\.google\.com\//.test(url)
const DEMANDE_GMAIL =
  "Propose une réponse à l'e-mail ouvert dans cette page (le dernier message du fil). Réponds dans la langue de l'e-mail, sur un ton adapté, " +
  "sans objet ni explication : écris uniquement le texte de la réponse, prêt à être envoyé, avec une formule de politesse."


interface Props {
  etat: EtatOnglets
  actif: EtatOnglet | undefined
  ia: EtatOllama | null
  reglages: Reglages
  ouvert: boolean
  fermer: () => void
  demande: DemandeExterne | null
}

type Etape = FluxChat['etape']
/** Un onglet que l'IA peut lire : une page web, ou un PDF (même ouvert depuis le PC). */
const estWeb = (o: EtatOnglet | undefined): o is EtatOnglet => !!o && (/^https?:\/\//.test(o.url) || !!o.pdf)

const TEXTES_ETAPE: Partial<Record<Etape, string>> = {
  lecture: 'Lecture de la page…',
  preparation: 'Préparation du modèle…'
}

function ChipsPages({ pages, image, alertes }: { pages?: PageJointe[]; image?: boolean; alertes?: string[] }): React.JSX.Element | null {
  if (!pages?.length && !image) return null
  return (
    <div className="pages-lues">
      {!!alertes?.length && (
        <div className="alerte-manipulation">
          ⚠ {alertes.length > 1 ? 'Ces pages contiennent' : 'Cette page contient'} du texte qui essaie de donner des ordres à l'IA. Elle a été prévenue de ne pas le suivre : reste prudent avec ce que la page te demande.
        </div>
      )}
      {pages?.map((p) => (
        <span key={p.url} className="chip petit" title={p.url}>
          {p.titre || p.url}
        </span>
      ))}
      {image && <span className="chip petit">{pages?.length ? 'capture d’écran' : 'zone de l’écran'}</span>}
    </div>
  )
}

export function PanneauIA({ etat, actif, ia, reglages, ouvert, fermer, demande }: Props): React.JSX.Element {
  const [idConversation, setIdConversation] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageChat[]>([])
  const [enCours, setEnCours] = useState<{ idReponse: string; etape: Etape } | null>(null)
  const [saisie, setSaisie] = useState('')
  const [avecPage, setAvecPage] = useState(true)
  const [avecNavigation, setAvecNavigation] = useState(false)
  const [mentions, setMentions] = useState<number[]>([])
  const [vue, setVue] = useState<'chat' | 'historique'>('chat')
  const [historique, setHistorique] = useState<ResumeConversation[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [choix, setChoix] = useState(0)
  const [avertissement, setAvertissement] = useState<string | null>(null)
  /** Formulaire PDF : nombre de champs à remplir dans l'onglet actif, et aperçu de remplissage ouvert ou non. */
  const [champsPdf, setChampsPdf] = useState(0)
  const [remplissage, setRemplissage] = useState(false)
  const champ = useRef<HTMLTextAreaElement>(null)
  const fil = useRef<HTMLDivElement>(null)
  const enCoursRef = useRef(enCours)
  const demandeTraitee = useRef<number | null>(null)
  enCoursRef.current = enCours

  const pret = ia?.phase === 'pret' && modelePresent(reglages.modeleTexte, ia.modeles)
  const pageActive = estWeb(actif) ? actif : undefined

  // un PDF avec des champs : on propose de le remplir avec le coffre
  useEffect(() => {
    setChampsPdf(0)
    if (!pageActive?.pdf) return setRemplissage(false)
    let actuel = true
    window.se7en.formulaire.compter(pageActive.id).then((n) => actuel && setChampsPdf(n))
    return () => {
      actuel = false
    }
  }, [pageActive?.id, pageActive?.pdf])

  // à l'ouverture : Skills à jour et clavier dans la zone de saisie
  useEffect(() => {
    if (!ouvert) return
    window.se7en.skills.lire().then(setSkills)
    requestAnimationFrame(() => champ.current?.focus())
  }, [ouvert])

  // la réponse arrive en morceaux
  useEffect(
    () =>
      window.se7en.chat.surFlux((f) => {
        const courant = enCoursRef.current
        if (!courant || f.idReponse !== courant.idReponse) return
        setMessages((liste) =>
          liste.map((m, i) => {
            if (m.id === f.idReponse) {
              if (f.etape === 'erreur') return { ...m, texte: f.erreur ?? "L'IA n'a pas pu répondre.", erreur: true }
              return f.delta ? { ...m, texte: m.texte + f.delta } : m
            }
            // les pages lues s'affichent sous la question
            if (f.pages && liste[i + 1]?.id === f.idReponse) return { ...m, pages: f.pages, image: f.image, alertes: f.alertes }
            return m
          })
        )
        setEnCours(f.etape === 'fini' || f.etape === 'erreur' ? null : { idReponse: f.idReponse, etape: f.etape })
      }),
    []
  )

  // défilement automatique tant qu'on est en bas du fil (aussi pendant que la réponse se dévoile)
  const suivreFil = (): void => {
    const el = fil.current
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 120) el.scrollTop = el.scrollHeight
  }
  useEffect(suivreFil, [messages, enCours])

  const nouvelleConversation = (): void => {
    if (enCours) window.se7en.chat.arreter()
    setIdConversation(null)
    setMessages([])
    setEnCours(null)
    setAvertissement(null)
    setVue('chat')
    champ.current?.focus()
  }

  const envoyer = async (texte: string, options: { avecPage?: boolean; nouvelle?: boolean; zone?: ZoneCapture } = {}): Promise<void> => {
    if (!texte.trim() || enCoursRef.current) return
    // « remplis ce PDF » sur un formulaire : on ouvre l'aperçu de remplissage plutôt que le chat
    if (pageActive?.pdf && champsPdf > 0 && /\b(rempli[rst]?|compl[eè]te[rz]?)\b/i.test(texte)) {
      setSaisie('')
      setRemplissage(true)
      return
    }
    const avecPageActive = options.avecPage ?? (avecPage && !!pageActive)
    const id = options.nouvelle ? null : idConversation
    setAvertissement(null)
    const r = await window.se7en.chat.envoyer({ idConversation: id, texte, avecPageActive, idsOnglets: mentions, zone: options.zone, avecNavigation: avecNavigation && reglages.memoireNavigation })
    if ('erreur' in r) {
      setAvertissement(r.erreur)
      return
    }
    const date = Date.now()
    setIdConversation(r.idConversation)
    setMessages((liste) => [
      ...(options.nouvelle ? [] : liste),
      { id: r.idQuestion, role: 'user', texte, date, image: !!options.zone },
      { id: r.idReponse, role: 'assistant', texte: r.reponseImmediate ?? '', date }
    ])
    if (r.reponseImmediate === undefined) setEnCours({ idReponse: r.idReponse, etape: 'lecture' })
    setSaisie('')
    setMentions([])
    setVue('chat')
  }

  // question posée depuis la barre « Demande ou cherche »
  useEffect(() => {
    // le panneau s'ouvre un instant après la demande (animation) : elle part dès qu'il est ouvert, une seule fois
    if (!demande || !ouvert || demandeTraitee.current === demande.n) return
    demandeTraitee.current = demande.n
    void envoyer(demande.texte, { avecPage: demande.avecPage, nouvelle: true, zone: demande.zone })
    // seulement quand une nouvelle demande arrive ou que le panneau s'ouvre (pas à chaque changement de envoyer)
  }, [demande?.n, ouvert])

  // ---------- suggestions : /skill et @onglet ----------
  const suggestion = useMemo(() => {
    const slash = /^\/([a-z0-9-]*)$/i.exec(saisie)
    if (slash) {
      const f = slash[1].toLowerCase()
      return { type: 'skill' as const, liste: skills.filter((s) => s.commande.startsWith(f)) }
    }
    const at = /(^|\s)@([^\s@]*)$/.exec(saisie)
    if (at) {
      const f = at[2].toLowerCase()
      const liste = etat.onglets.filter((o) => estWeb(o) && o.id !== pageActive?.id && !mentions.includes(o.id) && `${o.titre} ${o.url}`.toLowerCase().includes(f))
      return { type: 'onglet' as const, liste }
    }
    return null
  }, [saisie, skills, etat.onglets, mentions, pageActive?.id])
  const nbSuggestions = suggestion?.liste.length ?? 0
  useEffect(() => setChoix(0), [nbSuggestions, suggestion?.type])

  const appliquerSuggestion = (i: number): void => {
    if (!suggestion) return
    if (suggestion.type === 'skill') {
      const s = suggestion.liste[i]
      if (s) setSaisie(`/${s.commande} `)
    } else {
      const o = suggestion.liste[i]
      if (!o) return
      setMentions((m) => [...m, o.id])
      setSaisie((t) => t.replace(/(^|\s)@[^\s@]*$/, '$1'))
    }
    champ.current?.focus()
  }

  // ---------- historique ----------
  const ouvrirHistorique = async (): Promise<void> => {
    setHistorique(await window.se7en.chat.conversations())
    setVue('historique')
  }
  const ouvrirConversation = async (id: string): Promise<void> => {
    const c = await window.se7en.chat.conversation(id)
    if (!c) return
    setIdConversation(c.id)
    setMessages(c.messages)
    setVue('chat')
  }

  // ---------- rendu ----------
  const corpsInactif = (): React.JSX.Element => {
    const t = ia?.tache
    return (
      <div className="ia-inactive">
        <IconeIA />
        {!ia || ia.phase === 'verification' ? (
          <p className="discret">Recherche de l'IA locale…</p>
        ) : ia.phase === 'absent' ? (
          <>
            <p>L'IA locale n'est pas encore installée.</p>
            <button className="bouton-principal" onClick={() => window.se7en.onglets.interne('se7en://ia')}>
              Installer l'IA
            </button>
          </>
        ) : ia.phase === 'arrete' ? (
          <>
            <p>L'IA locale n'est pas activée.</p>
            <p className="discret">Elle tourne sur ton PC et s'arrête quand tu fermes le navigateur.</p>
            <button className="bouton-principal" disabled={!!t} onClick={() => window.se7en.ia.demarrer()}>
              {t?.type === 'demarrage' ? 'Activation…' : "Activer l'IA"}
            </button>
          </>
        ) : (
          <>
            <p>Le modèle {reglages.modeleTexte} n'est pas téléchargé.</p>
            <button className="bouton-principal" onClick={() => window.se7en.onglets.interne('se7en://ia')}>
              Télécharger le modèle
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <aside className={`panneau-ia${ouvert ? ' ouvert' : ''}`} aria-hidden={!ouvert}>
      <div className="panneau-ia-contenu verre-fort">
        <header className="entete-ia">
          <IconeIA />
          <strong>IA locale</strong>
          <span className="espace" />
          {pret && pageActive && (
            <button className="bouton-verre petit" disabled={!!enCours} onClick={() => void envoyer('/resume', { avecPage: true, nouvelle: true })} title="Résumer la page">
              Résumer
            </button>
          )}
          <button className="bouton-icone" title="Nouvelle conversation" onClick={nouvelleConversation}>
            <IconePlus />
          </button>
          <button className={`bouton-icone${vue === 'historique' ? ' enfonce' : ''}`} title="Conversations" onClick={() => (vue === 'historique' ? setVue('chat') : void ouvrirHistorique())}>
            <IconeHistorique />
          </button>
          <button className="bouton-icone" title="Fermer (Ctrl+Espace)" onClick={fermer}>
            <IconeCroix />
          </button>
        </header>

        {remplissage && pageActive ? (
          <div className="fil-ia">
            <RemplissagePdf key={pageActive.id} idOnglet={pageActive.id} fermer={() => setRemplissage(false)} />
          </div>
        ) : !pret ? (
          corpsInactif()
        ) : vue === 'historique' ? (
          <div className="fil-ia">
            {historique.length === 0 && <p className="vide">Aucune conversation.</p>}
            {historique.map((c) => (
              <div key={c.id} className="ligne-liste">
                <button className="lien-liste" onClick={() => void ouvrirConversation(c.id)}>
                  <span className="titre-liste">{c.titre}</span>
                  <span className="adresse-liste">{new Date(c.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                </button>
                <button
                  className="bouton-icone discret-survol"
                  title="Supprimer"
                  onClick={async () => {
                    await window.se7en.chat.supprimer(c.id)
                    if (c.id === idConversation) nouvelleConversation()
                    setHistorique(await window.se7en.chat.conversations())
                  }}
                >
                  <IconeCroix />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="fil-ia" ref={fil}>
            {messages.length === 0 && (
              <div className="accueil-ia">
                <p>Pose une question{pageActive ? ' sur la page, ou sur ce que tu veux' : ''}.</p>
                <p className="discret">
                  <kbd>/</kbd> pour une Skill (/resume, /traduis…), <kbd>@</kbd> pour joindre un autre onglet.
                </p>
              </div>
            )}
            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="message-ia utilisateur">
                  <div className="bulle">{m.texte}</div>
                  <ChipsPages pages={m.pages} image={m.image} alertes={m.alertes} />
                </div>
              ) : (
                <div key={m.id} className={`message-ia assistant${m.erreur ? ' erreur' : ''}`}>
                  {m.texte ? <ReponseFluide texte={m.texte} enCours={enCours?.idReponse === m.id} surAvance={suivreFil} /> : enCours?.idReponse === m.id && <p className="discret attente">{TEXTES_ETAPE[enCours.etape] ?? '…'}</p>}
                  {enCours?.idReponse === m.id && m.texte && <span className="curseur" />}
                  {!enCours && m.texte && !m.erreur && (
                    <div className="actions-message">
                      <button className="copier" onClick={() => void navigator.clipboard.writeText(m.texte)}>
                        Copier
                      </button>
                      {pageActive && estGmail(pageActive.url) && (
                        <button
                          className="copier inserer"
                          title="Clique d'abord sur « Répondre » dans Gmail"
                          onClick={async () => {
                            const ok = await window.se7en.ia.inserer(pageActive.id, m.texte)
                            setAvertissement(ok ? null : 'Clique d’abord sur « Répondre » dans Gmail, puis sur « Insérer dans l’e-mail ».')
                          }}
                        >
                          Insérer dans l’e-mail
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            )}
            {avertissement && <div className="message-erreur">{avertissement}</div>}
          </div>
        )}

        {!remplissage && pageActive?.pdf && champsPdf > 0 && (
          <div className="carte-formulaire">
            <span>
              Ce PDF est un formulaire ({champsPdf} champ{champsPdf > 1 ? 's' : ''}).
            </span>
            <button className="bouton-principal" onClick={() => setRemplissage(true)}>
              Remplir avec mon coffre
            </button>
          </div>
        )}
        {pret && vue === 'chat' && !remplissage && (
          <div className="saisie-ia">
            {suggestion && nbSuggestions > 0 && (
              <div className="suggestions verre-fort">
                {suggestion.type === 'skill'
                  ? suggestion.liste.map((s, i) => (
                      <button key={s.id} className={i === choix ? 'actif' : ''} onMouseDown={(e) => (e.preventDefault(), appliquerSuggestion(i))}>
                        <code>/{s.commande}</code> <span className="discret">{s.titre}</span>
                      </button>
                    ))
                  : suggestion.liste.map((o, i) => (
                      <button key={o.id} className={i === choix ? 'actif' : ''} onMouseDown={(e) => (e.preventDefault(), appliquerSuggestion(i))}>
                        <IconeOnglet onglet={o} /> <span className="titre-liste">{o.titre}</span>
                      </button>
                    ))}
              </div>
            )}
            <div className="chips-saisie">
              {pageActive && (
                <button className={`chip${avecPage ? ' actif' : ''}`} title={avecPage ? 'La page est jointe à ta question' : 'Joindre la page'} onClick={() => setAvecPage((v) => !v)}>
                  <IconeOnglet onglet={pageActive} />
                  <span>{avecPage ? pageActive.titre : 'Joindre la page'}</span>
                </button>
              )}
              {reglages.memoireNavigation && (
                <button
                  className={`chip${avecNavigation ? ' actif' : ''}`}
                  title="Chercher aussi dans les pages vues ces 30 derniers jours"
                  onClick={() => setAvecNavigation((v) => !v)}
                >
                  <IconeHistorique />
                  <span>Ma navigation</span>
                </button>
              )}
              {pageActive && estGmail(pageActive.url) && (
                <button className="chip chip-ia" disabled={!!enCours} onClick={() => void envoyer(DEMANDE_GMAIL, { avecPage: true, nouvelle: true })}>
                  <IconeIA />
                  <span>Proposer une réponse</span>
                </button>
              )}
              {pageActive && (
                <button className="chip" title="Encadre une partie de la page pour poser une question dessus" onClick={() => window.se7en.ia.zone()}>
                  <IconeZone />
                  <span>Zone de l’écran</span>
                </button>
              )}
              {mentions.map((id) => {
                const o = etat.onglets.find((x) => x.id === id)
                if (!o) return null
                return (
                  <button key={id} className="chip actif" title="Retirer" onClick={() => setMentions((m) => m.filter((x) => x !== id))}>
                    <IconeOnglet onglet={o} />
                    <span>{o.titre}</span>
                    <IconeCroix />
                  </button>
                )
              })}
            </div>
            <div className="zone-saisie">
              <textarea
                ref={champ}
                rows={1}
                value={saisie}
                placeholder={pageActive && avecPage ? 'Demande quelque chose sur cette page…' : 'Demande quelque chose…'}
                onChange={(e) => setSaisie(e.target.value)}
                onKeyDown={(e) => {
                  if (suggestion && nbSuggestions > 0) {
                    if (e.key === 'ArrowDown') return (e.preventDefault(), setChoix((c) => (c + 1) % nbSuggestions))
                    if (e.key === 'ArrowUp') return (e.preventDefault(), setChoix((c) => (c - 1 + nbSuggestions) % nbSuggestions))
                    if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey && suggestion.type === 'onglet'))
                      return (e.preventDefault(), appliquerSuggestion(choix))
                  }
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void envoyer(saisie)
                  }
                  if (e.key === 'Escape') fermer()
                }}
              />
              {enCours ? (
                <button className="bouton-envoi arret" title="Arrêter" onClick={() => window.se7en.chat.arreter()}>
                  <span />
                </button>
              ) : (
                <button className="bouton-envoi" title="Envoyer (Entrée)" disabled={!saisie.trim()} onClick={() => void envoyer(saisie)}>
                  ↑
                </button>
              )}
            </div>
            <p className="note-ia">Tout reste sur ton PC. L'IA peut se tromper : vérifie les informations importantes.</p>
          </div>
        )}
      </div>
    </aside>
  )
}
