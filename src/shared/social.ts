/* Profils et amis : types partagés entre le main et l'interface.
 * Seuls le pseudo, la photo, la liste d'amis et les messages passent par le serveur se7en social.
 * Le coffre, l'IA, l'historique et les favoris restent sur le PC. */

export interface ProfilSocial {
  id: string
  pseudo: string
  /** 4 chiffres : on ajoute quelqu'un avec « pseudo#code ». */
  code: string
  photo: boolean
}

export type StatutAmi = 'ami' | 'envoyee' | 'recue'

export interface Ami extends ProfilSocial {
  statut: StatutAmi
  enLigne: boolean
  nonLus: number
}

export interface MessageSocial {
  id: string
  de: string
  a: string
  type: 'texte' | 'lien'
  texte: string
  /** Toujours http(s) (vérifié par le serveur et par le navigateur). */
  url: string | null
  titre: string | null
  date: number
  lu: number
}

export type ConnexionSocial = 'desactive' | 'hors-ligne' | 'connexion' | 'connecte'

export interface EtatSocial {
  connexion: ConnexionSocial
  /** null tant que le profil n'est pas créé (ou pas encore lu). */
  profil: ProfilSocial | null
  /** Dernière erreur à montrer (serveur injoignable…). */
  erreur: string | null
}

/** Évènements poussés en direct par le serveur. */
export type EvenementSocial =
  | { type: 'message'; message: MessageSocial; pseudo: string }
  | { type: 'amis' }
  | { type: 'presence'; id: string; enLigne: boolean }

/** Serveur officiel (Cloudflare) ; le réglage « Serveur » des paramètres peut le remplacer. */
export const SERVEUR_SOCIAL_OFFICIEL = 'https://se7en-social.outil-frontiere.workers.dev'

export const MAX_MESSAGE = 2000
export const RE_PSEUDO = /^[\p{L}\p{N}_ .-]{2,24}$/u
export const RE_CODE_AMI = /^(.{2,24})#(\d{4})$/u

/**
 * Adresse du serveur social acceptée : https, ou http seulement sur ce PC (serveur de développement).
 * Renvoie l'origine (sans chemin), ou null.
 */
export function adresseServeur(texte: string): string | null {
  try {
    const u = new URL(texte.trim())
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) return null
    if (u.username || u.password) return null
    return u.origin
  } catch {
    return null
  }
}

/** « Claire#4821 » affiché à partir d'un profil. */
export const codeAmi = (p: Pick<ProfilSocial, 'pseudo' | 'code'>): string => `${p.pseudo}#${p.code}`
