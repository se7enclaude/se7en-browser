/* Sélecteurs de disposition, thème et teinte : utilisés par l'écran d'accueil et par les paramètres. */
import { TEINTES, type Disposition, type Reglages, type Teinte, type Theme } from '../../../shared/reglages'

const NOMS_THEMES: Record<Theme, string> = { clair: 'Clair', sombre: 'Sombre', auto: 'Auto' }
const NOMS_TEINTES: Record<Teinte, string> = {
  argent: 'Argent',
  soleil: 'Soleil',
  ocean: 'Océan',
  rose: 'Rose',
  menthe: 'Menthe',
  lavande: 'Lavande'
}
const DISPOSITIONS: { valeur: Disposition; nom: string; detail: string }[] = [
  { valeur: 'haut', nom: 'En haut', detail: 'Comme un navigateur classique' },
  { valeur: 'gauche', nom: 'À gauche', detail: 'Tous les onglets sur le côté' },
  { valeur: 'les-deux', nom: 'Les deux', detail: 'Prioritaires à gauche, les autres en haut' }
]

type Modifier = (partiel: Partial<Reglages>) => void

/** Mini-fenêtre dessinée qui montre où vont les onglets. */
function Apercu({ d }: { d: Disposition }): React.JSX.Element {
  return (
    <svg className="apercu-disposition" viewBox="0 0 120 76" aria-hidden>
      <rect x="1" y="1" width="118" height="74" rx="8" className="apercu-fenetre" />
      {d !== 'gauche' && [0, 1, 2].map((i) => <rect key={i} x={(d === 'les-deux' ? 34 : 8) + i * 24} y="7" width="20" height="7" rx="3" className="apercu-onglet" />)}
      {d !== 'haut' && (
        <>
          <rect x="6" y="20" width="22" height="50" rx="4" className="apercu-barre" />
          {[0, 1, 2, ...(d === 'gauche' ? [3, 4] : [])].map((i) => (
            <rect key={i} x="9" y={24 + i * 9} width="16" height="5" rx="2" className="apercu-onglet" />
          ))}
        </>
      )}
      <rect x={d === 'haut' ? 8 : 32} y="20" width={d === 'haut' ? 104 : 80} height="50" rx="4" className="apercu-page" />
    </svg>
  )
}

export function ChoixDisposition({ reglages, modifier }: { reglages: Reglages; modifier: Modifier }): React.JSX.Element {
  return (
    <div className="choix-dispositions">
      {DISPOSITIONS.map((d) => (
        <button
          key={d.valeur}
          className={`carte-choix${reglages.disposition === d.valeur ? ' actif' : ''}`}
          onClick={() => modifier({ disposition: d.valeur })}
        >
          <Apercu d={d.valeur} />
          <strong>{d.nom}</strong>
          <span className="discret">{d.detail}</span>
        </button>
      ))}
    </div>
  )
}

export function ChoixTheme({ reglages, modifier }: { reglages: Reglages; modifier: Modifier }): React.JSX.Element {
  return (
    <div className="segments">
      {(Object.keys(NOMS_THEMES) as Theme[]).map((t) => (
        <button key={t} className={reglages.theme === t ? 'actif' : ''} onClick={() => modifier({ theme: t })}>
          {NOMS_THEMES[t]}
        </button>
      ))}
    </div>
  )
}

export function ChoixTeinte({ reglages, modifier }: { reglages: Reglages; modifier: Modifier }): React.JSX.Element {
  return (
    <div className="pastilles">
      {TEINTES.map((t) => (
        <button
          key={t}
          title={NOMS_TEINTES[t]}
          aria-label={NOMS_TEINTES[t]}
          className={`pastille${reglages.teinte === t ? ' actif' : ''}`}
          data-teinte={t}
          onClick={() => modifier({ teinte: t })}
        />
      ))}
    </div>
  )
}
