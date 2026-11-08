/* Lecteur cloisonné : ouvre une page dans une fenêtre invisible, avec sa propre session en mémoire (ni tes cookies,
 * ni tes connexions, ni ton historique), la lit, puis la referme. Utilisé par les tâches en arrière-plan et la
 * recherche approfondie. Aucune permission, aucun téléchargement, aucune fenêtre surgissante, pas de son. */
import { BrowserWindow, session, type Session } from 'electron'
import { estAdresseAutorisee } from '../../shared/adresse'
import { lirePage } from '../ia/lecturePage'

export const PARTITION_AGENT = 'agent'

export interface PageCloisonnee {
  url: string
  titre: string
  texte: string
  /** Blocs JSON-LD de la page (pour les prix). */
  jsonld: string[]
  /** Balises meta utiles (prix, description). */
  metas: Record<string, string>
  /** Liens de la page (pour la recherche approfondie). */
  liens: { url: string; texte: string }[]
}

const SCRIPT_DONNEES = `(() => {
  const jsonld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent || '').slice(0, 20)
  const metas = {}
  for (const m of document.querySelectorAll('meta[property], meta[name], [itemprop="price"], [itemprop="priceCurrency"]')) {
    const cle = m.getAttribute('property') || m.getAttribute('name') || ('itemprop:' + m.getAttribute('itemprop'))
    const val = m.getAttribute('content') || m.textContent || ''
    if (cle && val && /price|description|title/i.test(cle) && !(cle in metas)) metas[cle] = val.trim().slice(0, 300)
  }
  const liens = []
  const vus = new Set()
  for (const a of document.querySelectorAll('a[href]')) {
    const url = a.href
    const texte = (a.innerText || '').trim().replace(/\\s+/g, ' ')
    if (!/^https?:/.test(url) || vus.has(url) || texte.length < 3) continue
    vus.add(url)
    liens.push({ url, texte: texte.slice(0, 160) })
    if (liens.length >= 80) break
  }
  return { jsonld, metas, liens }
})()`

/** Liens d'une page déjà ouverte (onglet), lus dans un monde isolé. */
export async function liensDe(wc: Electron.WebContents): Promise<{ url: string; texte: string }[]> {
  const d = ((await wc.executeJavaScriptInIsolatedWorld(7008, [{ code: SCRIPT_DONNEES }]).catch(() => null)) ?? {}) as Partial<PageCloisonnee>
  return Array.isArray(d.liens) ? d.liens.filter((l) => l && typeof l.url === 'string' && estAdresseAutorisee(l.url)) : []
}

let sessionPreparee: Session | null = null

/** Session de l'agent : en mémoire seulement, tout refusé. Le bloqueur de pubs y est branché par l'appelant. */
export function sessionAgent(): Session {
  if (sessionPreparee) return sessionPreparee
  const s = session.fromPartition(PARTITION_AGENT)
  s.setPermissionRequestHandler((_wc, _p, rappel) => rappel(false))
  s.setPermissionCheckHandler(() => false)
  s.on('will-download', (e) => e.preventDefault())
  sessionPreparee = s
  return s
}

const MAX_SIMULTANES = 2
let enCours = 0
const attente: (() => void)[] = []

async function place(): Promise<() => void> {
  if (enCours >= MAX_SIMULTANES) await new Promise<void>((r) => attente.push(r))
  enCours++
  return () => {
    enCours--
    attente.shift()?.()
  }
}

/** Lit une page web dans le lecteur cloisonné. Lève une erreur lisible si la page ne charge pas. */
export async function lireCloisonne(url: string, delaiMax = 25_000): Promise<PageCloisonnee> {
  if (!estAdresseAutorisee(url)) throw new Error('Adresse non autorisée.')
  const liberer = await place()
  const f = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: {
      session: sessionAgent(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false,
      spellcheck: false
    }
  })
  const wc = f.webContents
  wc.setAudioMuted(true)
  wc.setWindowOpenHandler(() => ({ action: 'deny' }))
  wc.on('will-navigate', (e, cible) => {
    if (!estAdresseAutorisee(cible)) e.preventDefault()
  })
  try {
    await new Promise<void>((resolve, reject) => {
      const minuteur = setTimeout(() => (wc.getURL() ? resolve() : reject(new Error('La page met trop de temps à répondre.'))), delaiMax)
      wc.once('did-finish-load', () => {
        clearTimeout(minuteur)
        resolve()
      })
      wc.once('did-fail-load', (_e, code, desc, _u, principal) => {
        if (!principal || code === -3) return
        clearTimeout(minuteur)
        reject(new Error(`La page n'a pas pu être ouverte (${desc}).`))
      })
      void wc.loadURL(url).catch(() => undefined)
    })
    // le temps que les sites qui affichent leur contenu en JavaScript (prix, stock) le fassent
    await new Promise((r) => setTimeout(r, 2500))
    const lue = await lirePage(wc, wc.getURL())
    const d = ((await wc.executeJavaScriptInIsolatedWorld(7008, [{ code: SCRIPT_DONNEES }]).catch(() => null)) ?? {}) as Partial<PageCloisonnee>
    return {
      url: wc.getURL(),
      titre: lue.titre || wc.getTitle(),
      texte: lue.texte,
      jsonld: Array.isArray(d.jsonld) ? d.jsonld.filter((x): x is string => typeof x === 'string') : [],
      metas: d.metas && typeof d.metas === 'object' ? (d.metas as Record<string, string>) : {},
      liens: Array.isArray(d.liens) ? d.liens.filter((l) => l && typeof l.url === 'string' && estAdresseAutorisee(l.url)) : []
    }
  } finally {
    if (!f.isDestroyed()) f.destroy()
    liberer()
  }
}
