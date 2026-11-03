/* Raccourcis clavier du navigateur. Ils sont captés dans le main (before-input-event) pour marcher
 * que le focus soit dans l'interface ou dans une page web. */

import type { PageInterne } from '../../shared/adresse'
import { combinaison, RACCOURCIS_CONFIGURABLES } from '../../shared/raccourcis'

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
  | { type: 'nouvel-onglet-prive' }
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
  | { type: 'basculer-barre' }
  | { type: 'page'; page: PageInterne }
  | { type: 'favori' }
  | { type: 'basculer-ia' }
  | { type: 'ouvrir-fichier' }
  | { type: 'rechercher-onglets' }

/** Action configurable (identifiant de shared/raccourcis.ts) → action du navigateur. */
function actionConfigurable(id: string): ActionRaccourci | null {
  if (id.startsWith('page-')) return { type: 'page', page: `se7en://${id.slice(5)}` as PageInterne }
  return RACCOURCIS_CONFIGURABLES.some((r) => r.id === id) ? ({ type: id } as ActionRaccourci) : null
}

/** Identifiant configurable d'une action par défaut (null : action fixe, comme Ctrl+1…9 ou F5). */
function idConfigurable(a: ActionRaccourci): string | null {
  const id = a.type === 'page' ? `page-${a.page.replace('se7en://', '')}` : a.type
  return RACCOURCIS_CONFIGURABLES.some((r) => r.id === id) ? id : null
}

/** Avec les raccourcis personnalisés : ils passent en premier, et le raccourci par défaut d'une action réattribuée ne marche plus. */
export function actionDuRaccourci(t: Touche, perso: Record<string, string> = {}): ActionRaccourci | null {
  if (t.type !== 'keyDown' || t.meta) return null
  const combo = combinaison(t)
  if (combo) {
    const choisi = Object.entries(perso).find(([, c]) => c === combo)?.[0]
    if (choisi) return actionConfigurable(choisi)
  }
  const a = actionParDefaut(t)
  if (!a) return null
  const id = idConfigurable(a)
  return id && perso[id] ? null : a
}

function actionParDefaut(t: Touche): ActionRaccourci | null {
  const k = t.key.length === 1 ? t.key.toLowerCase() : t.key
  const ctrl = t.control && !t.alt

  if (ctrl && !t.shift && k === 't') return { type: 'nouvel-onglet' }
  if (ctrl && t.shift && k === 't') return { type: 'rouvrir-onglet' }
  if (ctrl && t.shift && k === 'n') return { type: 'nouvel-onglet-prive' }
  if (ctrl && t.shift && k === 'a') return { type: 'rechercher-onglets' }
  if (ctrl && !t.shift && (k === 'w' || k === 'F4')) return { type: 'fermer-onglet' }
  if (ctrl && k === 'Tab') return { type: t.shift ? 'onglet-precedent' : 'onglet-suivant' }
  if (ctrl && !t.shift && k === 'b') return { type: 'basculer-barre' }
  if (ctrl && !t.shift && (k === ' ' || t.code === 'Space')) return { type: 'basculer-ia' }
  if (ctrl && !t.shift && k === ',') return { type: 'page', page: 'se7en://parametres' }
  if (ctrl && !t.shift && k === 'h') return { type: 'page', page: 'se7en://historique' }
  if (ctrl && !t.shift && k === 'j') return { type: 'page', page: 'se7en://telechargements' }
  if (ctrl && t.shift && k === 'o') return { type: 'page', page: 'se7en://favoris' }
  if (ctrl && !t.shift && k === 'd') return { type: 'favori' }
  if (ctrl && !t.shift && k === 'o') return { type: 'ouvrir-fichier' }
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
