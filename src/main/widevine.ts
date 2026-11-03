/* Vidéos protégées (Crunchyroll, Netflix, Disney+…) : le module Widevine de Google.
 * Il n'existe que dans l'Electron de castLabs (« Electron for Content Security »), qui le télécharge et le tient
 * à jour tout seul au premier lancement. Avec l'Electron d'origine, `components` est absent : rien ne se passe. */
import * as electron from 'electron'

interface Composants {
  whenReady(): Promise<unknown>
  status(): Record<string, { status: string; version?: string | null }>
}

const composants = (electron as unknown as { components?: Composants }).components

/** Vrai si ce navigateur peut lire les vidéos protégées (Electron de castLabs). */
export const widevineDisponible = (): boolean => !!composants

/** Prépare Widevine en arrière-plan (téléchargé au premier lancement) ; la lecture marche une fois prêt. */
export function preparerWidevine(): void {
  if (!composants) return
  composants.whenReady().then(
    () => console.log('Widevine prêt :', JSON.stringify(composants.status())),
    (e: unknown) => console.warn('Widevine indisponible :', e)
  )
}
