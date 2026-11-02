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

/** Pages dessinées par l'interface elle-même, ouvertes dans un onglet comme une page normale. */
export const PAGES_INTERNES = {
  'se7en://parametres': 'Paramètres',
  'se7en://historique': 'Historique',
  'se7en://favoris': 'Favoris',
  'se7en://telechargements': 'Téléchargements',
  'se7en://ia': 'IA locale',
  'se7en://amis': 'Amis'
} as const
export type PageInterne = keyof typeof PAGES_INTERNES

export function estPageInterne(url: string): url is PageInterne {
  return Object.hasOwn(PAGES_INTERNES, url)
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
  return resoudreAdresse(texte) ?? moteur.replace('%s', encodeURIComponent(texte))
}

/** L'adresse que désigne la saisie, ou null si c'est une recherche (ou une question pour l'IA). */
export function resoudreAdresse(saisie: string): string | null {
  const texte = saisie.trim()
  if (!texte) return null
  if (estPageInterne(texte.toLowerCase())) return texte.toLowerCase()
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
  return null
}

/** Une saisie qui ressemble à une question (« ? » final, ou mot interrogatif) : la barre propose d'abord l'IA. */
export function ressembleAQuestion(saisie: string): boolean {
  const t = saisie.trim().toLowerCase()
  return /\?$/.test(t) || /^(comment|pourquoi|quel|quelle|quels|quelles|qu'est|qui|quand|où|combien|est-ce|explique|résume|traduis)\b/.test(t)
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
