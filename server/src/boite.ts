/* La « boîte » d'un utilisateur (Durable Object) : garde ses connexions directes ouvertes (un PC = une connexion),
 * pousse les évènements (message reçu, demande d'ami, ami en ligne) et prévient ses amis quand il se déconnecte.
 * Elle relaie aussi, sans rien garder, les petits signaux envoyés par le PC : « est en train d'écrire »
 * et « naviguer ensemble » (adresse de la page partagée, position dans la page). Seulement vers un ami
 * ou les membres d'un groupe dont l'utilisateur fait partie. */
import { DurableObject } from 'cloudflare:workers'
import type { Env } from './index'

/** Signaux relayés par seconde au plus, par boîte (le reste est ignoré). */
const MAX_PAR_SECONDE = 20
const ACTIONS_ENSEMBLE = ['invite', 'accepte', 'refuse', 'url', 'defile', 'main', 'fin']

export class Boite extends DurableObject<Env> {
  private fenetre = { debut: 0, n: 0 }

  /** Connexion directe (WebSocket) du PC de l'utilisateur ; la liste de ses amis arrive avec elle. */
  async fetch(requete: Request): Promise<Response> {
    const url = new URL(requete.url)
    if (url.pathname === '/connecter') {
      const paire = new WebSocketPair()
      // « hibernation » : la connexion reste ouverte sans faire tourner (ni facturer) l'objet entre deux messages
      this.ctx.acceptWebSocket(paire[1])
      await this.ctx.storage.put('amis', (requete.headers.get('X-Amis') ?? '').split(',').filter(Boolean))
      await this.ctx.storage.put('moi', requete.headers.get('X-Moi') ?? '')
      return new Response(null, { status: 101, webSocket: paire[0] })
    }
    return new Response('introuvable', { status: 404 })
  }

  /** Envoie un évènement à toutes les connexions de l'utilisateur. */
  async pousser(evenement: unknown): Promise<void> {
    const texte = JSON.stringify(evenement)
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(texte)
      } catch {
        /* connexion déjà fermée */
      }
    }
  }

  async enLigne(): Promise<boolean> {
    return this.ctx.getWebSockets().length > 0
  }

  /** « ping » pour garder la connexion ; sinon un signal à relayer (JSON). */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (message === 'ping') return ws.send('pong')
    if (typeof message !== 'string' || message.length > 4000) return
    const maintenant = Date.now()
    if (maintenant - this.fenetre.debut > 1000) this.fenetre = { debut: maintenant, n: 0 }
    if (++this.fenetre.n > MAX_PAR_SECONDE) return
    let o: Record<string, unknown>
    try {
      o = JSON.parse(message) as Record<string, unknown>
    } catch {
      return
    }
    const moi = (await this.ctx.storage.get<string>('moi')) ?? ''
    if (!moi) return

    if (o.type === 'ecrit') {
      if (typeof o.groupe === 'string') {
        const membres = await this.membres(o.groupe)
        if (!membres.includes(moi)) return
        await Promise.allSettled(membres.filter((x) => x !== moi).map((id) => this.boite(id).pousser({ type: 'ecrit', id: moi, groupe: o.groupe })))
      } else if (typeof o.a === 'string' && (await this.estAmi(moi, o.a))) {
        await this.boite(o.a).pousser({ type: 'ecrit', id: moi })
      }
      return
    }

    if (o.type === 'ensemble' && typeof o.a === 'string' && typeof o.action === 'string' && ACTIONS_ENSEMBLE.includes(o.action)) {
      if (!(await this.estAmi(moi, o.a))) return
      const signal: Record<string, unknown> = { type: 'ensemble', de: moi, action: o.action }
      if (typeof o.url === 'string' && /^https?:\/\//i.test(o.url)) signal.url = o.url.slice(0, 2000)
      if (typeof o.titre === 'string') signal.titre = o.titre.slice(0, 200)
      if (typeof o.pseudo === 'string') signal.pseudo = o.pseudo.slice(0, 24)
      if (typeof o.y === 'number' && o.y >= 0 && o.y <= 1) signal.y = o.y
      await this.boite(o.a).pousser(signal)
    }
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try {
      ws.close(code === 1005 ? 1000 : code, 'fin')
    } catch {
      /* déjà fermée */
    }
    // plus aucune connexion : les amis voient l'utilisateur hors ligne
    if (this.ctx.getWebSockets().filter((x) => x !== ws).length > 0) return
    const amis = ((await this.ctx.storage.get<string[]>('amis')) ?? []).slice(0, 200)
    const moi = (await this.ctx.storage.get<string>('moi')) ?? ''
    if (!moi) return
    await Promise.allSettled(amis.map((id) => this.boite(id).pousser({ type: 'presence', id: moi, enLigne: false })))
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws, 1011)
  }

  private boite(id: string): DurableObjectStub<Boite> {
    return this.env.BOITES.get(this.env.BOITES.idFromName(id))
  }

  /** Ami d'après la liste reçue à la connexion, sinon d'après la base (amitié acceptée depuis). */
  private async estAmi(moi: string, autre: string): Promise<boolean> {
    const amis = (await this.ctx.storage.get<string[]>('amis')) ?? []
    if (amis.includes(autre)) return true
    const [a, b] = moi < autre ? [moi, autre] : [autre, moi]
    const ok = !!(await this.env.DB.prepare("SELECT 1 FROM amities WHERE a = ? AND b = ? AND statut = 'acceptee'").bind(a, b).first())
    if (ok) await this.ctx.storage.put('amis', [...amis, autre])
    return ok
  }

  private async membres(groupe: string): Promise<string[]> {
    return (await this.env.DB.prepare('SELECT id FROM membres WHERE groupe = ?').bind(groupe).all<{ id: string }>()).results.map((x) => x.id)
  }
}
