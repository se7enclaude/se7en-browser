/* Chat avec l'IA locale : types partagés entre le main et l'interface. */

/** Page jointe à une question (on ne garde que son titre et son adresse, pas son contenu). */
export interface PageJointe {
  titre: string
  url: string
}

export interface MessageChat {
  id: string
  role: 'user' | 'assistant'
  texte: string
  date: number
  /** Pages lues pour répondre à cette question. */
  pages?: PageJointe[]
  /** Vrai si une capture de la page a été envoyée au modèle vision. */
  image?: boolean
  /** Pages qui contenaient une tentative de manipulation de l'IA (titres). */
  alertes?: string[]
  erreur?: boolean
}

export interface Conversation {
  id: string
  titre: string
  date: number
  messages: MessageChat[]
}

export interface ResumeConversation {
  id: string
  titre: string
  date: number
  nombre: number
}

export interface DemandeChat {
  /** null : nouvelle conversation. */
  idConversation: string | null
  texte: string
  /** Joindre la page de l'onglet actif. */
  avecPageActive: boolean
  /** Autres onglets cités avec @. */
  idsOnglets: number[]
  /** Zone de l'écran choisie par l'utilisateur : regardée par le modèle vision. */
  zone?: ZoneCapture
  /** Chercher aussi dans la mémoire de navigation (pages vues ces 30 derniers jours). */
  avecNavigation?: boolean
}

/** Rectangle d'une capture d'onglet, en fractions de sa taille (0 à 1). */
export interface ZoneCapture {
  idCapture: string
  x: number
  y: number
  largeur: number
  hauteur: number
}

export interface ReponseEnvoi {
  idConversation: string
  idQuestion: string
  idReponse: string
  /** Réponse donnée tout de suite par le navigateur (« retiens… », « oublie… ») : pas de flux à attendre. */
  reponseImmediate?: string
}

/** Morceaux de réponse envoyés pendant que l'IA écrit. */
export interface FluxChat {
  idConversation: string
  idReponse: string
  etape: 'lecture' | 'preparation' | 'ecriture' | 'fini' | 'erreur'
  delta?: string
  erreur?: string
  pages?: PageJointe[]
  image?: boolean
  alertes?: string[]
}

/** Un fait que l'utilisateur a demandé à l'IA de retenir. */
export interface Souvenir {
  id: string
  texte: string
  date: number
}

/** Une « Skill » : une consigne enregistrée, lancée en tapant /commande dans le chat. */
export interface Skill {
  id: string
  commande: string
  titre: string
  consigne: string
}

/** « Explique-moi cette page » : ce qu'est la page, ce qu'elle engage, les points à surveiller. */
export const DEMANDE_EXPLIQUE_PAGE =
  'Explique-moi cette page simplement : 1) de quoi il s’agit, en deux phrases ; 2) ce qu’elle me demande ou m’engage à faire ' +
  '(paiement, abonnement, inscription, données personnelles, délais) ; 3) les points à surveiller ou les pièges éventuels ; ' +
  '4) ce que je devrais vérifier avant d’agir. Sois concret et honnête : si rien d’important n’est à signaler, dis-le.'

export const RE_COMMANDE_SKILL = /^[a-z0-9-]{1,30}$/

export const SKILLS_DEFAUT: Skill[] = [
  {
    id: 'resume',
    commande: 'resume',
    titre: 'Résumer la page',
    consigne: "Résume cette page en français : une phrase d'introduction, puis les points essentiels en liste courte."
  },
  { id: 'points', commande: 'points', titre: 'Points clés', consigne: 'Donne les 5 points clés de cette page, en liste courte.' },
  {
    id: 'explique',
    commande: 'explique',
    titre: 'Expliquer simplement',
    consigne: "Explique le sujet de cette page simplement, comme à quelqu'un qui le découvre, avec un exemple concret."
  },
  { id: 'traduis', commande: 'traduis', titre: 'Traduire en français', consigne: 'Traduis fidèlement le contenu principal de cette page en français.' },
  {
    id: 'reponds',
    commande: 'reponds',
    titre: 'Rédiger une réponse',
    consigne: 'Rédige une réponse polie, claire et courte au message affiché sur cette page. Propose-la, je la relirai avant de l’envoyer moi-même.'
  }
]

/** « /resume en 3 lignes » → consigne de la Skill + « en 3 lignes ». Sans Skill reconnue, le texte est rendu tel quel. */
export function appliquerSkill(texte: string, skills: Skill[]): { texte: string; skill: Skill | null } {
  const m = /^\/([a-z0-9-]{1,30})(?:\s+([\s\S]*))?$/i.exec(texte.trim())
  const skill = m ? skills.find((s) => s.commande === m[1].toLowerCase()) : undefined
  if (!m || !skill) return { texte, skill: null }
  const reste = m[2]?.trim()
  return { texte: reste ? `${skill.consigne}\n\nPrécision : ${reste}` : skill.consigne, skill }
}
