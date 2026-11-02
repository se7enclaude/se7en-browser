/* Réglages et état de l'appli côté interface, synchronisés avec le main. */
import { useEffect, useState } from 'react'
import type { InfosApp } from '../../shared/ipc'
import type { Reglages } from '../../shared/reglages'

export function useReglages(): [Reglages | null, (partiel: Partial<Reglages>) => void] {
  const [reglages, setReglages] = useState<Reglages | null>(null)
  useEffect(() => {
    window.se7en.reglages.lire().then(setReglages)
    return window.se7en.reglages.surChangement(setReglages)
  }, [])
  const modifier = (partiel: Partial<Reglages>): void => {
    window.se7en.reglages.modifier(partiel).then(setReglages)
  }
  return [reglages, modifier]
}

export function useInfosApp(): InfosApp | null {
  const [infos, setInfos] = useState<InfosApp | null>(null)
  useEffect(() => {
    window.se7en.app.infos().then(setInfos)
  }, [])
  return infos
}

/** Applique thème, teinte et effet natif sur <html> : tout le style en découle (variables CSS). */
export function useAttributsTheme(reglages: Reglages | null, infos: InfosApp | null): void {
  useEffect(() => {
    const html = document.documentElement
    if (reglages) {
      html.dataset.theme = reglages.theme
      html.dataset.teinte = reglages.teinte
    }
    if (infos) html.dataset.natif = infos.effetNatif ? 'oui' : 'non'
  }, [reglages, infos])
}
