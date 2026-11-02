/* Lecture des réponses en flux d'Ollama : un objet JSON par ligne (NDJSON). */

/** Découpe un flux de texte en lignes complètes, même quand une ligne arrive en plusieurs morceaux. */
export class DecoupeurLignes {
  private reste = ''

  ajouter(morceau: string): string[] {
    this.reste += morceau
    const lignes = this.reste.split('\n')
    this.reste = lignes.pop() ?? ''
    return lignes.filter((l) => l.trim())
  }

  /** Ce qui reste à la fin du flux (dernière ligne sans retour). */
  finir(): string[] {
    const r = this.reste.trim()
    this.reste = ''
    return r ? [r] : []
  }
}

/** Lit un flux NDJSON et appelle `rappel` pour chaque objet. Une ligne illisible est ignorée. */
export async function lireNdjson(corps: ReadableStream<Uint8Array>, rappel: (objet: unknown) => void): Promise<void> {
  const lecteur = corps.getReader()
  const decodeur = new TextDecoder()
  const decoupe = new DecoupeurLignes()
  const traiter = (lignes: string[]): void => {
    for (const l of lignes) {
      try {
        rappel(JSON.parse(l))
      } catch {
        /* ligne coupée ou invalide : on passe */
      }
    }
  }
  for (;;) {
    const { done, value } = await lecteur.read()
    if (done) break
    traiter(decoupe.ajouter(decodeur.decode(value, { stream: true })))
  }
  traiter(decoupe.ajouter(decodeur.decode()))
  traiter(decoupe.finir())
}

/** Progression d'un « ollama pull » : un modèle est fait de plusieurs couches, chacune avec sa taille. */
export class SuiviPull {
  private readonly couches = new Map<string, { total: number; recus: number }>()
  statut = ''

  maj(ligne: { status?: string; digest?: string; total?: number; completed?: number }): void {
    if (ligne.status) this.statut = ligne.status
    if (ligne.digest && typeof ligne.total === 'number') {
      this.couches.set(ligne.digest, { total: ligne.total, recus: ligne.completed ?? 0 })
    }
  }

  get total(): number {
    let t = 0
    for (const c of this.couches.values()) t += c.total
    return t
  }

  get recus(): number {
    let r = 0
    for (const c of this.couches.values()) r += Math.min(c.recus, c.total)
    return r
  }
}
