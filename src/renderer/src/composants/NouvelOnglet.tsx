/* Page « Nouvel onglet » : grande barre de recherche au centre. (Elle deviendra « Demande ou cherche » à l'étape 6.) */
import { useState } from 'react'
import type { EtatOnglet } from '../../../shared/onglets'
import { IconeRecherche } from './Icones'

function salutation(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Bonne nuit'
  if (h < 18) return 'Bonjour'
  return 'Bonsoir'
}

export function NouvelOnglet({ onglet }: { onglet: EtatOnglet }): React.JSX.Element {
  const [saisie, setSaisie] = useState('')
  return (
    <div className="nouvel-onglet-page">
      <h1 className="salutation">{salutation()}</h1>
      <form
        className="grande-recherche verre-fort"
        onSubmit={(e) => {
          e.preventDefault()
          if (!saisie.trim()) return
          window.se7en.onglets.naviguer(onglet.id, saisie)
          setSaisie('')
          window.se7en.onglets.focusPage()
        }}
      >
        <IconeRecherche />
        <input
          autoFocus
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="Rechercher sur Google ou saisir une adresse"
          spellCheck={false}
        />
      </form>
    </div>
  )
}
