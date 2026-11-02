/* Registre des PDF ouverts : chaque document reçoit un identifiant impossible à deviner.
 * Un PDF venu d'Internet est d'abord téléchargé dans un dossier temporaire (vidé au démarrage et à la fermeture) ;
 * un PDF du PC est lu directement à sa place. */
import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { mkdirSync, rmSync } from 'node:fs'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'

export interface DocumentPdf {
  id: string
  /** Fichier sur le disque. */
  chemin: string
  /** Adresse affichée dans la barre : celle du PDF sur Internet, ou file:///… pour un fichier du PC. */
  url: string
  nom: string
  temporaire: boolean
}

export class DocumentsPdf {
  private readonly docs = new Map<string, DocumentPdf>()
  readonly dossierTemporaire = join(app.getPath('temp'), 'se7en-browser', 'pdf')

  constructor() {
    this.vider()
    mkdirSync(this.dossierTemporaire, { recursive: true })
  }

  /** Chemin temporaire pour un PDF en cours de téléchargement. */
  cheminTemporaire(): string {
    return join(this.dossierTemporaire, `${randomUUID()}.pdf`)
  }

  ajouter(chemin: string, url: string, nom: string, temporaire: boolean): DocumentPdf {
    const doc: DocumentPdf = { id: randomUUID(), chemin, url, nom: nom || basename(chemin), temporaire }
    this.docs.set(doc.id, doc)
    return doc
  }

  ajouterLocal(chemin: string): DocumentPdf {
    return this.ajouter(chemin, pathToFileURL(chemin).href, basename(chemin), false)
  }

  lire(id: string): DocumentPdf | undefined {
    return this.docs.get(id)
  }

  /** Supprime les fichiers temporaires (au démarrage et à la fermeture). */
  vider(): void {
    rmSync(this.dossierTemporaire, { recursive: true, force: true })
  }
}
