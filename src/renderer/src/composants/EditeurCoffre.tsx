/* Paramètres › Coffre personnel : les informations utilisées pour remplir les formulaires PDF.
 * Chiffrées avec le compte Windows, gardées uniquement sur ce PC, jamais envoyées à l'IA. */
import { useEffect, useState } from 'react'
import { CHAMPS_COFFRE, COFFRE_VIDE, type Coffre } from '../../../shared/coffre'
import { IconeCorbeille, IconePlus } from './Icones'

export function EditeurCoffre(): React.JSX.Element {
  const [coffre, setCoffre] = useState<Coffre>(COFFRE_VIDE)
  const [disponible, setDisponible] = useState(true)
  const [modifie, setModifie] = useState(false)
  const [visibles, setVisibles] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    window.se7en.coffre.lire().then((e) => {
      if (!e) return
      setCoffre(e.coffre)
      setDisponible(e.disponible)
    })
  }, [])

  const changer = (c: Coffre): void => {
    setCoffre(c)
    setModifie(true)
    setMessage(null)
  }
  const sauver = async (c: Coffre): Promise<void> => {
    const r = await window.se7en.coffre.sauver(c)
    if ('erreur' in r) return setMessage(r.erreur)
    setCoffre(r.coffre)
    setModifie(false)
    setMessage('Coffre enregistré et chiffré.')
  }

  return (
    <section className="bloc verre-fort">
      <h2>Coffre personnel</h2>
      <p className="discret">
        Tes informations pour remplir les formulaires PDF. Elles sont chiffrées avec ton compte Windows et restent sur ce PC. L'IA ne les voit jamais : elle sait seulement
        quels champs existent (« prénom », « date de naissance »…).
      </p>
      {!disponible && <div className="message-erreur">Windows ne permet pas de chiffrer sur ce compte : le coffre ne peut pas être enregistré.</div>}

      <div className="grille-coffre">
        {CHAMPS_COFFRE.map((d) => {
          const masque = d.sensible && !visibles.has(d.cle)
          return (
            <label key={d.cle} className="champ-coffre">
              <span>{d.libelle}</span>
              <span className="avec-oeil">
                <input
                  className="champ"
                  type={masque ? 'password' : 'text'}
                  value={coffre.valeurs[d.cle] ?? ''}
                  placeholder={d.exemple}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => changer({ ...coffre, valeurs: { ...coffre.valeurs, [d.cle]: e.target.value } })}
                />
                {d.sensible && (
                  <button
                    type="button"
                    className="oeil"
                    title={masque ? 'Afficher' : 'Masquer'}
                    onClick={() => setVisibles((v) => (v.has(d.cle) ? new Set([...v].filter((x) => x !== d.cle)) : new Set([...v, d.cle])))}
                  >
                    {masque ? 'Afficher' : 'Masquer'}
                  </button>
                )}
              </span>
            </label>
          )
        })}
      </div>

      {coffre.perso.length > 0 && <h3 className="sous-titre">Mes champs</h3>}
      {coffre.perso.map((p, i) => (
        <div key={p.id} className="ligne-perso">
          <input
            className="champ"
            value={p.libelle}
            placeholder="Nom du champ (ex. Numéro fiscal)"
            onChange={(e) => changer({ ...coffre, perso: coffre.perso.map((x, j) => (j === i ? { ...x, libelle: e.target.value } : x)) })}
          />
          <input
            className="champ"
            value={p.valeur}
            placeholder="Valeur"
            autoComplete="off"
            onChange={(e) => changer({ ...coffre, perso: coffre.perso.map((x, j) => (j === i ? { ...x, valeur: e.target.value } : x)) })}
          />
          <button className="bouton-icone" title="Supprimer" onClick={() => changer({ ...coffre, perso: coffre.perso.filter((_, j) => j !== i) })}>
            <IconeCorbeille />
          </button>
        </div>
      ))}

      <div className="ligne-reglage">
        <button className="bouton-verre" onClick={() => changer({ ...coffre, perso: [...coffre.perso, { id: `p${Date.now()}`, libelle: '', valeur: '' }] })}>
          <IconePlus /> Ajouter un champ
        </button>
        <span className="espace" />
        {message && <span className="discret">{message}</span>}
        <button
          className="bouton-verre"
          onClick={() => {
            if (confirm('Effacer toutes les informations du coffre ?')) void sauver(COFFRE_VIDE)
          }}
        >
          Tout effacer
        </button>
        <button className="bouton-principal" disabled={!modifie || !disponible} onClick={() => void sauver(coffre)}>
          Enregistrer
        </button>
      </div>
    </section>
  )
}
