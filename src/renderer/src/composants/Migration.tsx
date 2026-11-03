/* « Tu viens d'un autre navigateur ? » : premier lancement et Paramètres.
 * Tout se fait à la demande de l'utilisateur : il exporte lui-même ses favoris et choisit le fichier ;
 * il choisit lui-même se7en Browser comme navigateur par défaut dans Windows.
 * Le navigateur ne lit jamais les mots de passe, cookies ou historiques des autres navigateurs. */
import { useEffect, useState } from 'react'
import { MOTEURS, type Reglages } from '../../../shared/reglages'

const EXPORTS = [
  { nom: 'Chrome', etapes: 'Ctrl+Maj+O › ⋮ (en haut à droite) › Exporter les favoris' },
  { nom: 'Edge', etapes: 'Ctrl+Maj+O › … › Exporter les favoris' },
  { nom: 'Firefox', etapes: 'Ctrl+Maj+O › Importation et sauvegarde › Exporter des marque-pages au format HTML' },
  { nom: 'Opera / Brave', etapes: 'Gestionnaire de favoris › Exporter les favoris' }
]

interface Props {
  reglages: Reglages
  modifier: (p: Partial<Reglages>) => void
  /** Version compacte (écran du premier lancement). */
  compact?: boolean
}

export function Migration({ reglages, modifier, compact }: Props): React.JSX.Element {
  const [resultat, setResultat] = useState<{ texte: string; erreur: boolean } | null>(null)
  const [parDefaut, setParDefaut] = useState<boolean | null>(null)

  // l'utilisateur revient de la page de Windows : on regarde à nouveau
  useEffect(() => {
    const verifier = (): void => void window.se7en.navigateurDefaut.etat().then(setParDefaut)
    verifier()
    window.addEventListener('focus', verifier)
    return () => window.removeEventListener('focus', verifier)
  }, [])

  const importer = async (): Promise<void> => {
    const r = await window.se7en.favoris.importer()
    if (!r) return
    if ('erreur' in r) return setResultat({ texte: r.erreur, erreur: true })
    setResultat({
      texte: r.ajoutes ? `${r.ajoutes} favori${r.ajoutes > 1 ? 's' : ''} importé${r.ajoutes > 1 ? 's' : ''}.` : `Tes ${r.trouves} favoris étaient déjà là.`,
      erreur: false
    })
  }

  return (
    <div className={`migration${compact ? ' compacte' : ''}`}>
      <div className="etape-migration">
        <div className="texte-migration">
          <strong>Tes favoris</strong>
          <span className="discret">Exporte-les depuis ton ancien navigateur, puis choisis le fichier :</span>
          <ul className="liste-exports">
            {EXPORTS.map((e) => (
              <li key={e.nom}>
                <b>{e.nom}</b> : {e.etapes}
              </li>
            ))}
          </ul>
          {resultat && <span className={resultat.erreur ? 'texte-erreur' : 'message-ok'}>{resultat.texte}</span>}
        </div>
        <button className="bouton-verre" onClick={() => void importer()}>
          Importer le fichier
        </button>
      </div>

      <div className="etape-migration">
        <div className="texte-migration">
          <strong>Navigateur par défaut</strong>
          <span className="discret">
            {parDefaut
              ? 'C’est fait : les liens de tes autres applis s’ouvrent dans se7en Browser.'
              : 'Pour que les liens (e-mails, Discord…) et les PDF s’ouvrent ici. Windows te demande de le choisir toi-même.'}
          </span>
        </div>
        {!parDefaut && (
          <button className="bouton-verre" onClick={() => window.se7en.navigateurDefaut.choisir()}>
            Choisir dans Windows
          </button>
        )}
      </div>

      <div className="etape-migration">
        <div className="texte-migration">
          <strong>Moteur de recherche</strong>
          <span className="discret">Celui que tu utilisais déjà.</span>
        </div>
        <select className="champ" value={reglages.moteurRecherche} onChange={(e) => modifier({ moteurRecherche: e.target.value })}>
          {MOTEURS.map((m) => (
            <option key={m.url} value={m.url}>
              {m.nom}
            </option>
          ))}
        </select>
      </div>

      <div className="etape-migration">
        <div className="texte-migration">
          <strong>Mots de passe et connexions</strong>
          <span className="discret">
            se7en Browser ne récupère jamais les mots de passe ni les connexions des autres navigateurs. Connecte-toi une fois sur chaque site : il s’en souvient
            ensuite, comme ton ancien navigateur. Avec un gestionnaire de mots de passe (Bitwarden, 1Password, Proton Pass…), tu retrouves tout depuis son site,
            dans n’importe quel navigateur.
          </span>
        </div>
      </div>
    </div>
  )
}
