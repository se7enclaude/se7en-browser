/* Raccourcis clavier du navigateur. Ils sont captés dans le main (before-input-event) pour marcher
 * que le focus soit dans l'interface ou dans une page web. */

/** Ce qu'il faut savoir d'une touche (sous-ensemble d'Electron.Input, pour pouvoir tester sans Electron). */
export interface Touche {
  type: string
  key: string
  /** Position physique de la touche (« Digit1 »…) : sur un clavier AZERTY, la touche 1 donne « & ». */
  code: string
  control: boolean
  shift: boolean
  alt: boolean
  meta: boolean
}

export type ActionRaccourci =
  | { type: 'nouvel-onglet' }
  | { type: 'fermer-onglet' }
  | { type: 'rouvrir-onglet' }
  | { type: 'onglet-suivant' }
  | { type: 'onglet-precedent' }
  | { type: 'onglet-numero'; index: number }
  | { type: 'focus-adresse' }
  | { type: 'actualiser'; forcer: boolean }
  | { type: 'precedent' }
  | { type: 'suivant' }
  | { type: 'arreter' }

export function actionDuRaccourci(t: Touche): ActionRaccourci | null {
  if (t.type !== 'keyDown' || t.meta) return null
  const k = t.key.length === 1 ? t.key.toLowerCase() : t.key
  const ctrl = t.control && !t.alt

  if (ctrl && !t.shift && k === 't') return { type: 'nouvel-onglet' }
  if (ctrl && t.shift && k === 't') return { type: 'rouvrir-onglet' }
  if (ctrl && !t.shift && (k === 'w' || k === 'F4')) return { type: 'fermer-onglet' }
  if (ctrl && k === 'Tab') return { type: t.shift ? 'onglet-precedent' : 'onglet-suivant' }
  if (ctrl && !t.shift && k === 'PageDown') return { type: 'onglet-suivant' }
  if (ctrl && !t.shift && k === 'PageUp') return { type: 'onglet-precedent' }
  // Ctrl+1…8 : onglet n ; Ctrl+9 : dernier onglet (-1)
  const chiffre = /^(?:Digit|Numpad)([1-9])$/.exec(t.code)?.[1]
  if (ctrl && !t.shift && chiffre) return { type: 'onglet-numero', index: chiffre === '9' ? -1 : Number(chiffre) - 1 }
  if ((ctrl && !t.shift && (k === 'l' || k === 'k')) || (t.alt && !t.control && k === 'd') || (!t.control && !t.alt && k === 'F6'))
    return { type: 'focus-adresse' }
  if (k === 'F5' && !t.alt) return { type: 'actualiser', forcer: t.control || t.shift }
  if (ctrl && k === 'r') return { type: 'actualiser', forcer: t.shift }
  if (t.alt && !t.control && !t.shift && k === 'ArrowLeft') return { type: 'precedent' }
  if (t.alt && !t.control && !t.shift && k === 'ArrowRight') return { type: 'suivant' }
  if (!t.control && !t.alt && !t.shift && k === 'BrowserBack') return { type: 'precedent' }
  if (!t.control && !t.alt && !t.shift && k === 'BrowserForward') return { type: 'suivant' }
  return null
}
