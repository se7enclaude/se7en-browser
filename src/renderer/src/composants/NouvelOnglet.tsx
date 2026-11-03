/* Page « Nouvel onglet » : grande barre de recherche, puis raccourcis vers tes favoris et tes sites les plus visités.
 * La barre fait « Demande ou cherche » : une adresse, une recherche, ou une question pour l'IA. */
import { useEffect, useState } from 'react'
import type { SitePopulaire } from '../../../shared/donnees'
import type { EtatOnglet } from '../../../shared/onglets'
import { initiale, useFavoris } from '../useDonnees'
import { ChoixRechercheIA, modeSaisie } from './ChoixRechercheIA'
import { IconePrive, IconeRecherche } from './Icones'

function salutation(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Bonne nuit'
  if (h < 18) return 'Bonjour'
  return 'Bonsoir'
}

const MAX_TUILES = 8

export function NouvelOnglet({ onglet, demanderIA }: { onglet: EtatOnglet; demanderIA: (texte: string) => void }): React.JSX.Element {
  const [saisie, setSaisie] = useState('')
  const [force, setForce] = useState<'recherche' | 'ia' | null>(null)
  const mode = modeSaisie(saisie, force)
  const [populaires, setPopulaires] = useState<SitePopulaire[]>([])
  const favoris = useFavoris()
  useEffect(() => {
    window.se7en.historique.plusVisites(MAX_TUILES).then(setPopulaires)
  }, [])

  // favoris d'abord, puis les sites les plus visités qui n'y sont pas déjà
  const vus = new Set<string>()
  const tuiles = [
    ...favoris.map((f) => ({ url: f.url, titre: f.titre, favicon: f.favicon })),
    ...populaires.map((p) => ({ url: p.url, titre: p.titre, favicon: favoris.find((f) => f.url === p.url)?.favicon ?? null }))
  ]
    .filter((t) => {
      const cle = new URL(t.url).origin
      if (vus.has(cle)) return false
      vus.add(cle)
      return true
    })
    .slice(0, MAX_TUILES)

  const aller = (url: string): void => {
    window.se7en.onglets.naviguer(onglet.id, url)
    window.se7en.onglets.focusPage()
  }

  return (
    <div className="nouvel-onglet-page">
      {onglet.prive ? (
        <>
          <div className="orbe orbe-prive" aria-hidden>
            <IconePrive />
          </div>
          <h1 className="salutation">Navigation privée</h1>
          <p className="sous-salutation">
            Rien n’est gardé : ni historique, ni mémoire de l’IA, ni cookies. Tout s’efface quand tu fermes le dernier onglet privé.
          </p>
        </>
      ) : (
        <>
          <div className="orbe" aria-hidden />
          <h1 className="salutation">{salutation()}.</h1>
          <p className="sous-salutation">Que veux-tu explorer ?</p>
        </>
      )}
      <form
        className="grande-recherche verre-fort"
        onSubmit={(e) => {
          e.preventDefault()
          if (!saisie.trim()) return
          if (mode === 'ia') demanderIA(saisie.trim())
          else aller(saisie)
          setSaisie('')
          setForce(null)
        }}
      >
        <IconeRecherche />
        <input
          autoFocus
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Tab' && (mode === 'recherche' || mode === 'ia')) {
              e.preventDefault()
              setForce(mode === 'ia' ? 'recherche' : 'ia')
            }
          }}
          placeholder="Demander à l’IA ou saisir une adresse"
          spellCheck={false}
        />
        {(mode === 'recherche' || mode === 'ia') && <ChoixRechercheIA mode={mode} changer={setForce} />}
      </form>
      {tuiles.length > 0 && !onglet.prive && (
        <div className="tuiles">
          {tuiles.map((t, i) => (
            <button key={t.url} className="tuile" title={t.titre} style={{ animationDelay: `${i * 30}ms` }} onClick={() => aller(t.url)}>
              <span className="tuile-icone verre-fort">
                {t.favicon ? <img src={t.favicon} alt="" /> : <span className="pastille-lettre grande">{initiale(t.url)}</span>}
              </span>
              <span className="tuile-titre">{t.titre}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
