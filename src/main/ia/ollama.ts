/* Gestion d'Ollama, le moteur d'IA local : détection, installation, démarrage, téléchargement des modèles.
 * Tout passe par http://127.0.0.1:11434 : rien ne sort du PC, sauf le téléchargement d'Ollama et des modèles.
 *
 * Ollama ne tourne que quand le navigateur l'a activé : le navigateur lance lui-même le service (« ollama serve »,
 * sans fenêtre ni icône), l'arrête en se fermant, et ne laisse jamais Ollama démarrer avec Windows. */
import { app, net } from 'electron'
import { execFile, spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { createWriteStream, existsSync, promises as fs } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable, Transform } from 'node:stream'
import type { EtatOllama, TacheOllama } from '../../shared/ia'
import { cheminModele, versionDeSortieOllama } from '../../shared/composants'
import { lireNdjson, SuiviPull } from './ndjson'

export const API_OLLAMA = 'http://127.0.0.1:11434'
const URL_INSTALLEUR = 'https://ollama.com/download/OllamaSetup.exe'
/** Arguments silencieux de l'installeur (Inno Setup) : aucune fenêtre, pas de redémarrage. */
const ARGS_INSTALLEUR = ['/SP-', '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART']

const attendre = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Emplacements habituels d'Ollama sous Windows. */
function cheminsPossibles(): string[] {
  const local = process.env.LOCALAPPDATA ?? ''
  const prog = process.env.ProgramFiles ?? 'C:\\Program Files'
  return [join(local, 'Programs', 'Ollama', 'ollama.exe'), join(prog, 'Ollama', 'ollama.exe')]
}

export function trouverOllama(): string | null {
  return cheminsPossibles().find((p) => existsSync(p)) ?? null
}

/** Version d'Ollama installée, même quand le service ne tourne pas (« ollama --version », sans fenêtre). */
export function versionInstallee(): Promise<string | null> {
  const exe = trouverOllama()
  if (!exe) return Promise.resolve(null)
  return new Promise((r) =>
    execFile(exe, ['--version'], { windowsHide: true, timeout: 8000 }, (_err, sortie, erreurs) => r(versionDeSortieOllama(`${sortie ?? ''}
${erreurs ?? ''}`)))
  )
}

/** Manifeste d'un modèle installé (dossier des modèles d'Ollama, ou OLLAMA_MODELS), ou null. */
export async function manifesteLocal(nom: string): Promise<string | null> {
  const c = cheminModele(nom)
  if (!c) return null
  const racine = process.env.OLLAMA_MODELS || join(homedir(), '.ollama', 'models')
  return fs.readFile(join(racine, 'manifests', 'registry.ollama.ai', c.espace, c.modele, c.etiquette), 'utf8').catch(() => null)
}

/** Arrête un programme et tous ceux qu'il a lancés (Ollama lance un « runner » par modèle chargé). */
function arreterArbre(pid: number): void {
  spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true })
}

/**
 * Retire tout démarrage automatique d'Ollama avec Windows (raccourci dans le dossier Démarrage, clé Run).
 * L'installeur et l'appli Ollama peuvent en créer un : on le retire à chaque fois.
 */
export async function empecherDemarrageAuto(): Promise<void> {
  if (process.platform !== 'win32') return
  const demarrage = join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'Ollama.lnk')
  await fs.rm(demarrage, { force: true }).catch(() => undefined)
  spawnSync('reg', ['delete', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', 'Ollama', '/f'], { windowsHide: true })
}

/** Ferme l'appli Ollama (icône près de l'horloge) que l'installeur lance tout seul : c'est le navigateur qui gère le service. */
function fermerAppliOllama(): void {
  spawnSync('taskkill', ['/IM', 'ollama app.exe', '/T', '/F'], { windowsHide: true })
}

/** Vérifie que l'installeur téléchargé est bien signé par Ollama (signature Authenticode valide). */
export function verifierSignature(fichier: string): Promise<boolean> {
  return new Promise((resoudre) => {
    // le chemin passe par une variable d'environnement : jamais collé dans la commande
    const script =
      "$s = Get-AuthenticodeSignature -LiteralPath $env:SE7EN_FICHIER; " +
      "[pscustomobject]@{ etat = $s.Status.ToString(); sujet = [string]$s.SignerCertificate.Subject } | ConvertTo-Json -Compress"
    const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      env: { ...process.env, SE7EN_FICHIER: fichier },
      windowsHide: true
    })
    let sortie = ''
    p.stdout.on('data', (d) => (sortie += d))
    p.on('error', () => resoudre(false))
    p.on('close', () => {
      try {
        const r = JSON.parse(sortie) as { etat: string; sujet: string }
        resoudre(r.etat === 'Valid' && /\bO=Ollama\b|CN=Ollama/i.test(r.sujet))
      } catch {
        resoudre(false)
      }
    })
  })
}

export class Ollama extends EventEmitter<{ change: [EtatOllama] }> {
  private e: EtatOllama = { phase: 'verification', version: null, modeles: [], tache: null, erreur: null, lanceParNavigateur: false }
  private annulation: AbortController | null = null
  /** Le service Ollama lancé par le navigateur (null s'il tournait déjà, lancé par quelqu'un d'autre). */
  private serveur: ChildProcess | null = null

  etat(): EtatOllama {
    return this.e
  }

  private maj(partiel: Partial<EtatOllama>): void {
    this.e = { ...this.e, ...partiel }
    this.emit('change', this.e)
  }

  private majTache(t: TacheOllama | null): void {
    this.maj({ tache: t })
  }

  // ---------- état ----------

  /** Le service répond-il ? Renvoie sa version, ou null. */
  private async version(): Promise<string | null> {
    try {
      const r = await net.fetch(`${API_OLLAMA}/api/version`, { signal: AbortSignal.timeout(2000) })
      if (!r.ok) return null
      const j = (await r.json()) as { version?: string }
      return j.version ?? '?'
    } catch {
      return null
    }
  }

  private async listeModeles(): Promise<string[]> {
    try {
      const r = await net.fetch(`${API_OLLAMA}/api/tags`, { signal: AbortSignal.timeout(4000) })
      const j = (await r.json()) as { models?: { name?: string }[] }
      return (j.models ?? []).map((m) => m.name ?? '').filter(Boolean)
    } catch {
      return []
    }
  }

  async verifier(): Promise<EtatOllama> {
    const version = await this.version()
    const lanceParNavigateur = !!this.serveur
    if (version) this.maj({ phase: 'pret', version, modeles: await this.listeModeles(), lanceParNavigateur })
    else this.maj({ phase: trouverOllama() ? 'arrete' : 'absent', version: null, modeles: [], lanceParNavigateur })
    return this.e
  }

  /** Désactive l'IA : arrête le service s'il a été lancé par le navigateur (jamais un Ollama lancé par quelqu'un d'autre). */
  arreter(): void {
    const p = this.serveur
    if (!p?.pid) return
    this.serveur = null
    arreterArbre(p.pid)
    void this.verifier()
  }

  // ---------- démarrage ----------

  /** Active l'IA : lance le service Ollama (sans fenêtre), rattaché au navigateur, et attend qu'il réponde. */
  async demarrer(): Promise<void> {
    if (this.e.tache) return
    const exe = trouverOllama()
    if (!exe) return void this.maj({ phase: 'absent' })
    this.maj({ erreur: null })
    this.majTache({ type: 'demarrage', nom: 'Ollama', recus: 0, total: 0 })
    try {
      await empecherDemarrageAuto()
      if (!(await this.version())) {
        const p = spawn(exe, ['serve'], { stdio: 'ignore', windowsHide: true, env: { ...process.env, OLLAMA_HOST: '127.0.0.1:11434' } })
        this.serveur = p
        p.once('exit', () => {
          if (this.serveur !== p) return
          this.serveur = null
          void this.verifier()
        })
        if (!(await this.attendreService(30_000))) throw new Error("Ollama ne répond pas. Réessaie, ou redémarre le PC si ça continue.")
      }
    } catch (err) {
      this.maj({ erreur: (err as Error).message })
    } finally {
      this.majTache(null)
      await this.verifier()
    }
  }

  private async attendreService(delai: number): Promise<boolean> {
    const fin = Date.now() + delai
    while (Date.now() < fin) {
      if (await this.version()) return true
      await attendre(700)
    }
    return false
  }

  // ---------- installation ----------

  /** Télécharge l'installeur officiel, vérifie sa signature, l'installe sans fenêtre, puis démarre Ollama. */
  async installer(demarrerEnsuite = true): Promise<void> {
    if (this.e.tache) return
    this.maj({ erreur: null })
    this.annulation = new AbortController()
    const dossier = join(tmpdir(), 'se7en-browser')
    const fichier = join(dossier, 'OllamaSetup.exe')
    try {
      await fs.mkdir(dossier, { recursive: true })
      // 1. téléchargement, avec progression
      const tache: TacheOllama = { type: 'installeur', nom: 'OllamaSetup.exe', recus: 0, total: 0 }
      this.majTache(tache)
      const rep = await net.fetch(URL_INSTALLEUR, { signal: this.annulation.signal })
      if (!rep.ok || !rep.body) throw new Error(`Téléchargement impossible (erreur ${rep.status}).`)
      tache.total = Number(rep.headers.get('content-length') ?? 0)
      let dernier = 0
      const compteur = new Transform({
        transform: (morceau: Buffer, _enc, suite) => {
          tache.recus += morceau.length
          if (Date.now() - dernier > 250) {
            dernier = Date.now()
            this.majTache({ ...tache })
          }
          suite(null, morceau)
        }
      })
      await pipeline(Readable.fromWeb(rep.body as never), compteur, createWriteStream(fichier), { signal: this.annulation.signal })

      // 2. on n'exécute que l'installeur authentique d'Ollama
      this.majTache({ type: 'installation', nom: 'Ollama', recus: 0, total: 0 })
      if (!(await verifierSignature(fichier))) throw new Error("L'installeur téléchargé n'est pas signé par Ollama : installation annulée.")

      // 3. installation silencieuse (dans le dossier de l'utilisateur, sans droits administrateur)
      const code = await new Promise<number | null>((resoudre, rejeter) => {
        const p = spawn(fichier, ARGS_INSTALLEUR, { windowsHide: true })
        p.on('error', rejeter)
        p.on('close', resoudre)
      })
      if (code !== 0) throw new Error(`L'installation d'Ollama a échoué (code ${code}).`)
      this.majTache(null)

      // 4. l'installeur lance l'appli Ollama et peut l'inscrire au démarrage de Windows :
      //    on la ferme, on retire le démarrage automatique, et c'est le navigateur qui lance le service.
      fermerAppliOllama()
      await empecherDemarrageAuto()
      this.majTache(null)
      if (demarrerEnsuite) await this.demarrer()
    } catch (err) {
      const annule = this.annulation?.signal.aborted
      this.maj({ erreur: annule ? null : (err as Error).message })
    } finally {
      this.annulation = null
      this.majTache(null)
      await fs.rm(fichier, { force: true }).catch(() => undefined)
      await this.verifier()
    }
  }

  /**
   * Met Ollama à jour avec le dernier installeur officiel (seulement quand une version plus récente a été trouvée) :
   * le service lancé par le navigateur est arrêté le temps de l'installation, puis relancé.
   */
  async mettreAJour(): Promise<void> {
    if (this.e.tache || !trouverOllama()) return
    const p = this.serveur
    if (p?.pid) {
      this.serveur = null
      arreterArbre(p.pid)
    }
    await this.installer(!!p)
  }

  // ---------- modèles ----------

  /** Télécharge les modèles un par un, avec la progression de chacun. */
  async telecharger(noms: string[]): Promise<void> {
    if (this.e.tache || this.e.phase !== 'pret') return
    this.maj({ erreur: null })
    this.annulation = new AbortController()
    try {
      for (const nom of noms) {
        const suivi = new SuiviPull()
        this.majTache({ type: 'modele', nom, recus: 0, total: 0 })
        const rep = await net.fetch(`${API_OLLAMA}/api/pull`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: nom, stream: true }),
          signal: this.annulation.signal
        })
        if (!rep.ok || !rep.body) throw new Error(`Ollama refuse le téléchargement de ${nom} (erreur ${rep.status}).`)
        let erreur: string | null = null
        let dernier = 0
        await lireNdjson(rep.body, (o) => {
          const ligne = o as { error?: string; status?: string; digest?: string; total?: number; completed?: number }
          if (ligne.error) erreur = ligne.error
          suivi.maj(ligne)
          if (Date.now() - dernier > 250) {
            dernier = Date.now()
            this.majTache({ type: 'modele', nom, recus: suivi.recus, total: suivi.total })
          }
        })
        if (erreur) throw new Error(/not found|file does not exist/i.test(erreur) ? `Le modèle « ${nom} » n'existe pas dans Ollama.` : erreur)
        this.maj({ modeles: await this.listeModeles() })
      }
    } catch (err) {
      const annule = this.annulation?.signal.aborted
      this.maj({ erreur: annule ? null : (err as Error).message })
    } finally {
      this.annulation = null
      this.majTache(null)
      await this.verifier()
    }
  }

  /** Arrête le téléchargement en cours (installeur ou modèle). L'installation elle-même ne s'interrompt pas. */
  annuler(): void {
    this.annulation?.abort()
  }
}
