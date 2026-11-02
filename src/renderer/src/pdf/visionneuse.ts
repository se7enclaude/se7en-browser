/* Visionneuse PDF de se7en Browser (pdf.js).
 * Elle tourne dans un onglet isolé, comme une page web : pas d'accès au navigateur, pas de script du PDF exécuté.
 * Les pages sont dessinées au fil du défilement ; une couche de texte invisible permet de sélectionner et copier. */
import { getDocument, GlobalWorkerOptions, TextLayer, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist'
import urlTravailleur from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import 'pdfjs-dist/web/pdf_viewer.css'
import './visionneuse.css'

GlobalWorkerOptions.workerSrc = urlTravailleur

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T
const conteneur = $<HTMLElement>('pages')
const champPage = $<HTMLInputElement>('page')
const message = $<HTMLDivElement>('message')

const parametres = new URLSearchParams(location.search)
const idDoc = parametres.get('doc') ?? ''
// le PDF est servi sur la même origine que la visionneuse (se7en-pdf://app/doc/…)
const urlDoc = `/doc/${encodeURIComponent(idDoc)}`

let doc: PDFDocumentProxy
let echelle = 1
/** Vrai tant que l'utilisateur n'a pas choisi de zoom : la page suit la largeur de l'onglet. */
let ajusterLargeur = true
const ZOOMS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4]

interface Page {
  n: number
  el: HTMLDivElement
  largeur: number
  hauteur: number
  dessinee: number | null
}
const pages: Page[] = []

function afficherMessage(texte: string): void {
  message.textContent = texte
  message.hidden = false
}

// ---------- dessin d'une page ----------

const enCours = new Set<number>()
async function dessiner(p: Page): Promise<void> {
  if (p.dessinee === echelle || enCours.has(p.n)) return
  enCours.add(p.n)
  const echelleDemandee = echelle
  try {
    const page: PDFPageProxy = await doc.getPage(p.n)
    const vue = page.getViewport({ scale: echelleDemandee })
    const ratio = window.devicePixelRatio || 1
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(vue.width * ratio)
    canvas.height = Math.floor(vue.height * ratio)
    canvas.style.width = `${vue.width}px`
    canvas.style.height = `${vue.height}px`
    await page.render({ canvas, viewport: vue, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined }).promise

    // couche de texte : sélection et copie
    const texte = document.createElement('div')
    texte.className = 'textLayer'
    await new TextLayer({ textContentSource: await page.getTextContent(), container: texte, viewport: vue }).render()

    // liens vers Internet : ils s'ouvrent dans un nouvel onglet
    const liens = document.createElement('div')
    liens.className = 'liens-pdf'
    for (const a of await page.getAnnotations({ intent: 'display' })) {
      const url = (a as { url?: string }).url
      if (a.subtype !== 'Link' || !url || !/^https?:\/\//i.test(url)) continue
      const r = a.rect as number[]
      const [x1, y1] = vue.convertToViewportPoint(r[0], r[1]) as number[]
      const [x2, y2] = vue.convertToViewportPoint(r[2], r[3]) as number[]
      const lien = document.createElement('a')
      lien.href = url
      lien.target = '_blank'
      lien.rel = 'noopener noreferrer'
      lien.title = url
      Object.assign(lien.style, { left: `${Math.min(x1, x2)}px`, top: `${Math.min(y1, y2)}px`, width: `${Math.abs(x2 - x1)}px`, height: `${Math.abs(y2 - y1)}px` })
      liens.append(lien)
    }

    if (echelleDemandee !== echelle) return // zoom changé pendant le dessin : on recommencera
    p.el.replaceChildren(canvas, texte, liens)
    p.el.style.setProperty('--scale-factor', String(echelleDemandee))
    p.dessinee = echelleDemandee
    page.cleanup()
  } catch {
    /* page illisible : on laisse la feuille vide */
  } finally {
    enCours.delete(p.n)
  }
}

const observateur = new IntersectionObserver(
  (entrees) => {
    for (const e of entrees) if (e.isIntersecting) void dessiner(pages[Number((e.target as HTMLElement).dataset.n) - 1])
  },
  { root: conteneur, rootMargin: '1200px 0px' }
)

/** Taille de chaque feuille selon le zoom ; les pages visibles sont redessinées. */
function dimensionner(): void {
  if (ajusterLargeur && pages.length) {
    const dispo = conteneur.clientWidth - 48
    echelle = Math.max(0.4, Math.min(3, dispo / pages[0].largeur))
  }
  $('zoom').textContent = `${Math.round(echelle * 100)} %`
  for (const p of pages) {
    p.el.style.width = `${p.largeur * echelle}px`
    p.el.style.height = `${p.hauteur * echelle}px`
    if (p.dessinee !== null && p.dessinee !== echelle) p.dessinee = null
    observateur.unobserve(p.el)
    observateur.observe(p.el)
  }
}

function zoomer(sens: 1 | -1): void {
  const i = ZOOMS.findIndex((z) => z >= echelle - 0.001)
  const suivant = sens > 0 ? ZOOMS.find((z) => z > echelle + 0.001) : [...ZOOMS].reverse().find((z) => z < echelle - 0.001)
  if (!suivant && i < 0) return
  // garde la même position relative dans le document
  const position = conteneur.scrollTop / Math.max(1, conteneur.scrollHeight)
  ajusterLargeur = false
  echelle = suivant ?? echelle
  dimensionner()
  conteneur.scrollTop = position * conteneur.scrollHeight
}

// ---------- chargement ----------

let octets: Uint8Array | null = null

async function ouvrir(motDePasse?: string): Promise<void> {
  try {
    // la page récupère le fichier elle-même : le serveur ne le donne qu'à la visionneuse
    if (!octets) {
      const rep = await fetch(urlDoc)
      if (!rep.ok) throw new Error('introuvable')
      octets = new Uint8Array(await rep.arrayBuffer())
    }
    const chargement = getDocument({
      // pdf.js garde la main sur le tableau qu'on lui donne : on lui passe une copie (utile pour le mot de passe)
      data: octets.slice(),
      password: motDePasse,
      cMapUrl: '/pdfjs/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: '/pdfjs/standard_fonts/',
      wasmUrl: '/pdfjs/wasm/',
      iccUrl: '/pdfjs/iccs/',
      enableXfa: false
    })
    doc = await chargement.promise
  } catch (err) {
    const nom = (err as { name?: string }).name
    if (nom === 'PasswordException') return demanderMotDePasse(!!motDePasse)
    afficherMessage("Ce PDF n'a pas pu être ouvert : il est peut-être abîmé.")
    return
  }

  const meta = await doc.getMetadata().catch(() => null)
  const titre = (meta?.info as { Title?: string } | undefined)?.Title?.trim()
  const nomFichier = decodeURIComponent(parametres.get('nom') ?? '') || titre || 'Document PDF'
  document.title = titre || nomFichier
  $('nom').textContent = document.title
  $<HTMLAnchorElement>('enregistrer').href = urlDoc
  $<HTMLAnchorElement>('enregistrer').download = /\.pdf$/i.test(nomFichier) ? nomFichier : `${nomFichier}.pdf`
  $('total').textContent = `/ ${doc.numPages}`

  // tailles de toutes les pages (sans les dessiner) pour que la barre de défilement soit juste
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const vue = page.getViewport({ scale: 1 })
    const el = document.createElement('div')
    el.className = 'page-pdf'
    el.dataset.n = String(n)
    pages.push({ n, el, largeur: vue.width, hauteur: vue.height, dessinee: null })
    conteneur.append(el)
  }
  dimensionner()
}

function demanderMotDePasse(erreur: boolean): void {
  message.hidden = false
  message.replaceChildren()
  const form = document.createElement('form')
  form.className = 'mot-de-passe'
  const titre = document.createElement('p')
  titre.textContent = erreur ? 'Mot de passe incorrect. Réessaie :' : 'Ce PDF est protégé par un mot de passe :'
  const champ = Object.assign(document.createElement('input'), { type: 'password', autofocus: true })
  const bouton = Object.assign(document.createElement('button'), { type: 'submit', textContent: 'Ouvrir' })
  form.append(titre, champ, bouton)
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    message.hidden = true
    void ouvrir(champ.value)
  })
  message.append(form)
  champ.focus()
}

// ---------- barre ----------

$('plus').addEventListener('click', () => zoomer(1))
$('moins').addEventListener('click', () => zoomer(-1))
$('zoom').addEventListener('click', () => {
  ajusterLargeur = true
  dimensionner()
})
champPage.addEventListener('change', () => {
  const n = Math.min(Math.max(1, Number(champPage.value) || 1), pages.length)
  pages[n - 1]?.el.scrollIntoView({ block: 'start' })
})
conteneur.addEventListener('scroll', () => {
  // page affichée : la première dont le bas dépasse le milieu de l'écran
  const milieu = conteneur.scrollTop + conteneur.clientHeight / 3
  const p = pages.find((x) => x.el.offsetTop + x.el.offsetHeight > milieu)
  if (p && document.activeElement !== champPage) champPage.value = String(p.n)
})
window.addEventListener('resize', () => ajusterLargeur && dimensionner())
window.addEventListener(
  'wheel',
  (e) => {
    if (!e.ctrlKey) return
    e.preventDefault()
    zoomer(e.deltaY < 0 ? 1 : -1)
  },
  { passive: false }
)
window.addEventListener('keydown', (e) => {
  if (!e.ctrlKey) return
  if (e.key === '+' || e.key === '=') (e.preventDefault(), zoomer(1))
  if (e.key === '-') (e.preventDefault(), zoomer(-1))
  if (e.key === '0') (e.preventDefault(), (ajusterLargeur = true), dimensionner())
})

if (!/^[0-9a-f-]{36}$/.test(idDoc)) afficherMessage('Document introuvable.')
else void ouvrir()
