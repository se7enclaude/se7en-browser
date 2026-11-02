/* Mise à jour automatique de se7en Browser, depuis les releases GitHub (même source que Seventh OS).
 * 1. latest.json de la dernière release : version, nom de l'installeur, empreinte SHA-256 et taille ;
 * 2. téléchargement en arrière-plan, puis vérification de la taille et de l'empreinte ;
 * 3. installation silencieuse quand l'utilisateur ferme le navigateur (ou tout de suite s'il clique « Redémarrer »).
 * Seulement dans la version installée (pas en développement). */
import { app, net } from 'electron'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { createWriteStream, existsSync, mkdirSync, promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { plusRecente, type EtatMiseAJour } from '../shared/miseAJour'

const DEPOT = 'se7enclaude/se7en-browser'
const MANIFESTE = `https://github.com/${DEPOT}/releases/latest/download/latest.json`
const RE_NOM = /^se7en-Browser-Setup-[\d.]+\.exe$/

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

  /** Cherche une nouvelle version ; si les mises à jour automatiques sont activées, la télécharge aussitôt. */
  async verifier(): Promise<EtatMiseAJour> {
    if (!app.isPackaged || this.e.phase === 'recherche' || this.e.phase === 'telechargement' || this.e.phase === 'prete') return this.e
    this.maj({ phase: 'recherche', erreur: undefined })
    try {
      const r = await net.fetch(MANIFESTE, { cache: 'no-store' })
      if (!r.ok) throw new Error(`GitHub a répondu ${r.status}.`)
      const m = (await r.json()) as Manifeste
      if (typeof m?.version !== 'string' || !m.setup || !RE_NOM.test(m.setup.name) || !/^[0-9a-f]{64}$/.test(m.setup.sha256) || !(m.setup.size > 0))
        throw new Error('Fichier de mise à jour invalide.')
      if (!plusRecente(m.version, app.getVersion())) return this.maj({ phase: 'aucune', verifiee: Date.now() })
      this.maj({ phase: 'aucune', version: m.version, notes: m.notes?.slice(0, 500), verifiee: Date.now() })
      if (this.automatique()) await this.telecharger(m)
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
    const r = await net.fetch(url)
    if (!r.ok || !r.body) throw new Error(`Téléchargement impossible (${r.status}).`)
    const hash = createHash('sha256')
    const sortie = createWriteStream(chemin)
    let recus = 0
    let dernier = 0
    const lecteur = r.body.getReader()
    try {
      for (;;) {
        const { done, value } = await lecteur.read()
        if (done) break
        hash.update(value)
        recus += value.length
        if (!sortie.write(value)) await new Promise<void>((ok) => sortie.once('drain', () => ok()))
        if (Date.now() - dernier > 500) {
          dernier = Date.now()
          this.maj({ progression: Math.min(1, recus / m.setup.size) })
        }
      }
    } finally {
      await new Promise<void>((ok) => sortie.end(ok))
    }
    if (recus !== m.setup.size || hash.digest('hex') !== m.setup.sha256) {
      await fs.rm(chemin, { force: true })
      throw new Error("Le fichier téléchargé est abîmé (empreinte différente) : il n'a pas été installé.")
    }
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

async function empreinte(chemin: string): Promise<string> {
  return createHash('sha256').update(await fs.readFile(chemin)).digest('hex')
}
