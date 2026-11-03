/* Profils et amis : types partagés entre le main et l'interface.
 * Seuls le pseudo, la photo, la liste d'amis et les messages passent par le serveur se7en social.
 * Le coffre, l'IA, l'historique et les favoris restent sur le PC. */

export interface ProfilSocial {
  id: string
  pseudo: string
  /** 4 chiffres : on ajoute quelqu'un avec « pseudo#code ». */
  code: string
  photo: boolean
  /** Statut choisi (« ne pas déranger », « en train de jouer à… ») ; absent ou null : disponible. */
  humeur?: StatutSocial | null
}

export interface StatutSocial {
  type: 'occupe' | 'jeu' | 'absent'
  texte: string
}

/** Texte d'un statut, tel qu'on l'affiche sous un pseudo. */
export function texteStatut(s: StatutSocial | null | undefined): string {
  if (!s) return ''
  if (s.type === 'occupe') return s.texte ? `Ne pas déranger · ${s.texte}` : 'Ne pas déranger'
  if (s.type === 'jeu') return s.texte ? `Joue à ${s.texte}` : 'En train de jouer'
  return s.texte ? `Absent · ${s.texte}` : 'Absent'
}

export const MAX_VOCAL_SECONDES = 120

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
  /** Message de groupe : identifiant du groupe (et `a` vide). */
  groupe: string | null
  /** Image ou capture jointe : son identifiant (à charger à part). */
  image: string | null
  /** Message vocal : identifiant du son (à charger à part). */
  vocal?: string | null
  date: number
  lu: number
}

export interface GroupeSocial {
  id: string
  nom: string
  createur: string
  membres: ProfilSocial[]
  nonLus: number
}

/** Une conversation : avec un ami, ou dans un groupe. */
export type CibleSocial = { type: 'ami'; id: string } | { type: 'groupe'; id: string }

export const MAX_MEMBRES_GROUPE = 20

/** « Naviguer ensemble » : un onglet partagé avec un ami ; celui qui guide envoie l'adresse et la position. */
export type ActionEnsemble = 'invite' | 'accepte' | 'refuse' | 'url' | 'defile' | 'main' | 'fin'
export interface SignalEnsemble {
  de: string
  action: ActionEnsemble
  url?: string
  titre?: string
  pseudo?: string
  y?: number
}
export type EtatEnsemble = {
  ami: string
  pseudo: string
  /** Onglet partagé (null tant que l'invitation n'est pas acceptée, côté invité). */
  ongletId: number | null
  role: 'guide' | 'suit'
  etat: 'invitation-envoyee' | 'invitation-recue' | 'actif'
  titre?: string
  url?: string
} | null

export type ConnexionSocial = 'desactive' | 'hors-ligne' | 'connexion' | 'connecte'

export interface EtatSocial {
  connexion: ConnexionSocial
  /** null tant que le profil n'est pas créé (ou pas encore lu). */
  profil: ProfilSocial | null
  /** Dernière erreur à montrer (serveur injoignable…). */
  erreur: string | null
}

/** Évènements poussés en direct par le serveur. */
/** Petite notification en bas à droite du navigateur (vue à part, au-dessus des pages). */
export interface NotifMessage {
  /** Les notifications de même clé (un ami, un groupe) se regroupent. */
  cle: string
  /** Conversation ouverte au clic. */
  cible: CibleSocial
  pseudo: string
  texte: string
  photo: string | null
  sombre: boolean
}

export type EvenementSocial =
  | { type: 'message'; message: MessageSocial; pseudo: string }
  | { type: 'amis' }
  | { type: 'presence'; id: string; enLigne: boolean }
  /** L'ami a lu nos messages (« Vu »). */
  | { type: 'lu'; id: string }
  /** Un ami (ou un membre du groupe) est en train d'écrire. */
  | { type: 'ecrit'; id: string; groupe?: string }
  /** La liste des groupes a changé (création, membre ajouté, départ…). */
  | { type: 'groupes' }
  /** Un ami a changé de statut. */
  | { type: 'statut'; id: string; statut: StatutSocial | null }
  | ({ type: 'ensemble' } & SignalEnsemble)

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
