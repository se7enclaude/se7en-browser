/* Page interne se7en://recherche : recherche approfondie en local, avec ses étapes, ses sources et son rapport. */
import { useEffect, useState } from 'react'
import { LIBELLES_ETAPES, type EtapeRecherche, type Recherche } from '../../../shared/recherche'
import { Markdown } from './Markdown'

const ORDRE: EtapeRecherche[] = ['plan', 'sources', 'lecture', 'notes', 'synthese', 'fini']
const ORIGINES = { onglet: 'Onglet', wikipedia: 'Wikipédia', web: 'Web', lien: 'Lien suivi' } as const

function useRecherches(): [Recherche[], () => void] {
  const [l, setL] = useState<Recherche[]>([])
  useEffect(() => {
    void window.se7en.recherche.lister().then(setL)
    return window.se7en.recherche.surChangement((r) =>
      setL((avant) => {
        const i = avant.findIndex((x) => x.id === r.id)
        return i < 0 ? [r, ...avant] : avant.map((x) => (x.id === r.id ? r : x))
      })
    )
  }, [])
  return [l, () => void window.se7en.recherche.lister().then(setL)]
}

function Etapes({ r }: { r: Recherche }): React.JSX.Element {
  const i = ORDRE.indexOf(r.etape)
  return (
    <ol className="etapes-recherche">
      {ORDRE.slice(0, 5).map((e, j) => (
        <li key={e} className={i > j || r.etape === 'fini' ? 'faite' : i === j ? 'active' : ''}>
          {LIBELLES_ETAPES[e]}
        </li>
      ))}
    </ol>
  )
}

function CleBrave(): React.JSX.Element {
  const [a, setA] = useState<boolean | null>(null)
  const [ouvert, setOuvert] = useState(false)
  const [cle, setCle] = useState('')
  useEffect(() => {
    void window.se7en.recherche.cle().then(setA)
  }, [])
  return (
    <div className="cle-recherche">
      <button className="lien-discret" onClick={() => setOuvert((o) => !o)}>
        {a ? '✓ Recherche sur tout le web activée (Brave Search)' : 'Chercher aussi sur tout le web (facultatif)'}
      </button>
      {ouvert && (
        <div className="detail-cle">
          <p className="discret petit">
            Sans clé, la recherche utilise tes onglets ouverts, Wikipédia et les liens qu'ils contiennent. Avec une clé gratuite de l'API officielle Brave Search, elle
            cherche aussi sur tout le web. Seules tes requêtes partent chez Brave ; les pages sont lues et le rapport est écrit sur ton PC. La clé est chiffrée avec ton compte
            Windows.
          </p>
          <div className="ligne-reglage">
            <input className="champ" type="password" placeholder={a ? 'Clé enregistrée' : 'Colle ta clé Brave Search'} value={cle} onChange={(e) => setCle(e.target.value)} />
            <button
              className="bouton-verre"
              disabled={!cle.trim()}
              onClick={async () => {
                setA(await window.se7en.recherche.definirCle(cle.trim()))
                setCle('')
              }}
            >
              Enregistrer
            </button>
            {a && (
              <button className="bouton-verre" onClick={async () => setA(await window.se7en.recherche.definirCle(null))}>
                Supprimer
              </button>
            )}
          </div>
          <button className="lien-discret" onClick={() => window.se7en.onglets.nouveau('https://brave.com/search/api/')}>
            Obtenir une clé gratuite (brave.com/search/api)
          </button>
        </div>
      )}
    </div>
  )
}

function Resultat({ r }: { r: Recherche }): React.JSX.Element {
  const enCours = !['fini', 'erreur', 'arretee'].includes(r.etape)
  const utiles = r.sources.filter((s) => s.notes)
  return (
    <section className="bloc verre-fort resultat-recherche">
      <div className="tete-resultat">
        <h2>{r.question}</h2>
        {enCours ? (
          <button className="bouton-verre" onClick={() => window.se7en.recherche.arreter()}>
            Arrêter
          </button>
        ) : (
          <span className="discret petit">
            {new Date(r.date).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            {r.duree ? ` · ${r.duree} s` : ''}
          </span>
        )}
      </div>
      {r.etape !== 'erreur' && r.etape !== 'arretee' && <Etapes r={r} />}
      {enCours && (
        <ul className="journal-recherche" aria-live="polite">
          {r.journal.slice(-5).map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
      {r.erreur && <p className="message-erreur">{r.erreur}</p>}
      {r.etape === 'arretee' && <p className="discret">Recherche arrêtée.</p>}
      {r.rapport && (
        <div className="rapport-recherche">
          <Markdown texte={r.rapport} />
        </div>
      )}
      {r.sources.length > 0 && (
        <div className="sources-recherche">
          <h3>
            Sources ({utiles.length} utiles sur {r.sources.length} lues)
          </h3>
          <ol>
            {r.sources.map((s) => (
              <li key={s.n} className={s.notes ? '' : 'sans-notes'} value={s.n}>
                <span className="origine-source">{ORIGINES[s.origine]}</span>
                <button className="titre-source" title={s.url} onClick={() => window.se7en.onglets.nouveau(s.url)}>
                  {s.titre}
                </button>
                {s.notes && (
                  <details>
                    <summary>Faits retenus</summary>
                    <p>{s.notes}</p>
                  </details>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}

export function PageRecherche(): React.JSX.Element {
  const [recherches, recharger] = useRecherches()
  const [question, setQuestion] = useState('')
  const [choisie, setChoisie] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const actuelle = recherches.find((r) => r.id === choisie) ?? recherches[0]
  const occupee = recherches.some((r) => !['fini', 'erreur', 'arretee'].includes(r.etape))
  const lancer = async (): Promise<void> => {
    const r = await window.se7en.recherche.lancer(question)
    if (!('id' in r)) return setErreur(r.erreur ?? 'La recherche n’a pas pu démarrer.')
    setErreur(null)
    setQuestion('')
    setChoisie(r.id)
  }
  return (
    <div className="page-interne">
      <div className="entete-page">
        <h1>Recherche approfondie</h1>
      </div>
      <p className="discret">
        L'IA lit plusieurs sources, en tire les faits utiles et écrit un rapport où chaque affirmation renvoie à sa source. Tout se passe sur ton PC ; les pages web sont
        ouvertes dans une session à part, sans tes cookies. Compte une à trois minutes.
      </p>
      <section className="bloc verre-fort nouvelle-recherche">
        <form
          className="ligne-reglage"
          onSubmit={(e) => {
            e.preventDefault()
            if (question.trim().length >= 3 && !occupee) void lancer()
          }}
        >
          <input
            className="champ"
            id="question-recherche"
            placeholder="Ex. : les écrans OLED s'usent-ils vraiment vite ?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button className="bouton-principal" type="submit" disabled={question.trim().length < 3 || occupee}>
            Lancer
          </button>
        </form>
        {erreur && <p className="message-erreur">{erreur}</p>}
        <CleBrave />
      </section>
      {actuelle && <Resultat r={actuelle} />}
      {recherches.length > 1 && (
        <section className="bloc verre-fort historique-recherches">
          <h2>Recherches précédentes</h2>
          {recherches.map((r) => (
            <div key={r.id} className={`ligne-recherche${r.id === actuelle?.id ? ' active' : ''}`}>
              <button className="titre-source" onClick={() => setChoisie(r.id)}>
                {r.question}
              </button>
              <span className="discret petit">{LIBELLES_ETAPES[r.etape]}</span>
              <button className="lien-discret" disabled={!['fini', 'erreur', 'arretee'].includes(r.etape)} onClick={() => {
                  window.se7en.recherche.supprimer(r.id)
                  setTimeout(recharger, 50)
                }}>
                Supprimer
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
