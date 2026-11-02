/* Formulaires PDF : trouver les champs (avec le texte écrit à côté), puis les remplir.
 *   - analyse : pdf.js donne la position de chaque champ et du texte de la page → on en déduit son libellé ;
 *   - remplissage : pdf-lib écrit les valeurs et redessine les champs. Le formulaire reste modifiable. */
import { promises as fs } from 'node:fs'
import { PDFDocument, PDFTextField, StandardFonts, type PDFFont } from 'pdf-lib'
import type { ChampFormulaire, ValeurARemplir } from '../../shared/formulaire'

interface MorceauTexte {
  texte: string
  x: number
  y: number
  largeur: number
  hauteur: number
}

/** Le texte écrit juste à gauche du champ (sur la même ligne), sinon juste au-dessus. */
export function trouverLibelle(rect: number[], morceaux: MorceauTexte[]): string {
  const [x1, y1, x2, y2] = [Math.min(rect[0], rect[2]), Math.min(rect[1], rect[3]), Math.max(rect[0], rect[2]), Math.max(rect[1], rect[3])]
  const milieu = (y1 + y2) / 2
  const tolerance = Math.max(6, (y2 - y1) / 2)
  const ligne = (m: MorceauTexte): number => m.y + m.hauteur / 2

  // à gauche, sur la même ligne, à moins de 250 points
  const gauche = morceaux.filter((m) => Math.abs(ligne(m) - milieu) <= tolerance && m.x + m.largeur <= x1 + 4 && x1 - (m.x + m.largeur) < 250)
  if (gauche.length) {
    return gauche
      .sort((a, b) => a.x - b.x)
      .map((m) => m.texte)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(-80)
  }
  // au-dessus, dans les 28 points, et qui chevauche le champ horizontalement
  const dessus = morceaux.filter((m) => m.y >= y2 - 2 && m.y <= y2 + 28 && m.x < x2 && m.x + m.largeur > x1 - 20)
  if (dessus.length) {
    const yProche = Math.min(...dessus.map((m) => m.y))
    return dessus
      .filter((m) => Math.abs(m.y - yProche) < 4)
      .sort((a, b) => a.x - b.x)
      .map((m) => m.texte)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80)
  }
  return ''
}

/** Champs de texte du formulaire, avec leur libellé ; `autres` compte les champs d'un autre type. */
export async function analyserChamps(chemin: string): Promise<{ champs: ChampFormulaire[]; autres: number }> {
  const octets = new Uint8Array(await fs.readFile(chemin))

  // pdf-lib : types, longueurs maximales, lecture seule
  const docLib = await PDFDocument.load(octets.slice(), { ignoreEncryption: true, updateMetadata: false })
  const infos = new Map<string, { texte: boolean; max: number | null; lectureSeule: boolean; valeur: string }>()
  for (const f of docLib.getForm().getFields()) {
    const texte = f instanceof PDFTextField
    infos.set(f.getName(), {
      texte,
      max: texte ? (f.getMaxLength() ?? null) : null,
      lectureSeule: f.isReadOnly(),
      valeur: texte ? (f.getText() ?? '') : ''
    })
  }

  // pdf.js : positions des champs et du texte, pour trouver les libellés
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  // verbosity 0 : seulement les erreurs (les polices ne servent pas ici, inutile d'avertir)
  const chargement = pdfjs.getDocument({ data: octets, disableFontFace: true, useSystemFonts: false, enableXfa: false, verbosity: 0 })
  const doc = await chargement.promise
  const champs: ChampFormulaire[] = []
  const vus = new Set<string>()
  try {
    for (let n = 1; n <= Math.min(doc.numPages, 100); n++) {
      const page = await doc.getPage(n)
      const annotations = (await page.getAnnotations()) as {
        fieldType?: string
        fieldName?: string
        rect?: number[]
        alternativeText?: string
      }[]
      const widgets = annotations.filter((a) => a.fieldType === 'Tx' && a.fieldName && a.rect)
      if (!widgets.length) continue
      const contenu = await page.getTextContent()
      const morceaux: MorceauTexte[] = (contenu.items as { str?: string; transform?: number[]; width?: number; height?: number }[])
        .filter((i) => i.str?.trim() && i.transform)
        .map((i) => ({ texte: i.str!, x: i.transform![4], y: i.transform![5], largeur: i.width ?? 0, hauteur: i.height || Math.abs(i.transform![3]) || 10 }))
      for (const w of widgets) {
        const nom = w.fieldName!
        const info = infos.get(nom)
        if (vus.has(nom) || !info?.texte || info.lectureSeule) continue
        vus.add(nom)
        const infoBulle = w.alternativeText?.trim() ?? ''
        champs.push({
          nom,
          libelle: infoBulle || trouverLibelle(w.rect!, morceaux) || nom,
          page: n,
          valeurActuelle: info.valeur,
          maxLongueur: info.max
        })
      }
      page.cleanup()
    }
  } finally {
    await chargement.destroy()
  }
  const autres = [...infos.values()].filter((i) => !i.texte).length
  return { champs, autres }
}

/** Remplace les caractères que la police standard du PDF ne sait pas écrire (émojis…). */
function texteEcrivable(texte: string, police: PDFFont): string {
  let res = ''
  for (const c of texte) {
    try {
      police.widthOfTextAtSize(c, 10)
      res += c
    } catch {
      res += '?'
    }
  }
  return res
}

/** Écrit les valeurs dans un nouveau fichier (l'original n'est pas modifié). Renvoie le nombre de champs remplis. */
export async function remplirChamps(source: string, valeurs: ValeurARemplir[], sortie: string): Promise<number> {
  const doc = await PDFDocument.load(await fs.readFile(source), { updateMetadata: false })
  const form = doc.getForm()
  const police = await doc.embedFont(StandardFonts.Helvetica)
  let rempli = 0
  for (const { nom, valeur } of valeurs) {
    try {
      const champ = form.getTextField(nom)
      if (champ.isReadOnly()) continue
      const max = champ.getMaxLength()
      const texte = texteEcrivable(valeur, police)
      champ.setText(max ? texte.slice(0, max) : texte)
      rempli++
    } catch {
      /* champ introuvable ou d'un autre type : ignoré */
    }
  }
  form.updateFieldAppearances(police)
  await fs.writeFile(sortie, await doc.save())
  return rempli
}
