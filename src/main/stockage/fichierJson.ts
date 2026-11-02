/* Lecture et écriture de fichiers JSON dans le dossier de l'appli.
 * L'écriture est atomique (fichier temporaire puis renommage) : une coupure ne laisse jamais un fichier à moitié écrit. */
import { promises as fs, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
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
    await fs.writeFile(tmp, JSON.stringify(valeur), 'utf8')
    await fs.rename(tmp, chemin)
  })
  files.set(chemin, suivante.catch(() => undefined))
  return suivante
}

/** Version synchrone, pour la fermeture de l'appli (plus le temps d'attendre). */
export function ecrireJsonSync(chemin: string, valeur: unknown): void {
  mkdirSync(dirname(chemin), { recursive: true })
  const tmp = `${chemin}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(valeur), 'utf8')
  renameSync(tmp, chemin)
}

/**
 * Sauvegarde différée : plusieurs changements rapprochés (historique pendant la navigation) ne font qu'une écriture.
 * `vider()` écrit tout de suite ce qui attend (à la fermeture).
 */
export class SauvegardeDifferee {
  private minuteur: NodeJS.Timeout | null = null
  constructor(
    private readonly chemin: string,
    private readonly valeur: () => unknown,
    private readonly delai = 1500
  ) {}

  demander(): void {
    if (this.minuteur) return
    this.minuteur = setTimeout(() => {
      this.minuteur = null
      void ecrireJson(this.chemin, this.valeur()).catch(() => undefined)
    }, this.delai)
  }

  vider(): void {
    if (!this.minuteur) return
    clearTimeout(this.minuteur)
    this.minuteur = null
    try {
      ecrireJsonSync(this.chemin, this.valeur())
    } catch {
      /* disque plein ou dossier verrouillé : on n'empêche pas la fermeture */
    }
  }
}
