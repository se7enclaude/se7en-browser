/* Mise à jour automatique de se7en Browser, depuis les releases GitHub (même source que Seventh OS).
 * 1. latest.json de la dernière release : version, nom de l'installeur, empreinte SHA-256 et taille ;
 * 2. téléchargement en arrière-plan, puis vérification de la taille et de l'empreinte ;
 * 3. installation silencieuse quand l'utilisateur ferme le navigateur (ou tout de suite s'il clique « Redémarrer »).
 * Seulement dans la version installée (pas en développement). */
import { app, net } from 'electron'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { createReadStream, createWriteStream, existsSync, mkdirSync, promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as FluxWeb } from 'node:stream/web'
import { plusRecente, type EtatMiseAJour } from '../shared/miseAJour'

const DEPOT = 'se7enclaude/se7en-browser'
const MANIFESTE = `https://github.com/${DEPOT}/releases/latest/download/latest.json`
const RE_NOM = /^se7en-Browser-Setup-[\d.]+\.exe$/
/** Sans aucune donnée reçue pendant ce délai, la requête est abandonnée (connexion figée). */
const INACTIVITE_MS = 60_000
const DELAI_MANIFESTE_MS = 20_000

interface Manifeste {
  version: string
  notes?: string
  setup: { name: string; sha256: string; size: number }
}

export class MiseAJour extends EventEmitter<{ etat: [EtatMiseAJour] }> {
  private e: EtatMiseAJour = { phase: 'aucune', actuelle: app.getVersion() }
  private installeur: string | null = null
  private installee = false

  constructor(private readonly automatique: () => boolean) {
    super()
  }

  etat(): EtatMiseAJour {
    return this.e
  }

  /** Cherche une nouvelle version et la télécharge aussitôt si l'utilisateur l'a demandé (bouton)
   * ou si les mises à jour automatiques sont activées. */
  async verifier(manuel = false): Promise<EtatMiseAJour> {
    if (!app.isPackaged || this.e.phase === 'recherche' || this.e.phase === 'telechargement' || this.e.phase === 'prete') return this.e
    this.maj({ phase: 'recherche', erreur: undefined })
    try {
      const r = await net.fetch(MANIFESTE, { cache: 'no-store', signal: AbortSignal.timeout(DELAI_MANIFESTE_MS) })
      if (!r.ok) throw new Error(`GitHub a répondu ${r.status}.`)
      const m = (await r.json()) as Manifeste
      if (typeof m?.version !== 'string' || !m.setup || !RE_NOM.test(m.setup.name) || !/^[0-9a-f]{64}$/.test(m.setup.sha256) || !(m.setup.size > 0))
        throw new Error('Fichier de mise à jour invalide.')
      if (!plusRecente(m.version, app.getVersion())) return this.maj({ phase: 'aucune', verifiee: Date.now() })
      this.maj({ phase: 'aucune', version: m.version, notes: m.notes?.slice(0, 500), verifiee: Date.now() })
      if (manuel || this.automatique()) await this.telecharger(m)
    } catch (err) {
      this.maj({ phase: 'erreur', erreur: (err as Error).message || 'Mise à jour impossible.', verifiee: Date.now() })
    }
    return this.e
  }

  /** « Redémarrer pour mettre à jour » : installe tout de suite puis rouvre le navigateur. */
  installerMaintenant(): void {
    if (!this.installeur || this.e.phase !== 'prete') return
    this.lancer(true)
    app.quit()
  }

  /** À la fermeture du navigateur : la mise à jour téléchargée s'installe sans rien demander. */
  installerALaFermeture(): void {
    if (this.installeur && this.e.phase === 'prete' && !this.installee) this.lancer(false)
  }

  private async telecharger(m: Manifeste): Promise<void> {
    const dossier = join(tmpdir(), 'se7en-browser-maj')
    mkdirSync(dossier, { recursive: true })
    const chemin = join(dossier, m.setup.name)
    // déjà téléchargé (et intact) lors d'une session précédente
    if (existsSync(chemin) && (await empreinte(chemin)) === m.setup.sha256) {
      this.installeur = chemin
      return void this.maj({ phase: 'prete', progression: 1 })
    }
    this.maj({ phase: 'telechargement', progression: 0 })
    const url = `https://github.com/${DEPOT}/releases/download/v${encodeURIComponent(m.version)}/${encodeURIComponent(m.setup.name)}`
    // écrit dans un « .part » renommé seulement une fois vérifié : jamais d'installeur à moitié écrit sous le vrai nom
    const partiel = `${chemin}.part`
    const hash = createHash('sha256')
    let recus = 0
    let dernier = 0
    // délai d'inactivité : relancé à chaque morceau reçu, il coupe une connexion figée au lieu de rester bloqué
    const controle = new AbortController()
    let minuteur: NodeJS.Timeout | undefined
    const relancer = (): void => {
      clearTimeout(minuteur)
      minuteur = setTimeout(() => controle.abort(), INACTIVITE_MS)
    }
    relancer()
    try {
      const r = await net.fetch(url, { signal: controle.signal })
      if (!r.ok || !r.body) throw new Error(`Téléchargement impossible (${r.status}).`)
      const suivi = new Transform({
        transform: (morceau: Buffer, _enc, fini) => {
          relancer()
          recus += morceau.length
          if (recus > m.setup.size) return fini(new Error("Le fichier téléchargé est plus gros que prévu : il n'a pas été installé."))
          hash.update(morceau)
          if (Date.now() - dernier > 500) {
            dernier = Date.now()
            this.maj({ progression: Math.min(1, recus / m.setup.size) })
          }
          fini(null, morceau)
        }
      })
      // pipeline : une erreur d'écriture (disque plein…) ou de réseau rejette la promesse au lieu de tout figer
      await pipeline(Readable.fromWeb(r.body as unknown as FluxWeb<Uint8Array>), suivi, createWriteStream(partiel), { signal: controle.signal })
    } catch (err) {
      await fs.rm(partiel, { force: true }).catch(() => undefined)
      if (controle.signal.aborted) throw new Error('Téléchargement interrompu : le serveur ne répond plus.')
      throw err
    } finally {
      clearTimeout(minuteur)
    }
    if (recus !== m.setup.size || hash.digest('hex') !== m.setup.sha256) {
      await fs.rm(partiel, { force: true })
      throw new Error("Le fichier téléchargé est abîmé (empreinte différente) : il n'a pas été installé.")
    }
    await fs.rm(chemin, { force: true })
    await fs.rename(partiel, chemin)
    this.installeur = chemin
    this.maj({ phase: 'prete', progression: 1 })
  }

  private lancer(rouvrir: boolean): void {
    if (!this.installeur) return
    this.installee = true
    const args = ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART']
    if (rouvrir) args.push('/RELAUNCH=1')
    spawn(this.installeur, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref()
  }

  private maj(partiel: Partial<EtatMiseAJour>): EtatMiseAJour {
    this.e = { ...this.e, ...partiel }
    this.emit('etat', this.e)
    return this.e
  }
}

/** SHA-256 d'un fichier, lu par morceaux (l'installeur n'est jamais chargé entier en mémoire). */
async function empreinte(chemin: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const morceau of createReadStream(chemin)) hash.update(morceau as Buffer)
  return hash.digest('hex')
}
