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
