/* Skills partagées entre amis : la carte d'une Skill reçue dans une conversation, et le choix de l'ami à qui en envoyer une. */
import { useEffect, useState } from 'react'
import { ajouterSkillRecue, commandeDepuis, MAX_CONSIGNE_PARTAGEE, texteSkillPartagee, type Skill } from '../../../shared/chat'
import type { Ami } from '../../../shared/social'

/** Skill reçue : on voit la consigne en entier avant de l'ajouter (c'est du texte venu de quelqu'un d'autre). */
export function CarteSkillRecue({ skill, deMoi }: { skill: Omit<Skill, 'id'>; deMoi: boolean }): React.JSX.Element {
  const [etat, setEtat] = useState<null | { commande: string; deja: boolean }>(null)
  const ajouter = async (): Promise<void> => {
    const liste = await window.se7en.skills.lire()
    const r = ajouterSkillRecue(liste, skill, `skill-${Date.now()}`)
    if (!r.deja) await window.se7en.skills.sauver(r.liste)
    setEtat({ commande: r.commande, deja: r.deja })
  }
  return (
    <div className="carte-skill">
      <span className="etiquette-skill">✦ Skill</span>
      <strong>{skill.titre}</strong>
      <code>/{skill.commande}</code>
      <p className="consigne-skill">{skill.consigne}</p>
      {!deMoi &&
        (etat ? (
          <span className="message-ok petit">{etat.deja ? `Tu l'as déjà : /${etat.commande}` : `Ajoutée : tape /${etat.commande} dans le panneau IA`}</span>
        ) : (
          <button className="bouton-verre petit" onClick={() => void ajouter()}>
            Ajouter à mes Skills
          </button>
        ))}
    </div>
  )
}

/** Petite liste des amis pour envoyer une Skill ; se ferme après l'envoi. */
export function EnvoyerSkill({ skill, fermer }: { skill: Skill; fermer: () => void }): React.JSX.Element {
  const [amis, setAmis] = useState<Ami[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoyeA, setEnvoyeA] = useState<string | null>(null)
  useEffect(() => {
    void window.se7en.social.amis().then((r) => {
      if ('erreur' in r) setErreur(r.erreur)
      else setAmis(r.filter((a) => a.statut === 'ami'))
    })
  }, [])
  const envoyer = async (a: Ami): Promise<void> => {
    const r = await window.se7en.social.envoyer({ type: 'ami', id: a.id }, texteSkillPartagee(skill))
    if ('erreur' in r) setErreur(r.erreur)
    else setEnvoyeA(a.pseudo)
  }
  return (
    <div className="envoi-skill">
      {erreur && <p className="message-erreur petit">{erreur} Crée ton profil dans Amis pour partager tes Skills.</p>}
      {envoyeA && <p className="message-ok petit">/{skill.commande} envoyée à {envoyeA}.</p>}
      {amis && amis.length === 0 && <p className="discret petit">Ajoute d'abord des amis (menu › Amis).</p>}
      {amis && amis.length > 0 && (
        <div className="liste-chips">
          {amis.map((a) => (
            <button key={a.id} className="chip" onClick={() => void envoyer(a)}>
              {a.pseudo}
            </button>
          ))}
        </div>
      )}
      <button className="lien-discret" onClick={fermer}>
        Fermer
      </button>
    </div>
  )
}

/** « Enregistrer comme Skill » sous une question du panneau IA. */
export function BoutonEnregistrerSkill({ texte }: { texte: string }): React.JSX.Element | null {
  const [faite, setFaite] = useState<string | null>(null)
  if (texte.trim().startsWith('/') || texte.length > MAX_CONSIGNE_PARTAGEE) return null
  if (faite) return <span className="skill-enregistree">Enregistrée : /{faite}</span>
  return (
    <button
      className="copier"
      onClick={async () => {
        const liste = await window.se7en.skills.lire()
        const titre = texte.replace(/\s+/g, ' ').trim()
        const r = ajouterSkillRecue(liste, { commande: commandeDepuis(texte), titre: titre.length > 60 ? `${titre.slice(0, 57)}…` : titre, consigne: texte.trim() }, `skill-${Date.now()}`)
        if (!r.deja) await window.se7en.skills.sauver(r.liste)
        setFaite(r.commande)
      }}
    >
      Enregistrer comme Skill
    </button>
  )
}
