/* Pages figées : les pages web sont des vues natives posées au-dessus de l'interface, elles ne suivent pas les
 * animations CSS. Le temps d'une animation (barre latérale, panneau IA) ou d'un écran qui passe devant (recherche
 * d'onglets, zone de l'écran, accueil), le main les cache et l'interface affiche leur image à leur place :
 * l'image glisse avec l'animation, ou se floute sous le verre. */
import { useEffect, useRef, useState } from 'react'

type Images = ReadonlyMap<number, string>

let compte = 0
let images: Images = new Map()
let minuteur: ReturnType<typeof setTimeout> | undefined
const ecouteurs = new Set<(i: Images) => void>()

const diffuser = (): void => ecouteurs.forEach((f) => f(images))

/** Fige les pages visibles ; renvoie la fonction qui les rend (à appeler une seule fois). */
export async function figerPages(): Promise<() => void> {
  compte++
  clearTimeout(minuteur)
  const liste = await window.se7en.onglets.figer()
  // déjà figées par un autre écran : le main ne renvoie rien, on garde les images en place
  if (liste.length) {
    images = new Map(liste.map((p) => [p.id, p.image]))
    diffuser()
  }
  let rendue = false
  return () => {
    if (rendue) return
    rendue = true
    compte--
    window.se7en.onglets.liberer()
    // l'image reste un instant, le temps que la vraie page se repose dessus (pas de clignotement)
    if (compte === 0)
      minuteur = setTimeout(() => {
        images = new Map()
        diffuser()
      }, 160)
  }
}

/** Images des pages figées, par onglet. */
export function useImagesFigees(): Images {
  const [i, setI] = useState(images)
  useEffect(() => {
    ecouteurs.add(setI)
    return () => void ecouteurs.delete(setI)
  }, [])
  return i
}

/** Fige les pages tant que le composant est affiché (écran qui passe devant les pages). */
export function useFigerPages(): void {
  useEffect(() => {
    let fini = false
    let rendre: (() => void) | null = null
    void figerPages().then((r) => (fini ? r() : (rendre = r)))
    return () => {
      fini = true
      rendre?.()
    }
  }, [])
}

/** Suit `valeur` avec un léger retard : les pages sont d'abord figées, puis la valeur change (l'animation CSS
 * démarre sur l'image), et elles reviennent à leur nouvelle place une fois l'animation finie. */
export function useApresFigeage<T>(valeur: T, duree: number): T {
  const [affichee, setAffichee] = useState(valeur)
  const derniere = useRef(valeur)
  derniere.current = valeur
  const premiere = useRef(true)
  useEffect(() => {
    // au démarrage, rien à animer
    if (premiere.current) {
      premiere.current = false
      return setAffichee(valeur)
    }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setAffichee(valeur)
    void figerPages().then((rendre) => {
      setAffichee(derniere.current)
      setTimeout(rendre, duree)
    })
  }, [valeur])
  return affichee
}
