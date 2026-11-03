/* « Remplir ce formulaire avec mon coffre » : aperçu de chaque champ trouvé dans la page avec la valeur proposée.
 * Rien n'est écrit dans la page avant le clic sur « Remplir » ; chaque valeur se corrige ou se décoche.
 * La page est figée derrière le verre le temps de l'aperçu. */
import { useEffect, useState } from 'react'
import type { ChampWebPropose } from '../../../shared/formulaire'
import { useFigerPages } from '../pagesFigees'
import { IconeCroix } from './Icones'

const SOURCES: Record<ChampWebPropose['source'], string> = {
  autocomplete: 'indiqué par le site',
  libelle: 'd’après le libellé',
  ia: 'proposé par l’IA',
  aucune: ''
}

export function RemplissageWeb({ idOnglet, fermer }: { idOnglet: number; fermer: () => void }): React.JSX.Element {
  useFigerPages()
  const [champs, setChamps] = useState<(ChampWebPropose & { coche: boolean })[] | null>(null)
  const [infos, setInfos] = useState<{ ia: boolean; coffreVide: boolean; phishing: string | null } | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [fait, setFait] = useState<number | null>(null)

  useEffect(() => {
    void window.se7en.formulaireWeb.analyser(idOnglet).then((r) => {
      if ('erreur' in r) return setErreur(r.erreur)
      setChamps(r.champs.map((c) => ({ ...c, coche: !!c.valeur && !c.valeurActuelle })))
      setInfos({ ia: r.iaUtilisee, coffreVide: r.coffreVide, phishing: r.phishing })
    })
    const echap = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') fermer()
    }
    window.addEventListener('keydown', echap)
    return () => window.removeEventListener('keydown', echap)
  }, [idOnglet])

  const aRemplir = champs?.filter((c) => c.coche && c.valeur) ?? []
  const remplir = async (): Promise<void> => {
    const r = await window.se7en.formulaireWeb.remplir(
      idOnglet,
      aRemplir.map((c) => ({ nom: c.nom, valeur: c.valeur }))
    )
    if ('erreur' in r) return setErreur(r.erreur)
    setFait(r.remplis)
    setTimeout(fermer, 1200)
  }

  return (
    <div className="fond-remplissage" onMouseDown={(e) => e.target === e.currentTarget && fermer()}>
      <div className="carte-remplissage verre-fort" role="dialog" aria-label="Remplir le formulaire">
        <div className="entete-section">
          <h2>Remplir ce formulaire</h2>
          <button className="bouton-icone" title="Fermer" onClick={fermer}>
            <IconeCroix />
          </button>
        </div>
        {infos?.phishing && (
          <p className="message-erreur">
            ⚠ Cette page a été signalée comme peut-être frauduleuse. Ne remplis rien si tu as un doute sur le site.
          </p>
        )}
        {!champs && !erreur && <p className="discret attente">Lecture des champs de la page{infos?.ia ? '' : '…'}</p>}
        {erreur && <p className="message-erreur">{erreur}</p>}
        {infos?.coffreVide && (
          <p className="discret">
            Ton coffre est vide : ajoute tes informations dans Paramètres › Coffre, puis recommence.
          </p>
        )}
        {champs && champs.length === 0 && <p className="discret">Aucun champ à remplir trouvé sur cette page (les mots de passe et cartes bancaires ne sont jamais remplis).</p>}
        {champs && champs.length > 0 && (
          <>
            <p className="discret petit">
              Vérifie chaque valeur : rien n’est écrit dans la page avant que tu cliques sur « Remplir ». Les mots de passe et cartes bancaires ne sont jamais
              remplis. {infos?.ia ? 'L’IA n’a vu que les noms des champs, jamais tes informations.' : ''}
            </p>
            <div className="liste-remplissage">
              {champs.map((c, i) => (
                <label key={c.nom} className={`ligne-remplissage${c.coche ? '' : ' decochee'}`}>
                  <input
                    type="checkbox"
                    checked={c.coche}
                    onChange={(e) => setChamps((l) => l!.map((x, k) => (k === i ? { ...x, coche: e.target.checked } : x)))}
                  />
                  <span className="libelle-remplissage">
                    {c.libelle}
                    {c.valeurActuelle && <span className="discret"> · déjà rempli</span>}
                    {c.source !== 'aucune' && <span className="discret"> · {SOURCES[c.source]}</span>}
                  </span>
                  <input
                    className="champ"
                    value={c.valeur}
                    placeholder="(rien à proposer)"
                    onChange={(e) => setChamps((l) => l!.map((x, k) => (k === i ? { ...x, valeur: e.target.value, coche: !!e.target.value } : x)))}
                  />
                </label>
              ))}
            </div>
            <div className="actions-profil">
              <button className="bouton-principal" disabled={!aRemplir.length || fait !== null} onClick={() => void remplir()}>
                {fait !== null ? `${fait} champ${fait > 1 ? 's' : ''} rempli${fait > 1 ? 's' : ''} ✓` : `Remplir ${aRemplir.length} champ${aRemplir.length > 1 ? 's' : ''}`}
              </button>
              <button className="bouton-verre" onClick={fermer}>
                Annuler
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
