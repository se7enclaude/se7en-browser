/* Extensions du Chrome Web Store : liste vérifiée (testées dans se7en Browser), installation par lien ou identifiant,
 * import depuis un autre navigateur. Les extensions ne tournent que dans les pages web : jamais dans l'interface,
 * le panneau IA, les pages internes ni le lecteur cloisonné de l'IA. */

export interface ExtensionInstallee {
  id: string
  nom: string
  version: string
  description: string
  activee: boolean
  /** Dans la liste vérifiée de se7en Browser. */
  verifiee: boolean
  /** Fenêtre de l'extension (popup de son bouton), s'il y en a une. */
  popup: string | null
  /** Page de réglages, s'il y en a une. */
  options: string | null
  /** Icône en data: URL, ou null. */
  icone: string | null
  installee: number
}

export interface ExtensionVerifiee {
  id: string
  nom: string
  description: string
  /** Ce qu'on a vérifié qu'elle fait dans se7en Browser. */
  note: string
}

/** Extensions testées dans se7en Browser : elles agissent dans les pages (pas besoin de la barre d'extensions de Chrome). */
export const EXTENSIONS_VERIFIEES: ExtensionVerifiee[] = [
  { id: 'mnjggcdmjocbbbhaepdhchncahnbgone', nom: 'SponsorBlock', description: 'Saute les passages sponsorisés des vidéos YouTube.', note: 'Testée : agit sur YouTube dès l’installation.' },
  { id: 'gebbhagfogifgggkldgodflihgfeippi', nom: 'Return YouTube Dislike', description: 'Réaffiche le nombre de « je n’aime pas » sur YouTube.', note: 'Testée : compteur affiché dès l’installation.' },
  {
    id: 'eimadpbcbfnmbkopoojfekhnkhdbieeh',
    nom: 'Dark Reader',
    description: 'Met tous les sites en mode sombre.',
    note: 'Testée : mode sombre dès l’installation ; quelques icônes de sites peuvent mal s’afficher.'
  }
]

export const RE_ID_EXTENSION = /^[a-p]{32}$/

/** Identifiant d'extension à partir d'un lien du Chrome Web Store (ancien ou nouveau) ou de l'identifiant seul. */
export function idExtension(texte: string): string | null {
  const t = texte.trim()
  if (RE_ID_EXTENSION.test(t)) return t
  try {
    const u = new URL(t)
    if (!['chromewebstore.google.com', 'chrome.google.com'].includes(u.hostname)) return null
    const id = u.pathname.split('/').find((p) => RE_ID_EXTENSION.test(p))
    return id ?? null
  } catch {
    return null
  }
}

/** Nom lisible d'un manifeste (« __MSG_appName__ » → cherché dans les traductions fournies). */
export function nomManifeste(brut: string, messages: Record<string, { message?: string }> | null): string {
  const m = /^__MSG_(\w+)__$/.exec(brut)
  if (!m) return brut
  const cle = Object.keys(messages ?? {}).find((k) => k.toLowerCase() === m[1].toLowerCase())
  return (cle && messages?.[cle]?.message) || brut
}

export interface NavigateurSource {
  nom: string
  /** Dossier des extensions du profil par défaut, relatif à %LOCALAPPDATA% (ou %APPDATA% pour Opera). */
  dossier: string
  racine: 'local' | 'roaming'
}

export const NAVIGATEURS_SOURCES: NavigateurSource[] = [
  { nom: 'Google Chrome', dossier: 'Google\\Chrome\\User Data\\Default\\Extensions', racine: 'local' },
  { nom: 'Microsoft Edge', dossier: 'Microsoft\\Edge\\User Data\\Default\\Extensions', racine: 'local' },
  { nom: 'Brave', dossier: 'BraveSoftware\\Brave-Browser\\User Data\\Default\\Extensions', racine: 'local' },
  { nom: 'Opera', dossier: 'Opera Software\\Opera Stable\\Extensions', racine: 'roaming' }
]

/** Extension trouvée dans un autre navigateur (on ne lit que son identifiant et son manifeste, rien d'autre). */
export interface ExtensionTrouvee {
  id: string
  nom: string
  navigateur: string
  verifiee: boolean
  dejaInstallee: boolean
}
