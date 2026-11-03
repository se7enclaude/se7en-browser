/* VPN du navigateur : Tor (logiciel officiel du Tor Project, livré avec le navigateur) lancé seulement quand
 * l'utilisateur l'active. Les pages web (sessions normale et privée) passent alors par son proxy SOCKS local ;
 * les noms de domaine sont résolus par Tor, et WebRTC ne peut plus révéler l'adresse réelle.
 * Le chat se7en, l'IA locale et les widgets n'y passent pas (session par défaut du main).
 * Si Tor s'arrête pendant que le VPN est actif, les pages ne chargent plus plutôt que de sortir sans protection. */
import { app, webContents, type Session } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer, Socket } from 'node:net'
import { join } from 'node:path'
import { configTor, progressionTor, type EtatVpn } from '../shared/vpn'

/** Dossier de Tor : resources/tor une fois installé, dist/cache/tor en développement (node tools/tor.js). */
function dossierTor(): string {
  return app.isPackaged ? join(process.resourcesPath, 'tor') : join(app.getAppPath(), 'dist', 'cache', 'tor')
}

function portLibre(): Promise<number> {
  return new Promise((ok, ko) => {
    const s = createServer()
    s.once('error', ko)
    s.listen(0, '127.0.0.1', () => {
      const p = (s.address() as { port: number }).port
      s.close(() => ok(p))
    })
  })
}

export class Vpn extends EventEmitter<{ etat: [EtatVpn] }> {
  private tor: ChildProcess | null = null
  private ports = { socks: 0, controle: 0 }
  private valeur: EtatVpn = { phase: 'arrete', progression: 0, pays: '' }
  private readonly donnees: string

  constructor(
    dossier: string,
    private readonly sessions: Session[]
  ) {
    super()
    this.donnees = join(dossier, 'tor')
    // les pages ouvertes pendant que le VPN est actif ne peuvent pas révéler l'adresse réelle par WebRTC
    app.on('web-contents-created', (_e, wc) => {
      if (this.proxyActif() && this.sessions.includes(wc.session)) wc.setWebRTCIPHandlingPolicy('disable_non_proxied_udp')
    })
    app.on('will-quit', () => this.tor?.kill())
  }

  etat(): EtatVpn {
    return this.valeur
  }

  disponible(): boolean {
    return existsSync(join(dossierTor(), 'tor', 'tor.exe'))
  }

  private changer(partiel: Partial<EtatVpn>): void {
    this.valeur = { ...this.valeur, ...partiel }
    this.emit('etat', this.valeur)
  }

  private proxyActif(): boolean {
    return this.valeur.phase !== 'arrete'
  }

  /** Active le VPN (ou change de pays s'il l'est déjà). */
  async activer(pays: string): Promise<void> {
    if (!this.disponible()) return this.changer({ phase: 'erreur', message: 'Tor est absent de cette installation.' })
    this.arreterTor()
    this.changer({ phase: 'connexion', progression: 0, pays, ip: undefined, message: undefined })
    try {
      this.ports = { socks: await portLibre(), controle: await portLibre() }
    } catch {
      return this.changer({ phase: 'erreur', message: 'Impossible de réserver un port local pour Tor.' })
    }
    // dès maintenant, plus rien ne sort en direct : les pages attendent que Tor soit prêt
    await this.brancherProxy(true)

    mkdirSync(this.donnees, { recursive: true })
    const dossier = dossierTor()
    const torrc = join(this.donnees, 'torrc')
    writeFileSync(torrc, configTor({ portSocks: this.ports.socks, portControle: this.ports.controle, donnees: this.donnees, geoip: join(dossier, 'data', 'geoip'), pays }))
    const tor = spawn(join(dossier, 'tor', 'tor.exe'), ['-f', torrc, '--defaults-torrc', 'NUL'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    this.tor = tor
    let reste = ''
    tor.stdout?.setEncoding('utf8').on('data', (morceau: string) => {
      const lignes = (reste + morceau).split(/\r?\n/)
      reste = lignes.pop() ?? ''
      for (const l of lignes) {
        const p = progressionTor(l)
        if (p === null || this.tor !== tor) continue
        if (p < 100) this.changer({ progression: p })
        else void this.pret()
      }
    })
    tor.on('exit', () => {
      if (this.tor !== tor) return
      this.tor = null
      if (this.valeur.phase !== 'arrete') this.changer({ phase: 'erreur', message: 'Tor s’est arrêté. Les pages ne chargent plus, pour ne pas sortir sans protection.' })
    })
    tor.on('error', () => this.tor === tor && this.changer({ phase: 'erreur', message: 'Tor n’a pas pu démarrer.' }))
  }

  private async pret(): Promise<void> {
    this.changer({ phase: 'actif', progression: 100 })
    // les connexions ouvertes avant (en direct ou par l'ancien circuit) sont fermées
    for (const s of this.sessions) await s.closeAllConnections()
    await this.verifierIp()
  }

  /** Demande au Tor Project quelle adresse voient les sites (et si c'est bien une sortie Tor). */
  private async verifierIp(essais = 4): Promise<void> {
    for (let i = 0; i < essais && this.valeur.phase === 'actif'; i++) {
      try {
        const r = await this.sessions[0].fetch('https://check.torproject.org/api/ip', { signal: AbortSignal.timeout(20_000) })
        const d = (await r.json()) as { IsTor?: boolean; IP?: string }
        if (this.valeur.phase === 'actif') this.changer({ ip: d.IsTor ? d.IP : undefined, message: d.IsTor ? undefined : 'Connexion non confirmée par le Tor Project.' })
        return
      } catch {
        // le nouveau circuit n'est pas encore prêt : on réessaie un peu plus tard (le VPN, lui, marche)
        await new Promise((ok) => setTimeout(ok, 4000))
      }
    }
  }

  /** Nouvelle identité : Tor change de circuit (et donc d'adresse vue par les sites). */
  async nouvelleIdentite(): Promise<void> {
    if (this.valeur.phase !== 'actif') return
    try {
      const cookie = readFileSync(join(this.donnees, 'control_auth_cookie')).toString('hex')
      await new Promise<void>((ok, ko) => {
        const c = new Socket()
        c.setTimeout(5000, () => (c.destroy(), ko(new Error('délai'))))
        c.once('error', ko)
        c.connect(this.ports.controle, '127.0.0.1', () => c.write(`AUTHENTICATE ${cookie}\r\nSIGNAL NEWNYM\r\nQUIT\r\n`))
        let rep = ''
        c.on('data', (d) => (rep += d.toString()))
        c.on('close', () => (/250 OK[\s\S]*250 OK/.test(rep) ? ok() : ko(new Error(rep))))
      })
      for (const s of this.sessions) await s.closeAllConnections()
      this.changer({ ip: undefined })
      // Tor applique la nouvelle identité en quelques secondes
      setTimeout(() => void this.verifierIp(), 3000)
    } catch {
      this.changer({ message: 'Nouvelle identité impossible pour l’instant.' })
    }
  }

  async desactiver(): Promise<void> {
    this.arreterTor()
    this.changer({ phase: 'arrete', progression: 0, ip: undefined, message: undefined })
    await this.brancherProxy(false)
  }

  private arreterTor(): void {
    const t = this.tor
    this.tor = null
    t?.kill()
  }

  private async brancherProxy(actif: boolean): Promise<void> {
    for (const s of this.sessions) {
      // les adresses locales (localhost) restent en direct : elles ne sortent pas du PC
      await s.setProxy(actif ? { proxyRules: `socks5://127.0.0.1:${this.ports.socks}` } : { mode: 'direct' })
      await s.closeAllConnections()
    }
    for (const wc of webContents.getAllWebContents())
      if (!wc.isDestroyed() && this.sessions.includes(wc.session)) wc.setWebRTCIPHandlingPolicy(actif ? 'disable_non_proxied_udp' : 'default')
  }
}
