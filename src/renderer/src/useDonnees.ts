/* Favoris et téléchargements côté interface : lus une fois, puis tenus à jour par le main. */
import { useEffect, useState } from 'react'
import type { Favori, Telechargement } from '../../shared/donnees'

export function useFavoris(): Favori[] {
  const [liste, setListe] = useState<Favori[]>([])
  useEffect(() => {
    window.se7en.favoris.lire().then(setListe)
    return window.se7en.favoris.surChangement(setListe)
  }, [])
  return liste
}

export function useTelechargements(): Telechargement[] {
  const [liste, setListe] = useState<Telechargement[]>([])
  useEffect(() => {
    window.se7en.telechargements.lire().then(setListe)
    return window.se7en.telechargements.surChangement(setListe)
  }, [])
  return liste
}

/** « 1,4 Mo » */
export function taille(octets: number): string {
  if (octets < 1024) return `${octets} o`
  const unites = ['Ko', 'Mo', 'Go', 'To']
  let v = octets / 1024
  let i = 0
  while (v >= 1024 && i < unites.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toLocaleString('fr-FR', { maximumFractionDigits: v < 10 ? 1 : 0 })} ${unites[i]}`
}

/** Première lettre du site, pour une pastille quand il n'y a pas d'icône. */
export function initiale(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').charAt(0).toUpperCase() || '?'
  } catch {
    return '?'
  }
}
