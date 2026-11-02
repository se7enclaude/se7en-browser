/* Icônes des sites : téléchargées par le main (avec la session de la page), puis passées à l'interface en data: URL.
 * L'interface elle-même ne contacte jamais Internet. */
import type { Session } from 'electron'

const TAILLE_MAX = 256 * 1024
const cache = new Map<string, string | null>()

export async function chargerFavicon(session: Session, urls: string[]): Promise<string | null> {
  const url = urls.find((u) => /^https?:\/\//.test(u) || u.startsWith('data:image/'))
  if (!url) return null
  if (url.startsWith('data:image/')) return url.length <= TAILLE_MAX ? url : null
  if (cache.has(url)) return cache.get(url) ?? null
  let resultat: string | null = null
  try {
    const rep = await session.fetch(url, { signal: AbortSignal.timeout(8000) })
    const type = rep.headers.get('content-type')?.split(';')[0].trim() ?? ''
    if (rep.ok && type.startsWith('image/')) {
      const octets = Buffer.from(await rep.arrayBuffer())
      if (octets.length <= TAILLE_MAX) resultat = `data:${type};base64,${octets.toString('base64')}`
    }
  } catch {
    resultat = null
  }
  if (cache.size > 500) cache.clear()
  cache.set(url, resultat)
  return resultat
}
