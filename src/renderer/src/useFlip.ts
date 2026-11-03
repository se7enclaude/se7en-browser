/* Animation « FLIP » d'une liste d'onglets : quand l'ordre ou la liste change (onglet déplacé, fermé, ajouté),
 * chaque onglet resté en place glisse depuis son ancienne position au lieu de sauter.
 * Les anciennes positions sont relevées juste avant que React touche au DOM (pendant le rendu), pas au rendu
 * précédent : un onglet qui a déjà glissé (pendant qu'un voisin se repliait) ne repart pas en arrière. */
import { useLayoutEffect, useRef, type RefObject } from 'react'

const animationsReduites = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches

function positions(el: HTMLElement | null): Map<string, DOMRect> {
  return new Map([...(el?.querySelectorAll<HTMLElement>('[data-flip]') ?? [])].map((e) => [e.dataset.flip!, e.getBoundingClientRect()]))
}

export function useFlip(conteneur: RefObject<HTMLElement | null>): void {
  const ordre = useRef('')
  // relevé pendant le rendu : le DOM est encore celui d'avant le changement
  const avant = positions(conteneur.current)
  useLayoutEffect(() => {
    const el = conteneur.current
    if (!el) return
    const elements = [...el.querySelectorAll<HTMLElement>('[data-flip]')]
    const cles = elements.map((e) => e.dataset.flip!).join(',')
    // seulement si la liste a changé : un simple redimensionnement de la fenêtre ne s'anime pas
    if (cles !== ordre.current && ordre.current && !animationsReduites()) {
      for (const e of elements) {
        const a = avant.get(e.dataset.flip!)
        if (!a) continue
        const b = e.getBoundingClientRect()
        const dx = a.left - b.left
        const dy = a.top - b.top
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue
        e.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 240, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' })
      }
    }
    ordre.current = cles
  })
}
