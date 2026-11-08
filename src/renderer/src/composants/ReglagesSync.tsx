/* Paramètres › Synchronisation : favoris, Skills, apparence et onglets entre tes PC, chiffrés de bout en bout. */
import { useEffect, useState } from 'react'
import type { EtatSync } from '../../../shared/sync'

function useSync(): EtatSync | null {
  const [e, setE] = useState<EtatSync | null>(null)
  useEffect(() => {
    void window.se7en.sync.etat().then(setE)
    return window.se7en.sync.surEtat(setE)
  }, [])
  return e
}

const depuis = (t: number): string => {
  const min = Math.round((Date.now() - t) / 60_000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  if (min < 1440) return `il y a ${Math.round(min / 60)} h`
  return `il y a ${Math.round(min / 1440)} j`
}

export function ReglagesSync(): React.JSX.Element | null {
  const etat = useSync()
  const api = window.se7en.sync
  const [code, setCode] = useState<string | null>(null)
  const [saisie, setSaisie] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)
  const [confirmer, setConfirmer] = useState(false)
  if (!etat) return null
  return (
    <section className="bloc verre-fort">
      <h2>Synchronisation entre tes PC</h2>
      <p className="discret">
        Tes favoris, tes Skills, ton apparence et ton moteur de recherche suivent sur tes autres PC, et tu retrouves leurs onglets ouverts ici. Tout est chiffré sur ton PC
        avant de partir : le serveur ne garde qu'un paquet illisible, et la clé ne quitte jamais tes PC.
      </p>
      {message && <p className={message.ok ? 'message-ok' : 'message-erreur'}>{message.texte}</p>}
      {!etat.active ? (
        <div className="choix-sync">
          <div>
            <h3>Premier PC</h3>
            <p className="discret petit">Crée ton espace de synchronisation, puis note le code de liaison pour tes autres PC.</p>
            <button
              className="bouton-principal"
              onClick={async () => {
                const r = await api.activer()
                if (typeof r === 'string') setCode(r)
                else setMessage({ ok: false, texte: r.erreur })
              }}
            >
              Activer la synchronisation
            </button>
          </div>
          <div>
            <h3>Autre PC</h3>
            <p className="discret petit">Colle le code de liaison affiché sur ton premier PC (Paramètres › Synchronisation).</p>
            <form
              className="ligne-reglage"
              onSubmit={async (ev) => {
                ev.preventDefault()
                const r = await api.relier(saisie)
                setMessage('erreur' in r ? { ok: false, texte: r.erreur } : { ok: true, texte: 'Ce PC est relié : tes données arrivent.' })
                if (!('erreur' in r)) setSaisie('')
              }}
            >
              <input className="champ" id="code-liaison" placeholder="XXXX-XXXX-…" value={saisie} onChange={(ev) => setSaisie(ev.target.value)} />
              <button className="bouton-verre" type="submit" disabled={saisie.replace(/[\s-]/g, '').length < 54}>
                Relier
              </button>
            </form>
          </div>
        </div>
      ) : (
        <>
          <div className="ligne-reglage">
            <span>
              Ce PC : <strong>{etat.appareil}</strong>
              <span className="discret petit">
                {' '}
                · {etat.enCours ? 'synchronisation…' : etat.derniere ? `synchronisé ${depuis(etat.derniere)}` : 'pas encore synchronisé'}
              </span>
            </span>
            <button className="bouton-verre petit" disabled={etat.enCours} onClick={() => api.maintenant()}>
              Synchroniser maintenant
            </button>
          </div>
          {etat.erreur && <p className="message-erreur">{etat.erreur}</p>}
          <div className="ligne-reglage">
            <span>Code de liaison (pour relier un autre PC)</span>
            <button className="bouton-verre petit" onClick={async () => setCode(code ? null : await api.code())}>
              {code ? 'Cacher' : 'Afficher'}
            </button>
          </div>
          {etat.autres.length > 0 && (
            <div className="autres-pc">
              <h3>Onglets de tes autres PC</h3>
              {etat.autres.map((a) => (
                <div key={a.id} className="pc-distant">
                  <strong>
                    {a.nom} <span className="discret petit">· {depuis(a.maj)}</span>
                  </strong>
                  {a.onglets.length === 0 ? (
                    <span className="discret petit">Aucun onglet ouvert.</span>
                  ) : (
                    <ul>
                      {a.onglets.slice(0, 20).map((o, i) => (
                        <li key={i}>
                          <button className="titre-source" title={o.url} onClick={() => window.se7en.onglets.nouveau(o.url)}>
                            {o.titre || o.url}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="ligne-reglage">
            <span className="espace" />
            {confirmer ? (
              <>
                <button
                  className="bouton-verre petit"
                  onClick={async () => {
                    await api.desactiver(false)
                    setConfirmer(false)
                    setCode(null)
                  }}
                >
                  Arrêter sur ce PC
                </button>
                <button
                  className="bouton-verre petit"
                  onClick={async () => {
                    await api.desactiver(true)
                    setConfirmer(false)
                    setCode(null)
                  }}
                >
                  Tout effacer du serveur
                </button>
                <button className="lien-discret" onClick={() => setConfirmer(false)}>
                  Annuler
                </button>
              </>
            ) : (
              <button className="lien-discret" onClick={() => setConfirmer(true)}>
                Désactiver…
              </button>
            )}
          </div>
        </>
      )}
      {code && (
        <div className="code-liaison">
          <p className="discret petit">Code de liaison : tape-le sur ton autre PC. Garde-le pour toi : il donne accès à tes données synchronisées.</p>
          <code>{code}</code>
        </div>
      )}
    </section>
  )
}
