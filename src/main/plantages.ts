/* Rapports de plantage, gardés sur ce PC (dossier « plantages » du profil), jamais envoyés tout seuls.
 * L'utilisateur les voit dans les Paramètres, et peut les copier ou les envoyer à un ami s'il le veut.
 * Ce qui est noté : la version, Windows, le type de problème et l'erreur technique. Jamais d'adresse de page
 * ni de contenu ; le nom du dossier utilisateur est remplacé par « ~ ». */
import { app, type WebContents } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir, release } from 'node:os'
import { join } from 'node:path'
import type { RapportPlantage, TypePlantage } from '../shared/plantages'

const MAX_RAPPORTS = 20

export class Plantages {
  private readonly dossier = join(app.getPath('userData'), 'plantages')
  private readonly marqueur = join(app.getPath('userData'), 'en-cours.json')
  private readonly fichierVu = join(app.getPath('userData'), 'plantages-vus.json')
  /** Une même erreur n'est notée qu'une fois par lancement. */
  private readonly dejaNotees = new Set<string>()

  constructor(private readonly estInterface: (wc: WebContents) => boolean) {}

  demarrer(): void {
    mkdirSync(this.dossier, { recursive: true })
    // le lancement précédent n'a pas fermé proprement : plantage, ou PC éteint brutalement
    if (existsSync(this.marqueur)) {
      let version = app.getVersion()
      try {
        version = (JSON.parse(readFileSync(this.marqueur, 'utf8')) as { version?: string }).version ?? version
      } catch {
        // marqueur abîmé : on garde la version actuelle
      }
      this.ajouter('fermeture-inattendue', "se7en Browser s'est fermé sans passer par la fermeture normale (plantage, ou PC éteint brutalement).", '', version)
    }
    writeFileSync(this.marqueur, JSON.stringify({ version: app.getVersion(), depuis: Date.now() }))
    app.on('will-quit', () => {
      try {
        unlinkSync(this.marqueur)
      } catch {
        // déjà supprimé
      }
    })

    process.on('uncaughtException', (e) => this.ajouter('erreur', `Erreur du navigateur : ${e.message}`, e.stack ?? ''))
    process.on('unhandledRejection', (r) => {
      const e = r instanceof Error ? r : new Error(String(r))
      this.ajouter('erreur', `Erreur du navigateur : ${e.message}`, e.stack ?? '')
    })
    app.on('render-process-gone', (_e, wc, d) => {
      if (d.reason === 'clean-exit') return
      const ui = this.estInterface(wc)
      this.ajouter(ui ? 'interface' : 'page', ui ? "L'interface du navigateur a planté." : 'Une page a planté.', `Raison : ${d.reason} (code ${d.exitCode})`)
    })
    app.on('child-process-gone', (_e, d) => {
      if (d.reason === 'clean-exit' || d.reason === 'killed') return
      this.ajouter('processus', `Un processus interne s'est arrêté (${d.type}${d.name ? ` · ${d.name}` : ''}).`, `Raison : ${d.reason} (code ${d.exitCode})`)
    })
  }

  /** Erreur JavaScript de l'interface, signalée par elle-même. */
  signalerInterface(message: string, pile: string): void {
    this.ajouter('erreur', `Erreur de l'interface : ${message.slice(0, 300)}`, pile.slice(0, 4000))
  }

  lister(): { rapports: RapportPlantage[]; nonVus: number } {
    const rapports: RapportPlantage[] = []
    try {
      for (const f of readdirSync(this.dossier)) {
        if (!f.endsWith('.json')) continue
        try {
          rapports.push(JSON.parse(readFileSync(join(this.dossier, f), 'utf8')) as RapportPlantage)
        } catch {
          // fichier abîmé : ignoré
        }
      }
    } catch {
      // pas encore de dossier
    }
    rapports.sort((a, b) => b.date - a.date)
    const vu = this.dernierVu()
    return { rapports, nonVus: rapports.filter((r) => r.date > vu).length }
  }

  marquerVus(): void {
    writeFileSync(this.fichierVu, JSON.stringify({ vu: Date.now() }))
  }

  effacer(id?: string): void {
    for (const r of this.lister().rapports) if (!id || r.id === id) rmSync(join(this.dossier, `${r.id}.json`), { force: true })
  }

  private dernierVu(): number {
    try {
      return (JSON.parse(readFileSync(this.fichierVu, 'utf8')) as { vu?: number }).vu ?? 0
    } catch {
      return 0
    }
  }

  private ajouter(type: TypePlantage, resume: string, details: string, version = app.getVersion()): void {
    const cle = `${type}|${resume}`
    if (this.dejaNotees.has(cle)) return
    this.dejaNotees.add(cle)
    const anonyme = (t: string): string => t.split(homedir()).join('~')
    const rapport: RapportPlantage = {
      id: randomUUID(),
      date: Date.now(),
      version,
      systeme: `Windows ${release()} · ${process.arch} · Electron ${process.versions.electron}`,
      type,
      resume: anonyme(resume),
      details: anonyme(details)
    }
    try {
      mkdirSync(this.dossier, { recursive: true })
      writeFileSync(join(this.dossier, `${rapport.id}.json`), JSON.stringify(rapport, null, 1))
      // on ne garde que les plus récents
      for (const vieux of this.lister().rapports.slice(MAX_RAPPORTS)) rmSync(join(this.dossier, `${vieux.id}.json`), { force: true })
    } catch {
      // disque plein ou dossier en lecture seule : tant pis, le navigateur continue
    }
  }
}
