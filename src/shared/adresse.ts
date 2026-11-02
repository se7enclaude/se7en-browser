/* Transforme ce que l'utilisateur tape dans la barre d'adresse en adresse à ouvrir. */

/** Protocoles qu'un onglet a le droit d'ouvrir. Tout le reste (javascript:, file:, data:…) est refusé. */
export const PROTOCOLES_AUTORISES = ['http:', 'https:'] as const

export function estAdresseAutorisee(url: string): boolean {
  try {
    return (PROTOCOLES_AUTORISES as readonly string[]).includes(new URL(url).protocol)
  } catch {
    return false
  }
}

const RE_HOTE_LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?(\/.*)?$/i
const RE_IPV4 = /^\d{1,3}(\.\d{1,3}){3}(:\d{1,5})?(\/.*)?$/
// un nom de domaine : au moins un point, une extension de 2 lettres ou plus, pas d'espace
const RE_DOMAINE = /^([a-z0-9¡-￿-]+\.)+[a-z¡-￿]{2,}(:\d{1,5})?([/?#].*)?$/i

/**
 * « exemple.fr » → https://exemple.fr/ ; « https://… » tel quel ; une phrase → recherche avec le moteur.
 * `moteur` contient %s à la place des mots cherchés.
 */
export function resoudreSaisie(saisie: string, moteur: string): string {
  const texte = saisie.trim()
  if (!texte) return ''
  if (/^https?:\/\//i.test(texte)) {
    try {
      return new URL(texte).href
    } catch {
      /* adresse mal formée : on la cherche */
    }
  }
  if (!/\s/.test(texte)) {
    if (RE_HOTE_LOCAL.test(texte) || RE_IPV4.test(texte)) return new URL(`http://${texte}`).href
    if (RE_DOMAINE.test(texte)) {
      try {
        return new URL(`https://${texte}`).href
      } catch {
        /* on cherche */
      }
    }
  }
  return moteur.replace('%s', encodeURIComponent(texte))
}

/** Affichage compact d'une adresse dans la barre : sans « https:// » ni « www. » ni « / » final. */
export function adresseLisible(url: string): string {
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return url
    const hote = u.hostname.replace(/^www\./, '')
    const reste = (u.pathname === '/' ? '' : u.pathname) + u.search + u.hash
    return hote + (u.port ? `:${u.port}` : '') + reste
  } catch {
    return url
  }
}
