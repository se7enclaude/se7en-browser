/* Extensions du Chrome Web Store : téléchargées depuis le serveur officiel de Google (le même que Chrome),
 * décompressées dans le dossier de l'appli, puis chargées dans la session des pages web seulement.
 * Jamais dans l'interface, le panneau IA, les pages internes ni la session de l'agent (lecteur cloisonné) :
 * une extension ne peut ni lire tes conversations avec l'IA, ni piloter l'IA. */
import { execFile } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { existsSync, mkdirSync, promises as fs, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { app, net, type Session } from 'electron'
import { EXTENSIONS_VERIFIEES, NAVIGATEURS_SOURCES, nomManifeste, RE_ID_EXTENSION, type ExtensionInstallee, type ExtensionTrouvee } from '../../shared/extensions'
import { lireJson, SauvegardeDifferee } from '../stockage/fichierJson'
import { zipDeCrx } from './crx'

interface Manifeste {
  name?: string
  version?: string
  description?: string
  default_locale?: string
  icons?: Record<string, string>
  action?: { default_popup?: string }
  browser_action?: { default_popup?: string }
  options_page?: string
  options_ui?: { page?: string }
}

function lireManifeste(dossier: string): { m: Manifeste; nom: string; description: string } | null {
  const m = lireJson(join(dossier, 'manifest.json')) as Manifeste | undefined
  if (!m || typeof m.name !== 'string') return null
  const locales = [m.default_locale, 'fr', 'en'].filter((x): x is string => !!x)
  let messages: Record<string, { message?: string }> | null = null
  for (const l of ['fr', ...locales]) {
    const brut = lireJson(join(dossier, '_locales', l, 'messages.json'))
    if (brut && typeof brut === 'object') {
      messages = brut as Record<string, { message?: string }>
      break
    }
  }
  return { m, nom: nomManifeste(m.name, messages).slice(0, 80), description: nomManifeste(m.description ?? '', messages).slice(0, 200) }
}

function iconeDe(dossier: string, m: Manifeste): string | null {
  const tailles = Object.keys(m.icons ?? {}).map(Number).sort((a, b) => b - a)
  const f = tailles.length ? m.icons![String(tailles[0])] : null
  if (!f || !/\.png$/i.test(f)) return null
  try {
    return `data:image/png;base64,${readFileSync(join(dossier, f)).toString('base64')}`
  } catch {
    return null
  }
}

/** Décompresse une archive zip avec l'outil intégré à Windows (tar.exe), sans rien installer. */
function decompresser(zip: string, cible: string): Promise<void> {
  const tar = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
  return new Promise((r, rej) => execFile(tar, ['-xf', zip, '-C', cible], { windowsHide: true, timeout: 60_000 }, (err) => (err ? rej(new Error('Décompression impossible.')) : r())))
}

export class ServiceExtensions extends EventEmitter<{ change: [ExtensionInstallee[]] }> {
  private liste: ExtensionInstallee[]
  private readonly racine: string
  private readonly sauvegarde: SauvegardeDifferee

  constructor(
    dossier: string,
    private readonly session: Session
  ) {
    super()
    this.racine = join(dossier, 'extensions')
    const brut = lireJson(join(dossier, 'extensions.json'))
    this.liste = Array.isArray(brut) ? (brut as ExtensionInstallee[]).filter((e) => e && RE_ID_EXTENSION.test(e.id) && existsSync(join(this.racine, e.id))) : []
    this.sauvegarde = new SauvegardeDifferee(join(dossier, 'extensions.json'), () => this.liste, 300)
  }

  lister(): ExtensionInstallee[] {
    return this.liste
  }

  /** Charge les extensions activées (à chaque démarrage : Electron ne les garde pas). */
  async charger(): Promise<void> {
    for (const e of this.liste) if (e.activee) await this.session.extensions.loadExtension(join(this.racine, e.id)).catch(() => undefined)
  }

  async installer(id: string): Promise<ExtensionInstallee | { erreur: string }> {
    if (!RE_ID_EXTENSION.test(id)) return { erreur: "Ce n'est pas un identifiant d'extension du Chrome Web Store." }
    try {
      const url =
        'https://clients2.google.com/service/update2/crx?response=redirect&acceptformat=crx2,crx3' +
        `&prodversion=${process.versions.chrome}&x=${encodeURIComponent(`id=${id}&installsource=ondemand&uc`)}`
      const rep = await net.fetch(url)
      if (!rep.ok) return { erreur: rep.status === 204 || rep.status === 404 ? "Extension introuvable sur le Chrome Web Store." : `Le Chrome Web Store a répondu ${rep.status}.` }
      const zip = zipDeCrx(Buffer.from(await rep.arrayBuffer()))
      const dossier = join(this.racine, id)
      const tmp = join(app.getPath('temp'), `se7en-ext-${id}.zip`)
      await fs.writeFile(tmp, zip)
      if (this.session.extensions.getExtension(id)) this.session.extensions.removeExtension(id)
      await fs.rm(dossier, { recursive: true, force: true })
      mkdirSync(dossier, { recursive: true })
      await decompresser(tmp, dossier)
      await fs.rm(tmp, { force: true })
      // les dossiers commençant par « _ » (hors _locales) sont réservés : Chrome les refuse, Electron aussi
      await fs.rm(join(dossier, '_metadata'), { recursive: true, force: true })
      const lu = lireManifeste(dossier)
      if (!lu) throw new Error('Manifeste de l’extension illisible.')
      // mise à jour : l'extension garde son état (activée ou non) et sa date d'installation
      const avant = this.liste.find((x) => x.id === id)
      const activee = avant?.activee ?? true
      if (activee) await this.session.extensions.loadExtension(dossier)
      const e: ExtensionInstallee = {
        id,
        nom: lu.nom,
        version: lu.m.version ?? '',
        description: lu.description,
        activee,
        verifiee: EXTENSIONS_VERIFIEES.some((v) => v.id === id),
        popup: lu.m.action?.default_popup ?? lu.m.browser_action?.default_popup ?? null,
        options: lu.m.options_ui?.page ?? lu.m.options_page ?? null,
        icone: iconeDe(dossier, lu.m),
        installee: avant?.installee ?? Date.now()
      }
      this.liste = [e, ...this.liste.filter((x) => x.id !== id)]
      this.changer()
      return e
    } catch (err) {
      return { erreur: err instanceof Error ? `Installation impossible : ${err.message}` : 'Installation impossible.' }
    }
  }

  async activer(id: string, activee: boolean): Promise<void> {
    const e = this.liste.find((x) => x.id === id)
    if (!e) return
    e.activee = activee
    if (activee) await this.session.extensions.loadExtension(join(this.racine, id)).catch(() => undefined)
    else if (this.session.extensions.getExtension(id)) this.session.extensions.removeExtension(id)
    this.changer()
  }

  async supprimer(id: string): Promise<void> {
    if (!this.liste.some((x) => x.id === id)) return
    if (this.session.extensions.getExtension(id)) this.session.extensions.removeExtension(id)
    await fs.rm(join(this.racine, id), { recursive: true, force: true }).catch(() => undefined)
    this.liste = this.liste.filter((x) => x.id !== id)
    this.changer()
  }

  /** Extensions installées dans les autres navigateurs du PC (identifiant et nom seulement). */
  trouverAilleurs(): ExtensionTrouvee[] {
    const res: ExtensionTrouvee[] = []
    const vues = new Set<string>()
    for (const n of NAVIGATEURS_SOURCES) {
      const base = n.racine === 'local' ? process.env.LOCALAPPDATA : process.env.APPDATA
      const dossier = base ? join(base, n.dossier) : ''
      if (!dossier || !existsSync(dossier)) continue
      for (const id of readdirSync(dossier)) {
        if (!RE_ID_EXTENSION.test(id) || vues.has(`${n.nom}:${id}`)) continue
        try {
          const versions = readdirSync(join(dossier, id)).filter((v) => statSync(join(dossier, id, v)).isDirectory())
          const derniere = versions.sort().at(-1)
          const lu = derniere ? lireManifeste(join(dossier, id, derniere)) : null
          if (!lu) continue
          vues.add(`${n.nom}:${id}`)
          res.push({ id, nom: lu.nom, navigateur: n.nom, verifiee: EXTENSIONS_VERIFIEES.some((v) => v.id === id), dejaInstallee: this.liste.some((x) => x.id === id) })
        } catch {
          /* dossier illisible : on passe */
        }
      }
    }
    return res
  }

  private changer(): void {
    this.sauvegarde.demander()
    this.emit('change', this.liste)
  }
}
