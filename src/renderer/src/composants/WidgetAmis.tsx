/* Widget « Amis » du Nouvel onglet : messages non lus (amis et groupes), qui est en ligne et à quoi il joue.
 * Mis à jour en direct ; un clic ouvre la conversation dans la petite fenêtre de discussion. */
import { useEffect, useState } from 'react'
import { RE_CODE_AMI } from '../../../shared/social'
import { texteStatut, type Ami, type CibleSocial, type EtatSocial, type GroupeSocial } from '../../../shared/social'
import { Avatar, AvatarGroupe } from './PageAmis'

const MAX_EN_LIGNE = 6

export function WidgetAmis(): React.JSX.Element | null {
  const [etat, setEtat] = useState<EtatSocial | null>(null)
  const [amis, setAmis] = useState<Ami[]>([])
  const [groupes, setGroupes] = useState<GroupeSocial[]>([])
  const [code, setCode] = useState('')
  const [info, setInfo] = useState<{ texte: string; erreur: boolean } | null>(null)

  useEffect(() => {
    const charger = (): void => {
      void window.se7en.social.amis().then((r) => Array.isArray(r) && setAmis(r))
      void window.se7en.social.groupes().then((r) => Array.isArray(r) && setGroupes(r))
    }
    void window.se7en.social.etat().then((e) => {
      setEtat(e)
      if (e.profil) charger()
    })
    const finEtat = window.se7en.social.surEtat((e) => {
      setEtat(e)
      if (e.connexion === 'connecte') charger()
    })
    const finEv = window.se7en.social.surEvenement((ev) => {
      if (ev.type === 'presence') setAmis((l) => l.map((a) => (a.id === ev.id ? { ...a, enLigne: ev.enLigne } : a)))
      else if (ev.type === 'statut') setAmis((l) => l.map((a) => (a.id === ev.id ? { ...a, humeur: ev.statut } : a)))
      else if (ev.type === 'amis' || ev.type === 'groupes') charger()
      else if (ev.type === 'message') {
        const m = ev.message
        if (m.groupe) setGroupes((l) => l.map((g) => (g.id === m.groupe ? { ...g, nonLus: g.nonLus + 1 } : g)))
        else setAmis((l) => l.map((a) => (a.id === m.de ? { ...a, nonLus: a.nonLus + 1 } : a)))
      }
    })
    return () => {
      finEtat()
      finEv()
    }
  }, [])

  if (!etat) return null
  if (etat.connexion === 'desactive')
    return (
      <div className="corps-widget">
        <div className="entete-widget">
          <strong>Amis</strong>
        </div>
        <p className="discret petit">Les fonctions sociales sont désactivées dans les Paramètres.</p>
      </div>
    )
  /** Une conversation s'ouvre dans la petite fenêtre de discussion ; sans conversation, la page Amis. */
  const ouvrir = (cible?: CibleSocial): void => {
    if (cible) return window.se7en.social.discussion(cible)
    window.se7en.onglets.interne('se7en://amis')
  }
  const ajouter = async (): Promise<void> => {
    const r = await window.se7en.social.ajouter(code.trim())
    if ('erreur' in r) return setInfo({ texte: r.erreur, erreur: true })
    setCode('')
    setInfo({ texte: r.statut === 'ami' ? 'Vous êtes maintenant amis !' : 'Demande envoyée.', erreur: false })
    setTimeout(() => setInfo(null), 4000)
  }
  const recues = amis.filter((a) => a.statut === 'recue')

  if (!etat.profil)
    return (
      <div className="corps-widget">
        <div className="entete-widget">
          <strong>Amis</strong>
        </div>
        <p className="discret petit">Crée ton profil pour discuter avec tes amis, voir qui est en ligne et à quoi ils jouent.</p>
        <button className="bouton-verre petit" onClick={() => ouvrir()}>
          Créer mon profil
        </button>
      </div>
    )

  const liste = amis.filter((a) => a.statut === 'ami')
  const nonLus = [
    ...liste.filter((a) => a.nonLus > 0).map((a) => ({ cle: a.id, cible: { type: 'ami', id: a.id } as CibleSocial, nom: a.pseudo, n: a.nonLus, avatar: <Avatar profil={a} taille={30} enLigne={a.enLigne} /> })),
    ...groupes.filter((g) => g.nonLus > 0).map((g) => ({ cle: g.id, cible: { type: 'groupe', id: g.id } as CibleSocial, nom: g.nom, n: g.nonLus, avatar: <AvatarGroupe groupe={g} moi={etat.profil!.id} taille={30} /> }))
  ].sort((a, b) => b.n - a.n)
  const total = nonLus.reduce((s, x) => s + x.n, 0)
  // en ligne d'abord ceux qui jouent, puis les autres ; les « ne pas déranger » à la fin
  const enLigne = liste
    .filter((a) => a.enLigne)
    .sort((a, b) => Number(b.humeur?.type === 'jeu') - Number(a.humeur?.type === 'jeu') || Number(a.humeur?.type === 'occupe') - Number(b.humeur?.type === 'occupe') || a.pseudo.localeCompare(b.pseudo))

  return (
    <div className="corps-widget">
      <div className="entete-widget">
        <strong>Amis</strong>
        {total > 0 && <span className="pastille-non-lus">{total}</span>}
        <span className="espace" />
        <button className="lien-discret" onClick={() => ouvrir()}>
          Tout voir
        </button>
      </div>

      {nonLus.length > 0 && (
        <div className="section-widget">
          <span className="titre-widget">Messages non lus</span>
          {nonLus.slice(0, 4).map((x) => (
            <button key={x.cle} className="ligne-widget" onClick={() => ouvrir(x.cible)}>
              {x.avatar}
              <span className="texte-ligne-widget">
                <strong>{x.nom}</strong>
                <span className="discret">
                  {x.n} nouveau{x.n > 1 ? 'x' : ''} message{x.n > 1 ? 's' : ''}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="section-widget">
        <span className="titre-widget">En ligne{enLigne.length ? ` · ${enLigne.length}` : ''}</span>
        {enLigne.length === 0 && <p className="discret petit">{liste.length ? 'Personne en ligne pour l’instant.' : 'Ajoute des amis avec leur code pour les voir ici.'}</p>}
        {enLigne.slice(0, MAX_EN_LIGNE).map((a) => (
          <button key={a.id} className="ligne-widget" onClick={() => ouvrir({ type: 'ami', id: a.id })} title={`Écrire à ${a.pseudo}`}>
            <Avatar profil={a} taille={30} enLigne />
            <span className="texte-ligne-widget">
              <strong>{a.pseudo}</strong>
              <span className={`discret${a.humeur?.type === 'jeu' ? ' joue' : ''}`}>{texteStatut(a.humeur) || 'En ligne'}</span>
            </span>
          </button>
        ))}
        {enLigne.length > MAX_EN_LIGNE && (
          <button className="lien-discret" onClick={() => ouvrir()}>
            et {enLigne.length - MAX_EN_LIGNE} autre{enLigne.length - MAX_EN_LIGNE > 1 ? 's' : ''}
          </button>
        )}
      </div>
      {recues.length > 0 && (
        <div className="section-widget">
          <span className="titre-widget">Demandes d’ami</span>
          {recues.map((a) => (
            <div key={a.id} className="ligne-widget statique">
              <Avatar profil={a} taille={30} />
              <span className="texte-ligne-widget">
                <strong>{a.pseudo}</strong>
                <span className="discret">veut être ton ami</span>
              </span>
              <span className="espace" />
              <button className="bouton-principal petit" onClick={() => void window.se7en.social.accepter(a.id).then(() => setAmis((l) => l.map((x) => (x.id === a.id ? { ...x, statut: 'ami' } : x))))}>
                Accepter
              </button>
            </div>
          ))}
        </div>
      )}

      <form
        className="ajout-ami-widget"
        onSubmit={(e) => {
          e.preventDefault()
          if (RE_CODE_AMI.test(code.trim())) void ajouter()
        }}
      >
        <input className="champ" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ajouter un ami : Pseudo#1234" maxLength={40} spellCheck={false} />
        <button className="bouton-verre petit" disabled={!RE_CODE_AMI.test(code.trim())}>
          Ajouter
        </button>
      </form>
      {info && <p className={`petit ${info.erreur ? 'message-erreur' : 'message-ok'}`}>{info.texte}</p>}
    </div>
  )
}
