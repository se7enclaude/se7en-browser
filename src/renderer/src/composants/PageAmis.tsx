/* Page interne se7en://amis : profil (pseudo#code + photo), amis, groupes, demandes, et conversations en direct
 * (texte, liens, images et captures, « est en train d'écrire », « Vu »), plus « naviguer ensemble » avec un ami.
 * Les messages reçus sont affichés en texte brut ; un lien ne s'ouvre que sur clic, dans un nouvel onglet, et seulement en http(s).
 * Une image reçue n'est qu'une image (data: URL vérifiée par le main), jamais du HTML. */
import { useEffect, useRef, useState } from 'react'
import { lireSkillPartagee } from '../../../shared/chat'
import { CarteSkillRecue } from './SkillPartagee'
import { adresseLisible, estAdresseAutorisee } from '../../../shared/adresse'
import type { EtatOnglets } from '../../../shared/onglets'
import {
  codeAmi,
  MAX_MEMBRES_GROUPE,
  MAX_MESSAGE,
  RE_CODE_AMI,
  RE_PSEUDO,
  type Ami,
  type CibleSocial,
  type EtatSocial,
  type GroupeSocial,
  type MessageSocial,
  type ProfilSocial,
  type StatutSocial,
  MAX_VOCAL_SECONDES,
  texteStatut
} from '../../../shared/social'
import { IconeCroix, IconeEnsemble, IconeGlobe, IconeImage, IconeMicro, IconePrecedent } from './Icones'

const estErreur = (v: unknown): v is { erreur: string } => !!v && typeof v === 'object' && 'erreur' in v
const memeCible = (a: CibleSocial | null, b: CibleSocial | null): boolean => !!a && !!b && a.type === b.type && a.id === b.id

// photos déjà chargées (data: URL), le temps de la session de l'interface
const photos = new Map<string, Promise<string | null>>()
// conversation ouverte, retrouvée en revenant sur l'onglet Amis
let conversationOuverte: CibleSocial | null = null

/** Clic sur la notification d'un message : la page Amis s'ouvre directement sur la conversation. */
export function ouvrirConversation(cible: CibleSocial): void {
  conversationOuverte = cible
  window.dispatchEvent(new CustomEvent('se7en-ouvrir-conversation', { detail: cible }))
}

interface PropsAvatar {
  profil: Pick<ProfilSocial, 'id' | 'pseudo' | 'photo'>
  taille?: number
  enLigne?: boolean
  /** Change quand la photo vient d'être remplacée. */
  version?: number
}

export function Avatar({ profil, taille = 36, enLigne, version = 0 }: PropsAvatar): React.JSX.Element {
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

/** Avatar d'un groupe : les deux ou trois premiers membres, un peu superposés. */
export function AvatarGroupe({ groupe, moi, taille = 36 }: { groupe: GroupeSocial; moi: string; taille?: number }): React.JSX.Element {
  const autres = groupe.membres.filter((m) => m.id !== moi).slice(0, 3)
  return (
    <span className="avatar-groupe" style={{ width: taille, height: taille }}>
      {autres.map((m) => (
        <Avatar key={m.id} profil={m} taille={Math.round(taille * 0.62)} />
      ))}
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

// ---------- création du profil (ou récupération avec le code de secours) ----------

function CreationProfil({ etat }: { etat: EtatSocial }): React.JSX.Element {
  const [pseudo, setPseudo] = useState('')
  const [erreur, setErreur] = useState<string | null>(etat.erreur)
  const [envoi, setEnvoi] = useState(false)
  const [recuperation, setRecuperation] = useState(false)
  const [code, setCode] = useState('')
  const valide = RE_PSEUDO.test(pseudo.trim())
  const creer = async (): Promise<void> => {
    setEnvoi(true)
    const r = await window.se7en.social.profil(pseudo.trim())
    setEnvoi(false)
    if (estErreur(r)) setErreur(r.erreur)
  }
  const recuperer = async (): Promise<void> => {
    setEnvoi(true)
    const r = await window.se7en.social.recuperer(code)
    setEnvoi(false)
    if (estErreur(r)) setErreur(r.erreur)
  }
  return (
    <div className="page-interne">
      <h1>Amis</h1>
      {!recuperation ? (
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
          <button
            className="lien-discret"
            onClick={() => {
              setErreur(null)
              setRecuperation(true)
            }}
          >
            J’ai déjà un profil sur un autre PC
          </button>
        </section>
      ) : (
        <section className="bloc verre-fort creation-profil">
          <h2>Retrouver mon profil</h2>
          <p className="discret">
            Tape le code de secours affiché sur ton autre PC (page Amis › « Code de secours ») : tu retrouves ton pseudo, tes amis, tes groupes et vos messages.
          </p>
          <form
            className="ligne-formulaire"
            onSubmit={(e) => {
              e.preventDefault()
              if (code.trim() && !envoi) void recuperer()
            }}
          >
            <input
              className="champ code-secours-champ"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="XXXXX-XXXXX-XXXXX-…"
              autoFocus
              spellCheck={false}
              maxLength={120}
            />
            <button className="bouton-principal" disabled={!code.trim() || envoi}>
              {envoi ? 'Vérification…' : 'Retrouver'}
            </button>
          </form>
          {erreur && <p className="message-erreur">{erreur}</p>}
          <button
            className="lien-discret"
            onClick={() => {
              setErreur(null)
              setRecuperation(false)
            }}
          >
            Créer un nouveau profil à la place
          </button>
        </section>
      )}
    </div>
  )
}

/** Code de secours : affiché seulement à la demande, avec copie et enregistrement dans un fichier. */
function CodeSecours({ fermer }: { fermer: () => void }): React.JSX.Element {
  const [code, setCode] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  useEffect(() => {
    void window.se7en.social.codeSecours().then(setCode)
  }, [])
  return (
    <section className="bloc verre-fort code-secours">
      <h2>Code de secours</h2>
      <p className="discret">
        Il permet de retrouver ton profil, tes amis et tes messages sur un autre PC (ou après avoir réinstallé Windows). Garde-le pour toi :
        quiconque l’a peut utiliser ton profil.
      </p>
      <code className="code-secours-texte">{code ?? '…'}</code>
      <div className="actions-profil">
        <button
          className="bouton-verre"
          onClick={() => code && void navigator.clipboard.writeText(code).then(() => setInfo('Copié. Colle-le dans un endroit sûr (gestionnaire de mots de passe, papier…).'))}
        >
          Copier
        </button>
        <button className="bouton-verre" onClick={() => void window.se7en.social.enregistrerCode().then((ok) => ok && setInfo('Code enregistré dans le fichier choisi.'))}>
          Enregistrer dans un fichier
        </button>
        <button className="bouton-verre" onClick={fermer}>
          Masquer
        </button>
      </div>
      {info && <p className="message-ok">{info}</p>}
    </section>
  )
}

// ---------- profil, amis, groupes, demandes ----------

function EspaceAmis({ etat, profil, onglets }: { etat: EtatSocial; profil: ProfilSocial; onglets: EtatOnglets }): React.JSX.Element {
  const [amis, setAmis] = useState<Ami[]>([])
  const [groupes, setGroupes] = useState<GroupeSocial[]>([])
  const [ouvert, setOuvertEtat] = useState<CibleSocial | null>(conversationOuverte)
  const setOuvert = (c: CibleSocial | null): void => {
    conversationOuverte = c
    setOuvertEtat(c)
  }
  useEffect(() => {
    const f = (e: Event): void => setOuvertEtat((e as CustomEvent<CibleSocial>).detail)
    window.addEventListener('se7en-ouvrir-conversation', f)
    return () => window.removeEventListener('se7en-ouvrir-conversation', f)
  }, [])
  const [code, setCode] = useState('')
  const [info, setInfo] = useState<{ texte: string; erreur: boolean } | null>(null)
  const [copie, setCopie] = useState(false)
  const [pseudo, setPseudo] = useState<string | null>(null)
  const [versionPhoto, setVersionPhoto] = useState(0)
  const [voirCode, setVoirCode] = useState(false)
  const [nouveauGroupe, setNouveauGroupe] = useState<{ nom: string; membres: string[] } | null>(null)
  const ouvertRef = useRef(ouvert)
  ouvertRef.current = ouvert

  const charger = async (): Promise<void> => {
    const r = await window.se7en.social.amis()
    if (!estErreur(r)) setAmis(r)
  }
  const chargerGroupes = async (): Promise<void> => {
    const r = await window.se7en.social.groupes()
    if (!estErreur(r)) setGroupes(r)
  }
  useEffect(() => {
    void charger()
    void chargerGroupes()
  }, [etat.connexion])
  useEffect(
    () =>
      window.se7en.social.surEvenement((ev) => {
        if (ev.type === 'presence') setAmis((l) => l.map((a) => (a.id === ev.id ? { ...a, enLigne: ev.enLigne } : a)))
        else if (ev.type === 'statut') setAmis((l) => l.map((a) => (a.id === ev.id ? { ...a, humeur: ev.statut } : a)))
        else if (ev.type === 'amis') void charger()
        else if (ev.type === 'groupes') void chargerGroupes()
        else if (ev.type === 'message') {
          // un message dans la conversation ouverte est lu tout de suite ; sinon le compteur monte
          const m = ev.message
          const cible: CibleSocial = m.groupe ? { type: 'groupe', id: m.groupe } : { type: 'ami', id: m.de }
          if (memeCible(cible, ouvertRef.current)) return
          if (m.groupe) setGroupes((l) => l.map((g) => (g.id === m.groupe ? { ...g, nonLus: g.nonLus + 1 } : g)))
          else setAmis((l) => l.map((a) => (a.id === m.de ? { ...a, nonLus: a.nonLus + 1 } : a)))
        }
      }),
    []
  )

  const listeAmis = amis.filter((a) => a.statut === 'ami')
  const amiOuvert = ouvert?.type === 'ami' ? listeAmis.find((a) => a.id === ouvert.id) : undefined
  const groupeOuvert = ouvert?.type === 'groupe' ? groupes.find((g) => g.id === ouvert.id) : undefined
  const retour = (): void => {
    setOuvert(null)
    void charger()
    void chargerGroupes()
  }
  if (amiOuvert) return <Conversation cible={{ type: 'ami', id: amiOuvert.id }} ami={amiOuvert} amis={listeAmis} moi={profil} onglets={onglets} retour={retour} />
  if (groupeOuvert)
    return <Conversation cible={{ type: 'groupe', id: groupeOuvert.id }} groupe={groupeOuvert} amis={listeAmis} moi={profil} onglets={onglets} retour={retour} />

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
  const creerGroupe = async (): Promise<void> => {
    if (!nouveauGroupe) return
    const r = await window.se7en.social.creerGroupe(nouveauGroupe.nom.trim(), nouveauGroupe.membres)
    if (estErreur(r)) return setInfo({ texte: r.erreur, erreur: true })
    setNouveauGroupe(null)
    await chargerGroupes()
    setOuvert({ type: 'groupe', id: r.id })
  }
  const recues = amis.filter((a) => a.statut === 'recue')
  const envoyees = amis.filter((a) => a.statut === 'envoyee')
  const liste = [...listeAmis].sort((a, b) => Number(b.enLigne) - Number(a.enLigne) || b.nonLus - a.nonLus || a.pseudo.localeCompare(b.pseudo))

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
          <ChoixStatut statut={profil.humeur ?? null} />
          <div className="actions-profil">
            <button
              className="bouton-verre"
              onClick={() => {
                void navigator.clipboard.writeText(codeAmi(profil))
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
            <button className="bouton-verre" onClick={() => setVoirCode((v) => !v)} title="Pour retrouver ton profil sur un autre PC">
              Code de secours
            </button>
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

      {voirCode && <CodeSecours fermer={() => setVoirCode(false)} />}

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
          <button key={a.id} className="ligne-liste ligne-ami" onClick={() => setOuvert({ type: 'ami', id: a.id })}>
            <Avatar profil={a} enLigne={a.enLigne} />
            <span className="nom-ami">
              <strong>{a.pseudo}</strong>
              <span className="discret"> {texteStatut(a.humeur) || (a.enLigne ? 'en ligne' : '')}</span>
            </span>
            {a.nonLus > 0 && <span className="pastille-non-lus">{a.nonLus}</span>}
          </button>
        ))}
      </section>

      <section className="bloc verre-fort">
        <div className="entete-section">
          <h2>Groupes</h2>
          {!nouveauGroupe && listeAmis.length > 0 && (
            <button className="bouton-verre petit" onClick={() => setNouveauGroupe({ nom: '', membres: [] })}>
              Créer un groupe
            </button>
          )}
        </div>
        {nouveauGroupe && (
          <form
            className="nouveau-groupe"
            onSubmit={(e) => {
              e.preventDefault()
              void creerGroupe()
            }}
          >
            <input
              className="champ"
              value={nouveauGroupe.nom}
              onChange={(e) => setNouveauGroupe({ ...nouveauGroupe, nom: e.target.value })}
              placeholder="Nom du groupe"
              maxLength={40}
              autoFocus
            />
            <div className="choix-membres">
              {listeAmis.map((a) => {
                const coche = nouveauGroupe.membres.includes(a.id)
                return (
                  <label key={a.id} className={`membre-a-cocher${coche ? ' coche' : ''}`}>
                    <input
                      type="checkbox"
                      checked={coche}
                      disabled={!coche && nouveauGroupe.membres.length >= MAX_MEMBRES_GROUPE - 1}
                      onChange={() =>
                        setNouveauGroupe({ ...nouveauGroupe, membres: coche ? nouveauGroupe.membres.filter((x) => x !== a.id) : [...nouveauGroupe.membres, a.id] })
                      }
                    />
                    <Avatar profil={a} taille={24} />
                    {a.pseudo}
                  </label>
                )
              })}
            </div>
            <div className="actions-profil">
              <button className="bouton-principal petit" disabled={!nouveauGroupe.nom.trim() || !nouveauGroupe.membres.length}>
                Créer
              </button>
              <button type="button" className="bouton-verre" onClick={() => setNouveauGroupe(null)}>
                Annuler
              </button>
            </div>
          </form>
        )}
        {groupes.length === 0 && !nouveauGroupe && (
          <p className="discret">{listeAmis.length ? 'Discute à plusieurs : crée un groupe avec quelques amis.' : 'Ajoute d’abord des amis pour créer un groupe.'}</p>
        )}
        {groupes.map((g) => (
          <button key={g.id} className="ligne-liste ligne-ami" onClick={() => setOuvert({ type: 'groupe', id: g.id })}>
            <AvatarGroupe groupe={g} moi={profil.id} />
            <span className="nom-ami">
              <strong>{g.nom}</strong>
              <span className="discret"> {g.membres.length} membres</span>
            </span>
            {g.nonLus > 0 && <span className="pastille-non-lus">{g.nonLus}</span>}
          </button>
        ))}
      </section>
    </div>
  )
}

// ---------- conversation (ami ou groupe) ----------

function heure(date: number): string {
  const d = new Date(date)
  const auj = new Date().toDateString() === d.toDateString()
  return auj ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** Image d'un message : chargée à la demande ; clic pour l'agrandir. */
function ImageMessage({ id, agrandir }: { id: string; agrandir: (src: string) => void }): React.JSX.Element {
  const [src, setSrc] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    let vivant = true
    void window.se7en.social.image(id).then((s) => vivant && setSrc(s))
    return () => {
      vivant = false
    }
  }, [id])
  if (src === undefined) return <span className="image-message chargement" />
  if (!src) return <span className="discret">Image indisponible</span>
  return (
    <button className="image-message" onClick={() => agrandir(src)} title="Agrandir">
      <img src={src} alt="Image envoyée" draggable={false} />
    </button>
  )
}

/** « Sami écrit… », « Sami et Lina écrivent… ». */
function texteEcrit(noms: string[]): string {
  if (noms.length === 1) return `${noms[0]} écrit…`
  if (noms.length === 2) return `${noms[0]} et ${noms[1]} écrivent…`
  return `${noms.length} personnes écrivent…`
}

interface PropsConversation {
  cible: CibleSocial
  ami?: Ami
  groupe?: GroupeSocial
  amis: Ami[]
  moi: ProfilSocial
  onglets: EtatOnglets
  retour: () => void
  /** Petite fenêtre de discussion (au-dessus de la page) : en-tête réduit, « ouvrir en grand » à la place des réglages. */
  mini?: { agrandir: () => void }
}

type ChoixOnglet = 'lien' | 'capture' | 'ensemble' | null

export function Conversation({ cible, ami, groupe, amis, moi, onglets, retour, mini }: PropsConversation): React.JSX.Element {
  const [messages, setMessages] = useState<MessageSocial[]>([])
  const [plusAnciens, setPlusAnciens] = useState(false)
  const [texte, setTexte] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [choixOnglet, setChoixOnglet] = useState<ChoixOnglet>(null)
  const [menuImage, setMenuImage] = useState(false)
  const [avecResume, setAvecResume] = useState(true)
  const [envoi, setEnvoi] = useState<string | null>(null)
  const [ecrivent, setEcrivent] = useState<Record<string, number>>({})
  const [agrandie, setAgrandie] = useState<string | null>(null)
  const [enregistrement, setEnregistrement] = useState<number | null>(null)
  const micro = useRef<{ mr: MediaRecorder; morceaux: Blob[]; annule: boolean; minuteur: ReturnType<typeof setTimeout> } | null>(null)
  const [maintenant, setMaintenant] = useState(Date.now())
  useEffect(() => {
    if (enregistrement === null) return
    const t = setInterval(() => setMaintenant(Date.now()), 250)
    return () => clearInterval(t)
  }, [enregistrement])
  // la conversation se ferme pendant un enregistrement : il est abandonné
  useEffect(() => () => arreterMicro(true), [])

  /** Enregistre au micro (seulement après le clic, et le micro est relâché dès la fin). */
  const demarrerMicro = async (): Promise<void> => {
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      const mr = new MediaRecorder(flux, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 32_000 })
      const etat = { mr, morceaux: [] as Blob[], annule: false, minuteur: setTimeout(() => arreterMicro(false), MAX_VOCAL_SECONDES * 1000) }
      micro.current = etat
      mr.ondataavailable = (e) => e.data.size && etat.morceaux.push(e.data)
      mr.onstop = async () => {
        flux.getTracks().forEach((t) => t.stop())
        clearTimeout(etat.minuteur)
        setEnregistrement(null)
        if (etat.annule) return
        const son = new Uint8Array(await new Blob(etat.morceaux, { type: 'audio/webm' }).arrayBuffer())
        setEnvoi('Envoi du message vocal…')
        ajouter(await window.se7en.social.envoyerVocal(cible, son, 'audio/webm'))
        setEnvoi(null)
      }
      mr.start(250)
      setEnregistrement(Date.now())
    } catch {
      setErreur('Impossible d’utiliser le micro (aucun micro, ou il est refusé dans Windows).')
    }
  }
  function arreterMicro(annuler: boolean): void {
    const m = micro.current
    if (!m) return
    micro.current = null
    m.annule = annuler
    if (m.mr.state !== 'inactive') m.mr.stop()
  }
  const [ajoutMembre, setAjoutMembre] = useState(false)
  const fil = useRef<HTMLDivElement>(null)
  const enBas = useRef(true)
  const dernierEcrit = useRef(0)

  const membres = new Map<string, ProfilSocial>((groupe?.membres ?? []).map((m) => [m.id, m]))
  const nom = (id: string): string => membres.get(id)?.pseudo ?? amis.find((a) => a.id === id)?.pseudo ?? ami?.pseudo ?? '?'
  const concerne = (m: MessageSocial): boolean => (cible.type === 'groupe' ? m.groupe === cible.id : !m.groupe && m.de === cible.id)

  useEffect(() => {
    void window.se7en.social.messages(cible).then((r) => {
      if (estErreur(r)) return setErreur(r.erreur)
      setMessages(r)
      setPlusAnciens(r.length === 50)
    })
    window.se7en.social.lu(cible)
    return window.se7en.social.surEvenement((ev) => {
      if (ev.type === 'message' && concerne(ev.message)) {
        setMessages((l) => (l.some((m) => m.id === ev.message.id) ? l : [...l, ev.message]))
        // celui qui écrivait vient d'envoyer
        setEcrivent((e) => {
          const { [ev.message.de]: _, ...reste } = e
          return reste
        })
        window.se7en.social.lu(cible)
      } else if (ev.type === 'lu' && cible.type === 'ami' && ev.id === cible.id) {
        setMessages((l) => l.map((m) => (m.de === moi.id ? { ...m, lu: 1 } : m)))
      } else if (ev.type === 'ecrit' && (cible.type === 'groupe' ? ev.groupe === cible.id : !ev.groupe && ev.id === cible.id)) {
        setEcrivent((e) => ({ ...e, [ev.id]: Date.now() }))
      }
    })
  }, [cible.type, cible.id])

  // « écrit… » s'efface 5 s après le dernier signal
  useEffect(() => {
    if (!Object.keys(ecrivent).length) return
    const t = setInterval(() => {
      const limite = Date.now() - 5000
      setEcrivent((e) => Object.fromEntries(Object.entries(e).filter(([, d]) => d > limite)))
    }, 1000)
    return () => clearInterval(t)
  }, [ecrivent])

  // reste collé en bas quand un message arrive (sauf si on lit plus haut)
  useEffect(() => {
    const el = fil.current
    if (el && enBas.current) el.scrollTop = el.scrollHeight
  }, [messages, ecrivent])

  const ajouter = (r: MessageSocial | { erreur: string } | null): void => {
    if (!r) return
    if (estErreur(r)) return setErreur(r.erreur)
    setErreur(null)
    enBas.current = true
    setMessages((l) => (l.some((m) => m.id === r.id) ? l : [...l, r]))
  }
  const envoyer = async (): Promise<void> => {
    const t = texte.trim()
    if (!t) return
    setTexte('')
    ajouter(await window.se7en.social.envoyer(cible, t))
  }
  const envoyerImage = async (source: Parameters<typeof window.se7en.social.envoyerImage>[1]): Promise<void> => {
    setMenuImage(false)
    setEnvoi('Envoi de l’image…')
    ajouter(await window.se7en.social.envoyerImage(cible, source))
    setEnvoi(null)
  }
  const anciens = async (): Promise<void> => {
    const r = await window.se7en.social.messages(cible, messages[0]?.date)
    if (estErreur(r)) return setErreur(r.erreur)
    enBas.current = false
    setMessages((l) => [...r, ...l])
    setPlusAnciens(r.length === 50)
  }
  const choisirOnglet = async (id: number): Promise<void> => {
    const mode = choixOnglet
    setChoixOnglet(null)
    if (mode === 'capture') return envoyerImage({ type: 'capture', idOnglet: id })
    if (mode === 'ensemble' && ami) {
      const r = await window.se7en.ensemble.inviter(ami.id, id)
      if (estErreur(r)) return setErreur(r.erreur)
      return setInfo(`Invitation envoyée à ${ami.pseudo}. Dès qu’il accepte, il voit ce que tu vois dans cet onglet.`)
    }
    setEnvoi(avecResume ? 'L’IA résume la page…' : 'Envoi…')
    ajouter(await window.se7en.social.envoyerOnglet(cible, id, avecResume))
    setEnvoi(null)
  }
  const pagesWeb = onglets.onglets.filter((o) => estAdresseAutorisee(o.url))
  const derniereDeMoi = [...messages].reverse().find((m) => m.de === moi.id)
  const nomsEcrivent = Object.keys(ecrivent).map(nom)
  const titre = ami?.pseudo ?? groupe?.nom ?? ''
  const amisHorsGroupe = groupe ? amis.filter((a) => !membres.has(a.id)) : []

  return (
    <div className={`page-interne page-conversation${mini ? ' mini' : ''}`}>
      <div className="entete-conversation">
        {!mini && (
          <button className="bouton-icone" title="Retour" onClick={retour}>
            <IconePrecedent />
          </button>
        )}
        {ami ? <Avatar profil={ami} taille={40} enLigne={ami.enLigne} /> : groupe && <AvatarGroupe groupe={groupe} moi={moi.id} taille={40} />}
        <div className="infos-profil">
          <strong className="pseudo">{titre}</strong>
          <span className="discret">
            {nomsEcrivent.length
              ? texteEcrit(nomsEcrivent)
              : ami
                ? texteStatut(ami.humeur) || (ami.enLigne ? 'En ligne' : 'Hors ligne')
                : groupe?.membres.map((m) => (m.id === moi.id ? 'toi' : m.pseudo)).join(', ')}
          </span>
        </div>
        {ami && (
          <button className="bouton-verre" onClick={() => setChoixOnglet((v) => (v === 'ensemble' ? null : 'ensemble'))} title="Partager un onglet en direct">
            <IconeEnsemble /> {mini ? '' : 'Naviguer ensemble'}
          </button>
        )}
        {mini && (
          <>
            <span className="espace" />
            <button className="bouton-icone" title="Ouvrir en grand (page Amis)" onClick={mini.agrandir}>
              ⤢
            </button>
            <button className="bouton-icone" title="Fermer" onClick={retour}>
              <IconeCroix />
            </button>
          </>
        )}
        {!mini && groupe && amisHorsGroupe.length > 0 && (
          <button className="bouton-verre" onClick={() => setAjoutMembre((v) => !v)}>
            Ajouter
          </button>
        )}
        {!mini && groupe && (
          <button
            className="bouton-verre"
            onClick={async () => {
              const n = prompt('Nouveau nom du groupe', groupe.nom)?.trim()
              if (!n || n === groupe.nom) return
              const r = await window.se7en.social.renommerGroupe(groupe.id, n)
              if (estErreur(r)) setErreur(r.erreur)
            }}
          >
            Renommer
          </button>
        )}
        {!mini && <button
          className="bouton-verre retirer-ami"
          onClick={async () => {
            if (ami) {
              if (!confirm(`Retirer ${ami.pseudo} de tes amis ? Vos messages seront effacés.`)) return
              await window.se7en.social.retirer(ami.id)
            } else if (groupe) {
              if (!confirm(`Quitter le groupe « ${groupe.nom} » ? Tu ne recevras plus ses messages.`)) return
              await window.se7en.social.quitterGroupe(groupe.id)
            }
            retour()
          }}
        >
          {ami ? 'Retirer' : 'Quitter'}
        </button>}
      </div>

      {ajoutMembre && groupe && (
        <div className="choix-onglet verre-fort">
          {amisHorsGroupe.map((a) => (
            <button
              key={a.id}
              className="ligne-liste"
              onClick={async () => {
                setAjoutMembre(false)
                const r = await window.se7en.social.ajouterMembre(groupe.id, a.id)
                if (estErreur(r)) setErreur(r.erreur)
              }}
            >
              <Avatar profil={a} taille={28} />
              <span className="nom-ami">Ajouter {a.pseudo}</span>
            </button>
          ))}
        </div>
      )}

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
        {messages.length === 0 && <p className="vide">Envoie ton premier message, une image ou un onglet {ami ? `à ${ami.pseudo}` : 'au groupe'}.</p>}
        {messages.map((m, i) => {
          const deMoi = m.de === moi.id
          // dans un groupe, le nom de l'auteur au-dessus de sa première bulle d'affilée
          const auteur = groupe && !deMoi && messages[i - 1]?.de !== m.de ? membres.get(m.de) : undefined
          return (
            <div key={m.id} className={`ligne-bulle${deMoi ? ' de-moi' : ''}`}>
              {auteur && (
                <span className="auteur-bulle">
                  <Avatar profil={auteur} taille={18} /> {auteur.pseudo}
                </span>
              )}
              <div className={`bulle-ami${deMoi ? ' de-moi' : ''}${m.image ? ' avec-image' : ''}`}>
                {m.image && <ImageMessage id={m.image} agrandir={setAgrandie} />}
                {m.vocal && <MessageVocal id={m.vocal} deMoi={deMoi} />}
                {m.url && estAdresseAutorisee(m.url) ? (
                  <button className="carte-lien" onClick={() => window.se7en.social.ouvrirLien(m.url!)} title={m.url}>
                    <IconeGlobe />
                    <span>
                      <strong>{m.titre || adresseLisible(m.url)}</strong>
                      <span className="discret">{new URL(m.url).hostname}</span>
                    </span>
                  </button>
                ) : null}
                {m.texte && (lireSkillPartagee(m.texte) ? <CarteSkillRecue skill={lireSkillPartagee(m.texte)!} deMoi={deMoi} /> : <p>{m.texte}</p>)}
                <time>{heure(m.date)}</time>
              </div>
              {ami && m === derniereDeMoi && m.lu === 1 && <span className="vu">Vu</span>}
            </div>
          )
        })}
        {nomsEcrivent.length > 0 && (
          <div className="ecrit-en-cours" aria-live="polite">
            <span className="points-ecrit">
              <i />
              <i />
              <i />
            </span>
            {texteEcrit(nomsEcrivent)}
          </div>
        )}
      </div>

      {erreur && <p className="message-erreur">{erreur}</p>}
      {info && <p className="message-ok">{info}</p>}
      {envoi && <p className="discret attente">{envoi}</p>}
      {choixOnglet && (
        <div className="choix-onglet verre-fort">
          {choixOnglet === 'lien' && (
            <label className="option-resume">
              <input type="checkbox" checked={avecResume} onChange={(e) => setAvecResume(e.target.checked)} />
              Ajouter un résumé de la page par l’IA (2 phrases)
            </label>
          )}
          {choixOnglet === 'capture' && <p className="discret petit">Quel onglet capturer ? L’image de la page est envoyée telle qu’elle s’affiche.</p>}
          {choixOnglet === 'ensemble' && (
            <p className="discret petit">
              Quel onglet partager ? {ami?.pseudo} verra la même page que toi et suivra quand tu navigues ou fais défiler. Seule l’adresse de la page voyage :
              sur un site où tu es connecté, il voit sa propre version.
            </p>
          )}
          {pagesWeb.length === 0 && <p className="discret">Aucune page web ouverte.</p>}
          {pagesWeb.map((o) => (
            <button key={o.id} className="ligne-liste" onClick={() => void choisirOnglet(o.id)}>
              {o.favicon ? <img className="favicon" src={o.favicon} alt="" /> : <IconeGlobe />}
              <span className="nom-ami">{o.titre || adresseLisible(o.url)}</span>
            </button>
          ))}
        </div>
      )}
      {menuImage && (
        <div className="menu-image verre-fort">
          <button className="ligne-liste" onClick={() => void envoyerImage({ type: 'fichier' })}>
            <IconeImage />
            <span className="nom-ami">Une image du PC…</span>
          </button>
          <button
            className="ligne-liste"
            onClick={() => {
              setMenuImage(false)
              setChoixOnglet('capture')
            }}
          >
            <IconeGlobe />
            <span className="nom-ami">Une capture d’un onglet…</span>
          </button>
          <p className="discret petit">Astuce : tu peux aussi coller une image (Ctrl+V) dans le champ du message.</p>
        </div>
      )}
      <form
        className="saisie-message verre-fort"
        onSubmit={(e) => {
          e.preventDefault()
          void envoyer()
        }}
      >
        <button type="button" className="bouton-icone" onClick={() => setMenuImage((v) => !v)} title="Envoyer une image ou une capture">
          <IconeImage />
        </button>
        {enregistrement !== null ? (
          <div className="enregistrement-vocal">
            <span className="point-rouge" />
            <span>{Math.floor((maintenant - enregistrement) / 1000)} s</span>
            <button type="button" className="bouton-verre petit" onClick={() => arreterMicro(true)}>
              Annuler
            </button>
            <button type="button" className="bouton-principal petit" onClick={() => arreterMicro(false)}>
              Envoyer
            </button>
          </div>
        ) : (
          <button type="button" className="bouton-icone" onClick={() => void demarrerMicro()} title={`Message vocal (${MAX_VOCAL_SECONDES} s au plus)`}>
            <IconeMicro />
          </button>
        )}
        <button type="button" className="bouton-verre" onClick={() => setChoixOnglet((v) => (v === 'lien' ? null : 'lien'))} title="Envoyer un de tes onglets">
          Envoyer un onglet
        </button>
        <textarea
          value={texte}
          onChange={(e) => {
            setTexte(e.target.value)
            // « est en train d'écrire » : un signal toutes les 3 secondes au plus pendant la frappe
            if (e.target.value && Date.now() - dernierEcrit.current > 3000) {
              dernierEcrit.current = Date.now()
              window.se7en.social.ecrit(cible)
            }
          }}
          onPaste={(e) => {
            const fichier = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'))
            if (!fichier) return
            e.preventDefault()
            const lecteur = new FileReader()
            lecteur.onload = () => typeof lecteur.result === 'string' && void envoyerImage({ type: 'collee', donnees: lecteur.result })
            lecteur.readAsDataURL(fichier)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void envoyer()
            }
          }}
          placeholder={ami ? `Message à ${ami.pseudo}` : `Message au groupe ${groupe?.nom ?? ''}`}
          maxLength={MAX_MESSAGE}
          rows={1}
          autoFocus
        />
        <button className="bouton-principal petit" disabled={!texte.trim()}>
          Envoyer
        </button>
      </form>

      {agrandie && (
        <div className="visionneuse-image" onClick={() => setAgrandie(null)} role="dialog" aria-label="Image agrandie">
          <img src={agrandie} alt="" />
          <button className="bouton-icone" title="Fermer" onClick={() => setAgrandie(null)}>
            <IconeCroix />
          </button>
        </div>
      )}
    </div>
  )
}

/** Message vocal : bouton lecture, barre d'avancement, durée. Le son n'est chargé qu'au premier clic. */
function MessageVocal({ id, deMoi }: { id: string; deMoi: boolean }): React.JSX.Element {
  const audio = useRef<HTMLAudioElement | null>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [lecture, setLecture] = useState(false)
  const [temps, setTemps] = useState({ t: 0, d: 0 })
  const lire = async (): Promise<void> => {
    if (!src) {
      const s = await window.se7en.social.image(id)
      if (!s) return
      setSrc(s)
      return
    }
    if (audio.current?.paused) void audio.current.play()
    else audio.current?.pause()
  }
  useEffect(() => {
    if (src && audio.current) void audio.current.play()
  }, [src])
  const fmt = (x: number): string => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`
  return (
    <div className={`message-vocal${deMoi ? ' de-moi' : ''}`}>
      <button className="bouton-lecture" onClick={() => void lire()} title={lecture ? 'Pause' : 'Écouter'}>
        {lecture ? '❚❚' : '▶'}
      </button>
      <div className="onde">
        <div style={{ width: `${temps.d ? (100 * temps.t) / temps.d : 0}%` }} />
      </div>
      <span className="duree">{fmt(lecture || temps.t ? temps.t : temps.d)}</span>
      {src && (
        <audio
          ref={audio}
          src={src}
          onPlay={() => setLecture(true)}
          onPause={() => setLecture(false)}
          onEnded={() => {
            setLecture(false)
            setTemps((x) => ({ ...x, t: 0 }))
          }}
          onLoadedMetadata={(e) => {
            const a = e.currentTarget
            if (Number.isFinite(a.duration)) setTemps({ t: 0, d: a.duration })
          }}
          onTimeUpdate={(e) => {
            const a = e.currentTarget
            setTemps((x) => ({ t: a.currentTime, d: Number.isFinite(a.duration) ? a.duration : Math.max(x.d, a.currentTime) }))
          }}
        />
      )}
    </div>
  )
}

/** Statut visible par les amis : disponible, ne pas déranger (plus de notifications), en train de jouer à…, absent. */
function ChoixStatut({ statut }: { statut: StatutSocial | null }): React.JSX.Element {
  const [type, setType] = useState<StatutSocial['type'] | 'dispo'>(statut?.type ?? 'dispo')
  const [texte, setTexte] = useState(statut?.texte ?? '')
  useEffect(() => {
    setType(statut?.type ?? 'dispo')
    setTexte(statut?.texte ?? '')
  }, [statut?.type, statut?.texte])
  const enregistrer = (t: typeof type, x: string): void => {
    void window.se7en.social.statut(t === 'dispo' ? null : { type: t, texte: x.trim() })
  }
  return (
    <div className="choix-statut">
      <select
        className="champ"
        value={type}
        onChange={(e) => {
          const t = e.target.value as typeof type
          setType(t)
          enregistrer(t, t === 'dispo' ? '' : texte)
        }}
      >
        <option value="dispo">🟢 Disponible</option>
        <option value="jeu">🎮 En train de jouer à…</option>
        <option value="occupe">⛔ Ne pas déranger</option>
        <option value="absent">🌙 Absent</option>
      </select>
      {type !== 'dispo' && (
        <input
          className="champ"
          value={texte}
          maxLength={60}
          placeholder={type === 'jeu' ? 'Nom du jeu' : 'Un petit mot (facultatif)'}
          onChange={(e) => setTexte(e.target.value)}
          onBlur={() => enregistrer(type, texte)}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
        />
      )}
      {type === 'occupe' && <span className="discret petit">Plus de notification de message tant que ce statut est actif.</span>}
    </div>
  )
}
