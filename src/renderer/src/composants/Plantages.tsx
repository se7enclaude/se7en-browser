/* Rapports de plantage : bandeau discret après un problème, et liste dans les Paramètres.
 * Rien ne part tout seul : l'utilisateur peut copier un rapport ou l'envoyer à un ami (par exemple à qui l'a aidé à installer). */
import { useEffect, useState } from 'react'
import { texteRapport, type RapportPlantage } from '../../../shared/plantages'
import type { Ami } from '../../../shared/social'

const TITRES: Record<RapportPlantage['type'], string> = {
  'fermeture-inattendue': 'Fermeture inattendue',
  interface: "L'interface a planté",
  page: 'Une page a planté',
  processus: 'Processus interne arrêté',
  erreur: 'Erreur'
}

/** Après un problème : un bandeau, une seule fois par rapport. */
export function BandeauPlantage(): React.JSX.Element | null {
  const [nonVus, setNonVus] = useState(0)
  useEffect(() => {
    void window.se7en.plantages.lister().then((l) => l && setNonVus(l.nonVus))
  }, [])
  if (!nonVus) return null
  const fermer = (): void => {
    window.se7en.plantages.vus()
    setNonVus(0)
  }
  return (
    <div className="bandeau-plantage" role="status">
      <span>
        se7en Browser a eu un problème{nonVus > 1 ? ` (${nonVus} rapports)` : ''}. Un rapport a été gardé sur ce PC, rien n’a été envoyé.
      </span>
      <span className="espace" />
      <button
        className="bouton-verre petit"
        onClick={() => {
          fermer()
          window.se7en.onglets.interne('se7en://parametres')
          setTimeout(() => document.getElementById('plantages')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250)
        }}
      >
        Voir le rapport
      </button>
      <button className="bouton-verre petit" onClick={fermer}>
        Ignorer
      </button>
    </div>
  )
}

/** Section des Paramètres. */
export function SectionPlantages(): React.JSX.Element {
  const [rapports, setRapports] = useState<RapportPlantage[]>([])
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [amis, setAmis] = useState<Ami[]>([])
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    void window.se7en.plantages.lister().then((l) => l && setRapports(l.rapports))
    void window.se7en.social
      .amis()
      .then((a) => setAmis(Array.isArray(a) ? a.filter((x) => x.statut === 'ami') : []))
      .catch(() => setAmis([]))
  }, [])

  const effacer = async (id?: string): Promise<void> => {
    const l = await window.se7en.plantages.effacer(id)
    if (l) setRapports(l.rapports)
  }
  const envoyer = async (r: RapportPlantage, ami: Ami): Promise<void> => {
    const res = await window.se7en.social.envoyer({ type: 'ami', id: ami.id }, texteRapport(r))
    setInfo('erreur' in res ? res.erreur : `Rapport envoyé à ${ami.pseudo}.`)
  }

  return (
    <section className="bloc verre-fort" id="plantages">
      <h2>Rapports de plantage</h2>
      <p className="discret petit">
        Gardés sur ce PC, jamais envoyés tout seuls. Ils contiennent la version, Windows et l’erreur technique, jamais les pages que tu visites.
      </p>
      {rapports.length === 0 && <p className="discret">Aucun problème noté. Tout va bien.</p>}
      {rapports.map((r) => (
        <div key={r.id} className="rapport-plantage">
          <button className="ligne-rapport" onClick={() => setOuvert(ouvert === r.id ? null : r.id)}>
            <strong>{TITRES[r.type]}</strong>
            <span className="discret">
              {new Date(r.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} · v{r.version}
            </span>
          </button>
          {ouvert === r.id && (
            <div className="detail-rapport">
              <pre>{texteRapport(r, 6000)}</pre>
              <div className="actions-rapport">
                <button className="bouton-verre petit" onClick={() => void navigator.clipboard.writeText(texteRapport(r, 6000)).then(() => setInfo('Rapport copié.'))}>
                  Copier
                </button>
                {amis.length > 0 && (
                  <select
                    className="champ"
                    value=""
                    onChange={(e) => {
                      const a = amis.find((x) => x.id === e.target.value)
                      if (a) void envoyer(r, a)
                    }}
                  >
                    <option value="">Envoyer à un ami…</option>
                    {amis.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.pseudo}
                      </option>
                    ))}
                  </select>
                )}
                <button className="bouton-verre petit" onClick={() => void effacer(r.id)}>
                  Effacer
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
      {info && <p className="message-ok">{info}</p>}
      {rapports.length > 1 && (
        <button className="bouton-verre petit" onClick={() => void effacer()}>
          Tout effacer
        </button>
      )}
    </section>
  )
}
