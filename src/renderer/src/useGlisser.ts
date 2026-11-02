/* Glisser-déposer des onglets, partagé entre la barre du haut et la barre latérale. */
import { useState, type DragEvent } from 'react'

export interface Glisser {
  /** Onglet en cours de déplacement. */
  id: number | null
  /** Propriétés à poser sur un onglet : on peut le glisser, et lâcher un autre onglet dessus. */
  sur(id: number): {
    onDragStart: (e: DragEvent) => void
    onDragEnd: () => void
    onDragOver: (e: DragEvent) => void
    onDrop: (e: DragEvent) => void
  }
  /** Propriétés d'une zone vide où lâcher un onglet (ex. « épingler en prioritaire »). */
  zone(lacher: (id: number) => void): { onDragOver: (e: DragEvent) => void; onDrop: (e: DragEvent) => void }
}

export function useGlisser(): Glisser {
  const [id, setId] = useState<number | null>(null)
  return {
    id,
    sur: (cible) => ({
      onDragStart: (e) => {
        setId(cible)
        e.dataTransfer.effectAllowed = 'move'
      },
      onDragEnd: () => setId(null),
      onDragOver: (e) => {
        if (id !== null && id !== cible) e.preventDefault()
      },
      onDrop: (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (id !== null && id !== cible) window.se7en.onglets.deplacer(id, cible)
        setId(null)
      }
    }),
    zone: (lacher) => ({
      onDragOver: (e) => {
        if (id !== null) e.preventDefault()
      },
      onDrop: (e) => {
        e.preventDefault()
        if (id !== null) lacher(id)
        setId(null)
      }
    })
  }
}
