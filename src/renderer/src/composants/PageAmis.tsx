/* Page interne se7en://amis : profil (pseudo#code + photo), amis, demandes, et conversations en direct.
 * Les messages reçus sont affichés en texte brut ; un lien ne s'ouvre que sur clic, dans un nouvel onglet, et seulement en http(s). */
import { useEffect, useRef, useState } from 'react'
import { adresseLisible, estAdresseAutorisee } from '../../../shared/adresse'
import type { EtatOnglets } from '../../../shared/onglets'
import { codeAmi, MAX_MESSAGE, RE_CODE_AMI, RE_PSEUDO, type Ami, type EtatSocial, type MessageSocial, type ProfilSocial } from '../../../shared/social'
import { IconeCroix, IconeGlobe, IconePrecedent } from './Icones'

const estErreur = (v: unknown): v is { erreur: string } => !!v && typeof v === 'object' && 'erreur' in v

// photos déjà chargées (data: URL), le temps de la session de l'interface
const photos = new Map<string, Promise<string | null>>()
// conversation ouverte, retrouvée en revenant sur l'onglet Amis
let conversationOuverte: string | null = null

interface PropsAvatar {
  profil: Pick<ProfilSocial, 'id' | 'pseudo' | 'photo'>
  taille?: number
  enLigne?: boolean
  /** Change quand la photo vient d'être remplacée. */
  version?: number
}

function Avatar({ profil, taille = 36, enLigne, version = 0 }: PropsAvatar): React.JSX.Element {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    if (!profil.photo) return setSrc(null)
    if (!photos.has(profil.id)) photos.set(profil.id, window.se7en.social.photo(profil.id))
    let vivant = true
    void photos.get(profil.id)!.then((s) => vivant && setSrc(s))
    return () => {
      vivant = false
    }
  }, [profil.id, profil.photo, version])
  return (
    <span className="avatar" style={{ width: taille, height: taille, fontSize: taille * 0.42 }}>
      {src ? <img src={src} alt="" draggable={false} /> : profil.pseudo.charAt(0).toUpperCase()}
      {enLigne !== undefined && <i className={`presence${enLigne ? ' en-ligne' : ''}`} title={enLigne ? 'En ligne' : 'Hors ligne'} />}
    </span>
  )
}

function useSocial(): EtatSocial | null {
  const [etat, setEtat] = useState<EtatSocial | null>(null)
  useEffect(() => {
    void window.se7en.social.etat().then(setEtat)
    return window.se7en.social.surEtat(setEtat)
  }, [])
  return etat
}

export function PageAmis({ onglets }: { onglets: EtatOnglets }): React.JSX.Element {
  const etat = useSocial()
  if (!etat) return <div className="page-interne" />
  if (etat.connexion === 'desactive')
    return (
      <div className="page-interne">
        <h1>Amis</h1>
        <section className="bloc verre-fort">
          <h2>Pas encore disponible</h2>
          <p className="discret">Le serveur se7en social n’est pas configuré. Son adresse se règle dans les paramètres (section « Profils et amis »).</p>
          <div>
            <button className="bouton-verre" onClick={() => window.se7en.onglets.interne('se7en://parametres')}>
              Ouvrir les paramètres
            </button>
          </div>
        </section>
      </div>
    )
  if (!etat.profil) return <CreationProfil etat={etat} />
  return <EspaceAmis etat={etat} profil={etat.profil} onglets={onglets} />
}

// ---------- création du profil ----------

function CreationProfil({ etat }: { etat: EtatSocial }): React.JSX.Element {
  const [pseudo, setPseudo] = useState('')
  const [erreur, setErreur] = useState<string | null>(etat.erreur)
  const [envoi, setEnvoi] = useState(false)
  const valide = RE_PSEUDO.test(pseudo.trim())
  const creer = async (): Promise<void> => {
    setEnvoi(true)
    const r = await window.se7en.social.profil(pseudo.trim())
    setEnvoi(false)
    if (estErreur(r)) setErreur(r.erreur)
  }
  return (
    <div className="page-interne">
      <h1>Amis</h1>
      <section className="bloc verre-fort creation-profil">
        <h2>Crée ton profil</h2>
        <p className="discret">
          Choisis un pseudo : tu recevras un code à 4 chiffres (par exemple « Claire#4821 ») à donner à tes amis pour qu’ils t’ajoutent.
          Pas de mot de passe ni d’e-mail : une clé secrète est créée sur ce PC et protégée par ton compte Windows.
        </p>
        <form
          className="ligne-formulaire"
          onSubmit={(e) => {
            e.preventDefault()
            if (valide && !envoi) void creer()
          }}
        >
          <input className="champ" value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="Ton pseudo" maxLength={24} autoFocus spellCheck={false} />
          <button className="bouton-principal" disabled={!valide || envoi}>
            {envoi ? 'Création…' : 'Créer mon profil'}
          </button>
        </form>
        {erreur && <p className="message-erreur">{erreur}</p>}
        <p className="discret petit">
          Seuls ton pseudo, ta photo, ta liste d’amis et vos messages passent par le serveur se7en social. Ton coffre, ton historique et l’IA restent sur ce PC.
        </p>
      </section>
    </div>
  )
}

// ---------- profil, amis, demandes ----------

function EspaceAmis({ etat, profil, onglets }: { etat: EtatSocial; profil: ProfilSocial; onglets: EtatOnglets }): React.JSX.Element {
  const [amis, setAmis] = useState<Ami[]>([])
  const [ouvert, setOuvertEtat] = useState<string | null>(conversationOuverte)
  const setOuvert = (id: string | null): void => {
    conversationOuverte = id
    setOuvertEtat(id)
  }
  const [code, setCode] = useState('')
  const [info, setInfo] = useState<{ texte: string; erreur: boolean } | null>(null)
  const [copie, setCopie] = useState(false)
  const [pseudo, setPseudo] = useState<string | null>(null)
  const [versionPhoto, setVersionPhoto] = useState(0)
  const ouvertRef = useRef(ouvert)
  ouvertRef.current = ouvert

  const charger = async (): Promise<void> => {
    const r = await window.se7en.social.amis()
    if (!estErreur(r)) setAmis(r)
  }
  useEffect(() => {
    void charger()
  }, [etat.connexion])
  useEffect(
    () =>
      window.se7en.social.surEvenement((ev) => {
        if (ev.type === 'presence') setAmis((l) => l.map((a) => (a.id === ev.id ? { ...a, enLigne: ev.enLigne } : a)))
        else if (ev.type === 'amis') void charger()
        // un message dans la conversation ouverte est lu tout de suite ; sinon le compteur de l'ami monte
        else if (ev.message.de !== ouvertRef.current) setAmis((l) => l.map((a) => (a.id === ev.message.de ? { ...a, nonLus: a.nonLus + 1 } : a)))
      }),
    []
  )

  const ami = amis.find((a) => a.id === ouvert && a.statut === 'ami')
  if (ami)
    return (
      <Conversation
        ami={ami}
        moi={profil}
        onglets={onglets}
        retour={() => {
          setOuvert(null)
          void charger()
        }}
      />
    )

  const ajouter = async (): Promise<void> => {
    const r = await window.se7en.social.ajouter(code.trim())
    if (estErreur(r)) return setInfo({ texte: r.erreur, erreur: true })
    setCode('')
    setInfo({ texte: r.statut === 'ami' ? 'Vous êtes maintenant amis !' : 'Demande envoyée.', erreur: false })
    void charger()
  }
  const agir = async (action: Promise<unknown>): Promise<void> => {
    const r = await action
    if (estErreur(r)) setInfo({ texte: r.erreur, erreur: true })
    void charger()
  }
  const recues = amis.filter((a) => a.statut === 'recue')
  const envoyees = amis.filter((a) => a.statut === 'envoyee')
  const liste = amis.filter((a) => a.statut === 'ami').sort((a, b) => Number(b.enLigne) - Number(a.enLigne) || b.nonLus - a.nonLus || a.pseudo.localeCompare(b.pseudo))

  return (
    <div className="page-interne">
      <div className="entete-page">
        <h1>Amis</h1>
        <span className={`etat-connexion ${etat.connexion}`}>
          {etat.connexion === 'connecte' ? 'Connecté' : etat.connexion === 'connexion' ? 'Connexion…' : 'Hors ligne'}
        </span>
      </div>

      <section className="bloc verre-fort carte-profil">
        <button
          className="bouton-avatar"
          title="Changer de photo"
          onClick={async () => {
            const r = await window.se7en.social.choisirPhoto()
            if (estErreur(r)) setInfo({ texte: r.erreur, erreur: true })
            else if (r) {
              photos.delete(profil.id)
              setVersionPhoto((v) => v + 1)
            }
          }}
        >
          <Avatar profil={profil} taille={64} version={versionPhoto} />
        </button>
        <div className="infos-profil">
          {pseudo === null ? (
            <strong className="pseudo">{profil.pseudo}</strong>
          ) : (
            <form
              className="ligne-formulaire"
              onSubmit={async (e) => {
                e.preventDefault()
                const r = await window.se7en.social.profil(pseudo.trim())
                if (estErreur(r)) return setInfo({ texte: r.erreur, erreur: true })
                setPseudo(null)
              }}
            >
              <input className="champ" value={pseudo} onChange={(e) => setPseudo(e.target.value)} maxLength={24} autoFocus spellCheck={false} />
              <button className="bouton-verre" disabled={!RE_PSEUDO.test(pseudo.trim())}>
                Enregistrer
              </button>
              <button type="button" className="bouton-verre" onClick={() => setPseudo(null)}>
                Annuler
              </button>
            </form>
          )}
          <span className="discret">
            Ton code ami : <span className="code-ami">{codeAmi(profil)}</span>
          </span>
          <div className="actions-profil">
            <button
              className="bouton-verre"
              onClick={() => {
                navigator.clipboard.writeText(codeAmi(profil))
                setCopie(true)
                setTimeout(() => setCopie(false), 1500)
              }}
            >
              {copie ? 'Copié !' : 'Copier mon code'}
            </button>
            {pseudo === null && (
              <button className="bouton-verre" onClick={() => setPseudo(profil.pseudo)}>
                Changer de pseudo
              </button>
            )}
            <button
              className="bouton-verre discret-danger"
              onClick={async () => {
                if (!confirm('Supprimer ton compte se7en social ? Ton profil, ta photo, tes amis et tous vos messages seront effacés du serveur.')) return
                const r = await window.se7en.social.supprimer()
                if (estErreur(r)) setInfo({ texte: r.erreur, erreur: true })
              }}
            >
              Supprimer mon compte
            </button>
          </div>
        </div>
      </section>

      <section className="bloc verre-fort">
        <h2>Ajouter un ami</h2>
        <form
          className="ligne-formulaire"
          onSubmit={(e) => {
            e.preventDefault()
            if (RE_CODE_AMI.test(code.trim())) void ajouter()
          }}
        >
          <input className="champ" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Son code, par exemple Claire#4821" maxLength={40} spellCheck={false} />
          <button className="bouton-principal" disabled={!RE_CODE_AMI.test(code.trim())}>
            Ajouter
          </button>
        </form>
        {info && <p className={info.erreur ? 'message-erreur' : 'message-ok'}>{info.texte}</p>}
        {etat.erreur && <p className="message-erreur">{etat.erreur}</p>}
      </section>

      {(recues.length > 0 || envoyees.length > 0) && (
        <section className="bloc verre-fort">
          <h2>Demandes</h2>
          {recues.map((a) => (
            <div key={a.id} className="ligne-liste">
              <Avatar profil={a} />
              <span className="nom-ami">
                <strong>{a.pseudo}</strong> veut être ton ami
              </span>
              <button className="bouton-principal petit" onClick={() => void agir(window.se7en.social.accepter(a.id))}>
                Accepter
              </button>
              <button className="bouton-verre" onClick={() => void agir(window.se7en.social.retirer(a.id))}>
                Refuser
              </button>
            </div>
          ))}
          {envoyees.map((a) => (
            <div key={a.id} className="ligne-liste">
              <Avatar profil={a} />
              <span className="nom-ami">
                {codeAmi(a)} <span className="discret">· en attente</span>
              </span>
              <button className="bouton-icone" title="Annuler la demande" onClick={() => void agir(window.se7en.social.retirer(a.id))}>
                <IconeCroix />
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="bloc verre-fort">
        <h2>Mes amis</h2>
        {liste.length === 0 && <p className="discret">Pas encore d’amis : donne-leur ton code, ou ajoute le leur.</p>}
        {liste.map((a) => (
          <button key={a.id} className="ligne-liste ligne-ami" onClick={() => setOuvert(a.id)}>
            <Avatar profil={a} enLigne={a.enLigne} />
            <span className="nom-ami">
              <strong>{a.pseudo}</strong>
              <span className="discret"> {a.enLigne ? 'en ligne' : ''}</span>
            </span>
            {a.nonLus > 0 && <span className="pastille-non-lus">{a.nonLus}</span>}
          </button>
        ))}
      </section>
    </div>
  )
}

// ---------- conversation ----------

function heure(date: number): string {
  const d = new Date(date)
  const auj = new Date().toDateString() === d.toDateString()
  return auj ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function Conversation({ ami, moi, onglets, retour }: { ami: Ami; moi: ProfilSocial; onglets: EtatOnglets; retour: () => void }): React.JSX.Element {
  const [messages, setMessages] = useState<MessageSocial[]>([])
  const [plusAnciens, setPlusAnciens] = useState(false)
  const [texte, setTexte] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [choixOnglet, setChoixOnglet] = useState(false)
  const fil = useRef<HTMLDivElement>(null)
  const enBas = useRef(true)

  useEffect(() => {
    void window.se7en.social.messages(ami.id).then((r) => {
      if (estErreur(r)) return setErreur(r.erreur)
      setMessages(r)
      setPlusAnciens(r.length === 50)
    })
    window.se7en.social.lu(ami.id)
    return window.se7en.social.surEvenement((ev) => {
      if (ev.type !== 'message' || ev.message.de !== ami.id) return
      setMessages((l) => (l.some((m) => m.id === ev.message.id) ? l : [...l, ev.message]))
      window.se7en.social.lu(ami.id)
    })
  }, [ami.id])

  // reste collé en bas quand un message arrive (sauf si on lit plus haut)
  useEffect(() => {
    const el = fil.current
    if (el && enBas.current) el.scrollTop = el.scrollHeight
  }, [messages])

  const ajouter = (r: MessageSocial | { erreur: string }): void => {
    if (estErreur(r)) return setErreur(r.erreur)
    setErreur(null)
    enBas.current = true
    setMessages((l) => [...l, r])
  }
  const envoyer = async (): Promise<void> => {
    const t = texte.trim()
    if (!t) return
    setTexte('')
    ajouter(await window.se7en.social.envoyer(ami.id, t))
  }
  const anciens = async (): Promise<void> => {
    const r = await window.se7en.social.messages(ami.id, messages[0]?.date)
    if (estErreur(r)) return setErreur(r.erreur)
    enBas.current = false
    setMessages((l) => [...r, ...l])
    setPlusAnciens(r.length === 50)
  }
  const pagesWeb = onglets.onglets.filter((o) => estAdresseAutorisee(o.url))

  return (
    <div className="page-interne page-conversation">
      <div className="entete-conversation">
        <button className="bouton-icone" title="Retour" onClick={retour}>
          <IconePrecedent />
        </button>
        <Avatar profil={ami} taille={40} enLigne={ami.enLigne} />
        <div className="infos-profil">
          <strong className="pseudo">{ami.pseudo}</strong>
          <span className="discret">{ami.enLigne ? 'En ligne' : 'Hors ligne'}</span>
        </div>
        <button
          className="bouton-verre retirer-ami"
          onClick={async () => {
            if (!confirm(`Retirer ${ami.pseudo} de tes amis ? Vos messages seront effacés.`)) return
            await window.se7en.social.retirer(ami.id)
            retour()
          }}
        >
          Retirer
        </button>
      </div>

      <div
        ref={fil}
        className="fil-messages verre-fort"
        onScroll={(e) => {
          const el = e.currentTarget
          enBas.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
        }}
      >
        {plusAnciens && (
          <button className="bouton-verre anciens" onClick={() => void anciens()}>
            Messages plus anciens
          </button>
        )}
        {messages.length === 0 && <p className="vide">Envoie ton premier message ou un onglet à {ami.pseudo}.</p>}
        {messages.map((m) => {
          const deMoi = m.de === moi.id
          return (
            <div key={m.id} className={`bulle-ami${deMoi ? ' de-moi' : ''}`}>
              {m.url && estAdresseAutorisee(m.url) ? (
                <button className="carte-lien" onClick={() => window.se7en.social.ouvrirLien(m.url!)} title={m.url}>
                  <IconeGlobe />
                  <span>
                    <strong>{m.titre || adresseLisible(m.url)}</strong>
                    <span className="discret">{new URL(m.url).hostname}</span>
                  </span>
                </button>
              ) : null}
              {m.texte && <p>{m.texte}</p>}
              <time>{heure(m.date)}</time>
            </div>
          )
        })}
      </div>

      {erreur && <p className="message-erreur">{erreur}</p>}
      {choixOnglet && (
        <div className="choix-onglet verre-fort">
          {pagesWeb.length === 0 && <p className="discret">Aucune page web ouverte.</p>}
          {pagesWeb.map((o) => (
            <button
              key={o.id}
              className="ligne-liste"
              onClick={async () => {
                setChoixOnglet(false)
                ajouter(await window.se7en.social.envoyerOnglet(ami.id, o.id))
              }}
            >
              {o.favicon ? <img className="favicon" src={o.favicon} alt="" /> : <IconeGlobe />}
              <span className="nom-ami">{o.titre || adresseLisible(o.url)}</span>
            </button>
          ))}
        </div>
      )}
      <form
        className="saisie-message verre-fort"
        onSubmit={(e) => {
          e.preventDefault()
          void envoyer()
        }}
      >
        <button type="button" className="bouton-verre" onClick={() => setChoixOnglet((v) => !v)} title="Envoyer un de tes onglets">
          Envoyer un onglet
        </button>
        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void envoyer()
            }
          }}
          placeholder={`Message à ${ami.pseudo}`}
          maxLength={MAX_MESSAGE}
          rows={1}
          autoFocus
        />
        <button className="bouton-principal petit" disabled={!texte.trim()}>
          Envoyer
        </button>
      </form>
    </div>
  )
}
