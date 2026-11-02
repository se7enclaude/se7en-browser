/* « Demande ou cherche » : quand la saisie n'est pas une adresse, on choisit entre la recherche et l'IA.
 * Le choix par défaut suit la saisie (une question → l'IA) ; Tab bascule ; Entrée valide. */
import { resoudreAdresse, ressembleAQuestion } from '../../../shared/adresse'
import { IconeIA, IconeRecherche } from './Icones'

/** Mode actuel : 'adresse' (on y va), 'recherche' ou 'ia'. `force` : choix fait avec Tab ou un clic. */
export function modeSaisie(saisie: string, force: 'recherche' | 'ia' | null): 'adresse' | 'recherche' | 'ia' | null {
  if (!saisie.trim()) return null
  if (resoudreAdresse(saisie)) return 'adresse'
  return force ?? (ressembleAQuestion(saisie) ? 'ia' : 'recherche')
}

export function ChoixRechercheIA({ mode, changer }: { mode: 'recherche' | 'ia'; changer: (m: 'recherche' | 'ia') => void }): React.JSX.Element {
  return (
    <span className="choix-recherche-ia" title="Tab pour changer">
      <button type="button" className={mode === 'recherche' ? 'actif' : ''} onMouseDown={(e) => (e.preventDefault(), changer('recherche'))}>
        <IconeRecherche /> Chercher
      </button>
      <button type="button" className={mode === 'ia' ? 'actif' : ''} onMouseDown={(e) => (e.preventDefault(), changer('ia'))}>
        <IconeIA /> Demander
      </button>
    </span>
  )
}
