/* Lecture du contenu d'un onglet pour l'IA.
 * Le script tourne dans un « monde isolé » : la page ne peut pas modifier les fonctions qu'il utilise.
 * Il ne garde que le texte VISIBLE : le texte caché (blanc sur blanc, minuscule, transparent, hors de l'écran) est la
 * cachette préférée des injections de prompt. Ce qu'il renvoie reste une donnée non fiable (voir prompts.ts). */
import type { WebContents } from 'electron'
import type { PageLue } from './prompts'

/** Identifiant du monde isolé réservé à se7en Browser (n'importe quel nombre > 0, différent de celui des extensions). */
const MONDE_ISOLE = 7007
const MAX_TEXTE = 80_000

/* Les éléments au texte invisible sont masqués un instant (display:none), le temps de lire innerText, puis remis
 * exactement comme avant. Tout se passe dans la même tâche JavaScript : la page n'est jamais redessinée entre-temps. */
const SCRIPT = `(() => {
  const couleur = (c) => { const m = /rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?/.exec(c || ''); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null }
  const fond = (el) => {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const c = couleur(getComputedStyle(e).backgroundColor)
      if (c && c[3] > 0.5) return c
    }
    return [255, 255, 255, 1]
  }
  const largeur = Math.max(document.documentElement.scrollWidth, innerWidth)
  const invisible = (el) => {
    const s = getComputedStyle(el)
    if (s.display === 'none' || s.visibility === 'hidden') return false // déjà ignorés par innerText
    if (parseFloat(s.opacity) < 0.1 || parseFloat(s.fontSize) < 5) return true
    if (s.clipPath && /inset\\((4\\d|50)%|circle\\(0/.test(s.clipPath)) return true
    if (/rect\\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\\)/.test(s.clip)) return true
    const r = el.getBoundingClientRect()
    if ((r.width < 2 || r.height < 2) && s.overflow !== 'visible') return true
    if (r.right < -50 || r.left > largeur + 50 || r.bottom + scrollY < -50) return true
    const t = couleur(s.color)
    if (t && t[3] < 0.1) return true
    const f = fond(el)
    if (t && Math.abs(t[0] - f[0]) + Math.abs(t[1] - f[1]) + Math.abs(t[2] - f[2]) < 40) return true
    return false
  }
  const caches = []
  let vus = 0
  const marcheur = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT)
  const parents = new Set()
  while (marcheur.nextNode() && vus < 20000) {
    const n = marcheur.currentNode
    vus++
    if (n.nodeValue && n.nodeValue.trim() && n.parentElement) parents.add(n.parentElement)
  }
  for (const el of parents) {
    if (caches.length > 2000) break
    try {
      if (invisible(el)) caches.push([el, el.style.getPropertyValue('display'), el.style.getPropertyPriority('display')])
    } catch (e) {}
  }
  for (const [el] of caches) el.style.setProperty('display', 'none', 'important')
  let texte = ''
  try {
    const nettoyer = (t) => (t || '').replace(/[ \\t]+/g, ' ').replace(/\\n\\s*\\n\\s*\\n+/g, '\\n\\n').trim()
    const principal = document.querySelector('main, article, [role="main"]')
    const racine = principal && principal.innerText && principal.innerText.length > 600 ? principal : document.body
    texte = nettoyer(racine ? racine.innerText : '').slice(0, ${MAX_TEXTE})
  } finally {
    for (const [el, valeur, priorite] of caches) {
      if (valeur) el.style.setProperty('display', valeur, priorite)
      else el.style.removeProperty('display')
    }
  }
  return { titre: document.title || '', selection: String(window.getSelection() || '').slice(0, 5000), texte, caches: caches.length }
})()`

export async function lirePage(wc: WebContents, url: string): Promise<PageLue> {
  try {
    // le résultat est celui de la dernière expression du script : ici, un objet
    const v = (await wc.executeJavaScriptInIsolatedWorld(MONDE_ISOLE, [{ code: SCRIPT }])) as
      | { titre?: unknown; selection?: unknown; texte?: unknown; caches?: unknown }
      | undefined
    return {
      titre: typeof v?.titre === 'string' ? v.titre : wc.getTitle(),
      url,
      selection: typeof v?.selection === 'string' ? v.selection : '',
      texte: typeof v?.texte === 'string' ? v.texte.slice(0, MAX_TEXTE) : '',
      textesCaches: typeof v?.caches === 'number' ? v.caches : 0
    }
  } catch {
    return { titre: wc.getTitle(), url, texte: '' }
  }
}

/** Capture de la page (JPEG, 1280 px de large au plus) pour le modèle vision, quand il y a peu de texte à lire. */
export async function capturerPage(wc: WebContents): Promise<string | null> {
  try {
    let image = await wc.capturePage()
    if (image.isEmpty()) return null
    const { width } = image.getSize()
    if (width > 1280) image = image.resize({ width: 1280, quality: 'good' })
    return image.toJPEG(75).toString('base64')
  } catch {
    return null
  }
}
