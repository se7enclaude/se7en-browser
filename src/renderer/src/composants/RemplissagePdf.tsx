/* Remplissage d'un formulaire PDF avec le coffre : analyse, aperçu modifiable, puis remplissage
 * UNIQUEMENT après le clic de l'utilisateur sur « Remplir ». */
import { useEffect, useState } from 'react'
import type { AnalyseFormulaire, Proposition, ResultatRemplissage } from '../../../shared/formulaire'

interface Props {
  idOnglet: number
  fermer: () => void
}

type Etat =
  | { etape: 'analyse' }
  | { etape: 'apercu'; analyse: AnalyseFormulaire }
  | { etape: 'remplissage' }
  | { etape: 'fini'; resultat: ResultatRemplissage }
  | { etape: 'erreur'; message: string }

const SOURCES: Record<Proposition['source'], string> = { ia: 'associé par l’IA', libelle: 'repéré par le libellé', aucune: '' }

export function RemplissagePdf({ idOnglet, fermer }: Props): React.JSX.Element {
  const [etat, setEtat] = useState<Etat>({ etape: 'analyse' })
  const [valeurs, setValeurs] = useState<Record<string, string>>({})
  const [inclus, setInclus] = useState<Set<string>>(new Set())
  const [enregistre, setEnregistre] = useState<string | null>(null)

  useEffect(() => {
    window.se7en.formulaire.analyser(idOnglet).then((r) => {
      if ('erreur' in r) return setEtat({ etape: 'erreur', message: r.erreur })
      setValeurs(Object.fromEntries(r.propositions.map((p) => [p.nom, p.valeur])))
      setInclus(new Set(r.propositions.filter((p) => p.valeur).map((p) => p.nom)))
      setEtat({ etape: 'apercu', analyse: r })
    })
  }, [idOnglet])

  const remplir = async (): Promise<void> => {
    const liste = [...inclus].map((nom) => ({ nom, valeur: valeurs[nom] ?? '' })).filter((v) => v.valeur.trim())
    setEtat({ etape: 'remplissage' })
    const r = await window.se7en.formulaire.remplir(idOnglet, liste)
    setEtat('erreur' in r ? { etape: 'erreur', message: r.erreur } : { etape: 'fini', resultat: r })
  }

  return (
    <div className="remplissage">
      <div className="entete-remplissage">
        <strong>Remplir le formulaire</strong>
        <button className="bouton-verre petit" onClick={fermer}>
          Retour au chat
        </button>
      </div>

      {etat.etape === 'analyse' && <p className="discret attente">Lecture du formulaire, puis association des champs à ton coffre…</p>}
      {etat.etape === 'remplissage' && <p className="discret attente">Remplissage du PDF…</p>}
      {etat.etape === 'erreur' && <div className="message-erreur">{etat.message}</div>}

      {etat.etape === 'apercu' && (
        <>
          {etat.analyse.coffreVide ? (
            <div className="alerte-manipulation">
              Ton coffre est vide. Ajoute tes informations dans{' '}
              <button className="lien" onClick={() => window.se7en.onglets.interne('se7en://parametres')}>
                Paramètres › Coffre personnel
              </button>
              , puis reviens ici.
            </div>
          ) : (
            <p className="discret petit">
              Vérifie et corrige les valeurs : rien n'est écrit dans le PDF avant que tu cliques sur « Remplir ».
              {etat.analyse.iaUtilisee ? ' L’IA a seulement associé les champs : elle n’a pas vu tes informations.' : ' (IA non activée : repérage par les libellés.)'}
            </p>
          )}
          {etat.analyse.propositions.length === 0 && <p className="vide">Aucun champ de texte à remplir dans ce PDF.</p>}
          <div className="liste-propositions">
            {etat.analyse.propositions.map((p) => (
              <div key={p.nom} className={`proposition${inclus.has(p.nom) ? '' : ' exclue'}`}>
                <label className="case-proposition" title="Remplir ce champ">
                  <input
                    type="checkbox"
                    checked={inclus.has(p.nom)}
                    onChange={(e) => setInclus((s) => (e.target.checked ? new Set([...s, p.nom]) : new Set([...s].filter((x) => x !== p.nom))))}
                  />
                </label>
                <div className="corps-proposition">
                  <span className="libelle-proposition" title={p.nom}>
                    {p.libelle} <span className="discret">· p. {p.page}</span>
                  </span>
                  <input
                    className="champ"
                    value={valeurs[p.nom] ?? ''}
                    maxLength={p.maxLongueur ?? undefined}
                    placeholder="(vide)"
                    onChange={(e) => {
                      const v = e.target.value
                      setValeurs((x) => ({ ...x, [p.nom]: v }))
                      setInclus((s) => (v.trim() ? new Set([...s, p.nom]) : s))
                    }}
                  />
                  {p.source !== 'aucune' && <span className="source-proposition">{SOURCES[p.source]}</span>}
                </div>
              </div>
            ))}
          </div>
          {etat.analyse.autres > 0 && (
            <p className="discret petit">
              {etat.analyse.autres} autre{etat.analyse.autres > 1 ? 's' : ''} champ{etat.analyse.autres > 1 ? 's' : ''} (cases à cocher, listes, signature) à remplir à la main.
            </p>
          )}
          <div className="actions-remplissage">
            <button className="bouton-verre" onClick={fermer}>
              Annuler
            </button>
            <button className="bouton-principal" disabled={inclus.size === 0} onClick={() => void remplir()}>
              Remplir {inclus.size} champ{inclus.size > 1 ? 's' : ''}
            </button>
          </div>
        </>
      )}

      {etat.etape === 'fini' && (
        <>
          <div className="tout-pret bloc">
            <strong>✓ {etat.resultat.rempli} champ{etat.resultat.rempli > 1 ? 's' : ''} rempli{etat.resultat.rempli > 1 ? 's' : ''}</strong>
            <span className="discret">« {etat.resultat.nomDocument} » s'affiche dans l'onglet. Relis-le : le fichier d'origine n'a pas été modifié.</span>
          </div>
          <div className="actions-remplissage">
            {enregistre && <span className="discret petit">Enregistré : {enregistre}</span>}
            <button
              className="bouton-principal"
              onClick={async () => {
                const r = await window.se7en.formulaire.enregistrerSous(idOnglet)
                if (r && typeof r === 'string') setEnregistre(r)
              }}
            >
              Enregistrer sous…
            </button>
          </div>
        </>
      )}
    </div>
  )
}
