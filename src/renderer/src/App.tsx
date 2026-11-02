/* Interface du navigateur. Étape 1 : la coque (barre de titre, zone de page, thèmes).
 * Les onglets, la barre d'adresse et le panneau IA arrivent aux étapes suivantes. */
import { BarreTitre } from './composants/BarreTitre'
import { useAttributsTheme, useInfosApp, useReglages } from './useReglages'
import { TEINTES, type Teinte, type Theme } from '../../shared/reglages'

const NOMS_THEMES: Record<Theme, string> = { clair: 'Clair', sombre: 'Sombre', auto: 'Auto' }
const NOMS_TEINTES: Record<Teinte, string> = {
  argent: 'Argent',
  soleil: 'Soleil',
  ocean: 'Océan',
  rose: 'Rose',
  menthe: 'Menthe',
  lavande: 'Lavande'
}

export function App(): React.JSX.Element {
  const [reglages, modifier] = useReglages()
  const infos = useInfosApp()
  useAttributsTheme(reglages, infos)

  return (
    <div className="coque">
      <BarreTitre />
      <main className="zone-page verre">
        {reglages && (
          <section className="carte-demo verre-fort">
            <h1>se7en Browser</h1>
            <p className="discret">
              Version {infos?.version} · {infos?.effetNatif ? 'verre natif Windows 11' : 'verre simulé (Windows 10)'}
            </p>
            <div className="groupe">
              <span className="etiquette">Thème</span>
              <div className="segments">
                {(Object.keys(NOMS_THEMES) as Theme[]).map((t) => (
                  <button key={t} className={reglages.theme === t ? 'actif' : ''} onClick={() => modifier({ theme: t })}>
                    {NOMS_THEMES[t]}
                  </button>
                ))}
              </div>
            </div>
            <div className="groupe">
              <span className="etiquette">Teinte</span>
              <div className="pastilles">
                {TEINTES.map((t) => (
                  <button
                    key={t}
                    title={NOMS_TEINTES[t]}
                    className={`pastille${reglages.teinte === t ? ' actif' : ''}`}
                    data-teinte={t}
                    onClick={() => modifier({ teinte: t })}
                  />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
