/* La « boîte » d'un utilisateur (Durable Object) : garde ses connexions directes ouvertes (un PC = une connexion),
 * pousse les évènements (message reçu, demande d'ami, ami en ligne) et prévient ses amis quand il se déconnecte. */
import { DurableObject } from 'cloudflare:workers'
import type { Env } from './index'

export class Boite extends DurableObject<Env> {
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

  /** Le client envoie « ping » pour garder la connexion : on répond, rien d'autre. */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (message === 'ping') ws.send('pong')
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
    await Promise.allSettled(amis.map((id) => this.env.BOITES.get(this.env.BOITES.idFromName(id)).pousser({ type: 'presence', id: moi, enLigne: false })))
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws, 1011)
  }
}
