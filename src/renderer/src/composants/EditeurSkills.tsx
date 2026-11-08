/* Paramètres › Skills : les consignes lancées avec /commande dans le panneau IA. On peut les modifier, en ajouter, en supprimer. */
import { useEffect, useState } from 'react'
import { RE_COMMANDE_SKILL, type Skill } from '../../../shared/chat'
import { IconeAmis, IconeCorbeille, IconePlus } from './Icones'
import { EnvoyerSkill } from './SkillPartagee'

export function EditeurSkills(): React.JSX.Element {
  const [skills, setSkills] = useState<Skill[]>([])
  const [modifiees, setModifiees] = useState(false)
  const [partage, setPartage] = useState<string | null>(null)
  useEffect(() => {
    window.se7en.skills.lire().then(setSkills)
  }, [])

  const changer = (i: number, partiel: Partial<Skill>): void => {
    setSkills((l) => l.map((s, j) => (j === i ? { ...s, ...partiel } : s)))
    setModifiees(true)
  }
  const commandes = skills.map((s) => s.commande)
  const invalide = skills.some((s, i) => !RE_COMMANDE_SKILL.test(s.commande) || commandes.indexOf(s.commande) !== i || !s.consigne.trim())

  return (
    <section className="bloc verre-fort">
      <h2>Skills</h2>
      <p className="discret">
        Dans le panneau IA, tape <kbd>/</kbd> puis le nom d'une Skill : sa consigne est envoyée avec la page. Exemple : <code>/resume en 3 lignes</code>. Le bouton
        Amis envoie une Skill à un ami, qui la voit en entier avant de l'ajouter.
      </p>
      {skills.map((s, i) => (
        <div key={s.id} className="ligne-skill">
          <div className="entete-skill">
            <span className="prefixe">/</span>
            <input
              className={`champ commande${RE_COMMANDE_SKILL.test(s.commande) && commandes.indexOf(s.commande) === i ? '' : ' invalide'}`}
              value={s.commande}
              onChange={(e) => changer(i, { commande: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
              aria-label="Commande"
            />
            <input className="champ" value={s.titre} onChange={(e) => changer(i, { titre: e.target.value })} aria-label="Nom" placeholder="Nom" />
            <button
              className="bouton-icone"
              title={modifiees ? "Enregistre d'abord tes changements" : 'Envoyer à un ami'}
              disabled={modifiees || !s.consigne.trim()}
              onClick={() => setPartage((p) => (p === s.id ? null : s.id))}
            >
              <IconeAmis />
            </button>
            <button
              className="bouton-icone"
              title="Supprimer"
              onClick={() => {
                setSkills((l) => l.filter((_, j) => j !== i))
                setModifiees(true)
              }}
            >
              <IconeCorbeille />
            </button>
          </div>
          <textarea className="champ consigne" rows={2} value={s.consigne} onChange={(e) => changer(i, { consigne: e.target.value })} placeholder="Consigne envoyée à l'IA" />
          {partage === s.id && <EnvoyerSkill skill={s} fermer={() => setPartage(null)} />}
        </div>
      ))}
      <div className="ligne-reglage">
        <button
          className="bouton-verre"
          onClick={() => {
            setSkills((l) => [...l, { id: `skill-${Date.now()}`, commande: `skill${l.length + 1}`, titre: 'Nouvelle Skill', consigne: '' }])
            setModifiees(true)
          }}
        >
          <IconePlus /> Ajouter une Skill
        </button>
        <span className="espace" />
        <button
          className="bouton-verre"
          onClick={async () => {
            setSkills(await window.se7en.skills.reinitialiser())
            setModifiees(false)
          }}
        >
          Remettre celles d'origine
        </button>
        <button
          className="bouton-principal"
          disabled={!modifiees || invalide}
          title={invalide ? 'Chaque commande doit être unique (lettres, chiffres, tirets) et avoir une consigne.' : undefined}
          onClick={async () => {
            setSkills(await window.se7en.skills.sauver(skills))
            setModifiees(false)
          }}
        >
          Enregistrer
        </button>
      </div>
    </section>
  )
}
