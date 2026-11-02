/* Coffre personnel, chiffré avec le compte Windows de l'utilisateur (safeStorage → DPAPI).
 * Le fichier coffre.bin n'est lisible que par ce compte, sur ce PC. Rien n'est jamais envoyé sur Internet,
 * et les valeurs ne sont jamais données à l'IA. */
import { safeStorage } from 'electron'
import { randomUUID } from 'node:crypto'
import { promises as fs, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CHAMPS_COFFRE, COFFRE_VIDE, type Coffre, type EtatCoffre } from '../../shared/coffre'

const CLES = new Set(CHAMPS_COFFRE.map((c) => c.cle))
const MAX_VALEUR = 500

/** Ne garde que des champs connus, en texte, de taille raisonnable. */
export function nettoyerCoffre(brut: unknown): Coffre {
  const c: Coffre = { valeurs: {}, perso: [] }
  if (!brut || typeof brut !== 'object') return c
  const o = brut as { valeurs?: unknown; perso?: unknown }
  if (o.valeurs && typeof o.valeurs === 'object') {
    for (const [k, v] of Object.entries(o.valeurs as Record<string, unknown>)) {
      if (CLES.has(k) && typeof v === 'string' && v.trim()) c.valeurs[k] = v.slice(0, MAX_VALEUR)
    }
  }
  if (Array.isArray(o.perso)) {
    for (const p of o.perso.slice(0, 50)) {
      if (!p || typeof p.libelle !== 'string' || typeof p.valeur !== 'string' || !p.libelle.trim()) continue
      const id = typeof p.id === 'string' && /^[\w-]{1,40}$/.test(p.id) ? p.id : randomUUID()
      c.perso.push({ id, libelle: p.libelle.slice(0, 80), valeur: p.valeur.slice(0, MAX_VALEUR) })
    }
  }
  return c
}

export class CoffreChiffre {
  private readonly chemin: string
  private contenu: Coffre = COFFRE_VIDE

  constructor(dossier: string) {
    this.chemin = join(dossier, 'coffre.bin')
    if (!this.disponible()) return
    try {
      this.contenu = nettoyerCoffre(JSON.parse(safeStorage.decryptString(readFileSync(this.chemin))))
    } catch {
      this.contenu = COFFRE_VIDE // pas encore de coffre, ou fichier d'un autre compte Windows
    }
  }

  disponible(): boolean {
    return safeStorage.isEncryptionAvailable()
  }

  etat(): EtatCoffre {
    return { disponible: this.disponible(), coffre: this.contenu }
  }

  lire(): Coffre {
    return this.contenu
  }

  async sauver(brut: unknown): Promise<EtatCoffre> {
    if (!this.disponible()) throw new Error("Windows ne permet pas de chiffrer le coffre sur ce compte.")
    const c = nettoyerCoffre(brut)
    const tmp = `${this.chemin}.tmp`
    await fs.writeFile(tmp, safeStorage.encryptString(JSON.stringify(c)))
    await fs.rename(tmp, this.chemin)
    this.contenu = c
    return this.etat()
  }
}
