/* Lecture et écriture de fichiers JSON dans le dossier de l'appli.
 * L'écriture est atomique (fichier temporaire puis renommage) : une coupure ne laisse jamais un fichier à moitié écrit. */
import { promises as fs, readFileSync } from 'node:fs'
import { dirname } from 'node:path'

export function lireJson(chemin: string): unknown {
  try {
    return JSON.parse(readFileSync(chemin, 'utf8'))
  } catch {
    return undefined
  }
}

// Une file par fichier : deux écritures rapprochées ne se marchent pas dessus.
const files = new Map<string, Promise<void>>()

export function ecrireJson(chemin: string, valeur: unknown): Promise<void> {
  const precedente = files.get(chemin) ?? Promise.resolve()
  const suivante = precedente.then(async () => {
    await fs.mkdir(dirname(chemin), { recursive: true })
    const tmp = `${chemin}.${process.pid}.tmp`
    await fs.writeFile(tmp, JSON.stringify(valeur, null, 2), 'utf8')
    await fs.rename(tmp, chemin)
  })
  files.set(chemin, suivante.catch(() => undefined))
  return suivante
}
