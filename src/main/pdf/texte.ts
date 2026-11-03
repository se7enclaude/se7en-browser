/* Texte d'un PDF, pour l'IA : extrait dans le processus principal avec pdf.js (version Node), page par page.
 * Le PDF n'exécute rien ici : pdf.js ne fait que lire son texte. */
import { promises as fs } from 'node:fs'

const MAX_PAGES = 300
const MAX_TEXTE = 200_000
const cache = new Map<string, string>()

/** Assemble les morceaux de texte d'une page : pdf.js signale les fins de ligne avec hasEOL. */
export function assemblerTexte(items: { str?: string; hasEOL?: boolean }[]): string {
  let t = ''
  for (const it of items) {
    if (typeof it.str !== 'string') continue
    t += it.str
    if (it.hasEOL) t += '\n'
    else if (it.str && !t.endsWith(' ')) t += ' '
  }
  return t.replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim()
}

export async function lireTextePdf(chemin: string): Promise<string> {
  const deja = cache.get(chemin)
  if (deja !== undefined) return deja
  // pdf.js est un module ES : chargé à la demande (le processus principal est en CommonJS)
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const donnees = new Uint8Array(await fs.readFile(chemin))
  const chargement = pdfjs.getDocument({ data: donnees, disableFontFace: true, useSystemFonts: false, enableXfa: false, verbosity: 0 })
  const doc = await chargement.promise
  try {
    const pages: string[] = []
    let total = 0
    for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES) && total < MAX_TEXTE; n++) {
      const page = await doc.getPage(n)
      const contenu = await page.getTextContent()
      const texte = assemblerTexte(contenu.items as { str?: string; hasEOL?: boolean }[])
      if (texte) {
        pages.push(`[Page ${n}]\n${texte}`)
        total += texte.length
      }
      page.cleanup()
    }
    const resultat = pages.join('\n\n').slice(0, MAX_TEXTE)
    cache.set(chemin, resultat)
    return resultat
  } finally {
    await chargement.destroy()
  }
}

const sansAccents = (t: string): string => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const MOTS_VIDES = new Set(
  (
    'le la les un une des de du un est sont il elle on je tu nous vous ils elles ne pas plus se sa son ses leur leurs mon ma mes ton ta tes ' +
    'que qui quoi quel quelle quels quelles comment pourquoi combien dans sur pour par avec sans ces cette page pages pdf document the and for'
  ).split(' ')
)

/**
 * PDF trop long pour le modèle : on garde les pages qui répondent le mieux à la question (mots en commun, en tenant
 * compte de leur rareté), dans l'ordre du document et toujours avec leur marque « [Page n] » pour que l'IA les cite.
 * Pour un résumé (aucun mot utile dans la question), on garde le début et des pages réparties sur tout le document.
 */
export function extraitPdf(texte: string, question: string, budget: number): string {
  if (texte.length <= budget) return texte
  const pages = texte.split(/(?=\[Page \d+\]\n)/).filter((p) => p.trim())
  if (pages.length <= 1) return texte.slice(0, budget)
  const mots = [...new Set(sansAccents(question).match(/[a-z0-9]{3,}/g) ?? [])].filter((m) => !MOTS_VIDES.has(m))
  const textes = pages.map(sansAccents)
  let ordre: number[]
  if (mots.length) {
    // rareté : un mot présent dans peu de pages compte plus
    const idf = mots.map((m) => Math.log(1 + pages.length / (1 + textes.filter((t) => t.includes(m)).length)))
    const scores = textes.map((t) => mots.reduce((s, m, k) => s + Math.min(5, t.split(m).length - 1) * idf[k], 0) / Math.sqrt(1 + t.length / 3000))
    ordre = scores
      .map((s, i) => [s, i] as const)
      .sort((a, b) => b[0] - a[0] || a[1] - b[1])
      .map(([, i]) => i)
  } else {
    const pas = Math.max(1, Math.floor(pages.length / 12))
    ordre = [...new Set([0, 1, ...pages.map((_, i) => i).filter((i) => i % pas === 0), ...pages.map((_, i) => i)])]
  }
  const gardees: number[] = []
  let taille = 0
  for (const i of ordre) {
    if (taille + pages[i].length > budget) {
      if (!gardees.length) gardees.push(i)
      continue
    }
    gardees.push(i)
    taille += pages[i].length
  }
  gardees.sort((a, b) => a - b)
  return (
    `(Document de ${pages.length} pages : seules les pages les plus utiles pour la question sont jointes.)\n\n` +
    gardees.map((i) => pages[i].slice(0, budget)).join('\n\n')
  )
}
