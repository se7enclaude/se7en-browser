/* « Naviguer ensemble » : un onglet partagé en direct avec un ami.
 * Celui qui guide envoie l'adresse de la page et sa position (en proportion de la page), 3 fois par seconde au plus ;
 * l'autre suit. Chacun peut « prendre la main » ou arrêter. Rien ne passe sans que l'ami ait accepté l'invitation,
 * et seul l'onglet partagé est concerné (jamais les autres onglets, ni ce qu'on tape dans la page).
 * Une page de connexion (Gmail…) s'affiche chez chacun avec son propre compte : seule l'adresse voyage. */
import { EventEmitter } from 'node:events'
import type { WebContents } from 'electron'
import { estAdresseAutorisee } from '../../shared/adresse'
import type { EtatEnsemble, SignalEnsemble } from '../../shared/social'
import type { ClientSocial } from './client'

const SUIVI = 330
/** Monde isolé à part, pour lire et régler la position dans la page sans que la page le voie. */
const MONDE = 7012

export interface PagesEnsemble {
  /** La page web de l'onglet (null : fermé, ou pas une page web). */
  page: (id: number) => { wc: WebContents; titre: string } | null
  ouvrir: (url: string) => number
  naviguer: (id: number, url: string) => void
  pseudoAmi: (id: string) => string
  monPseudo: () => string
}

export class Ensemble extends EventEmitter<{ etat: [EtatEnsemble] }> {
  private session: EtatEnsemble = null
  private minuteur: NodeJS.Timeout | null = null
  private dernier = { url: '', y: -1 }

  constructor(
    private readonly social: ClientSocial,
    private readonly pages: PagesEnsemble
  ) {
    super()
    social.on('evenement', (ev) => {
      if (ev.type === 'ensemble') void this.recevoir(ev)
    })
  }

  etat(): EtatEnsemble {
    return this.session
  }

  /** Invite un ami à suivre l'onglet `ongletId`. */
  inviter(ami: string, ongletId: number): string | null {
    const p = this.pages.page(ongletId)
    if (!p || !estAdresseAutorisee(p.wc.getURL())) return 'Choisis une page web à partager.'
    if (this.session?.etat === 'actif') this.arreter()
    const ok = this.envoyer(ami, { action: 'invite', url: p.wc.getURL(), titre: p.titre, pseudo: this.pages.monPseudo() })
    if (!ok) return 'Tu n’es pas connecté au serveur se7en social.'
    this.changer({ ami, pseudo: this.pages.pseudoAmi(ami), ongletId, role: 'guide', etat: 'invitation-envoyee', titre: p.titre, url: p.wc.getURL() })
    return null
  }

  /** Réponse à une invitation reçue. */
  repondre(accepter: boolean): void {
    const s = this.session
    if (!s || s.etat !== 'invitation-recue') return
    if (!accepter) {
      this.envoyer(s.ami, { action: 'refuse' })
      return this.changer(null)
    }
    const ongletId = this.pages.ouvrir(s.url ?? '')
    this.envoyer(s.ami, { action: 'accepte', pseudo: this.pages.monPseudo() })
    this.changer({ ...s, ongletId, role: 'suit', etat: 'actif' })
    this.suivre()
  }

  /** Passe de « suit » à « guide » (l'autre suit à son tour). */
  prendreLaMain(): void {
    const s = this.session
    if (!s || s.etat !== 'actif' || s.role === 'guide') return
    this.envoyer(s.ami, { action: 'main' })
    this.dernier = { url: '', y: -1 }
    this.changer({ ...s, role: 'guide' })
  }

  arreter(): void {
    const s = this.session
    if (!s) return
    this.envoyer(s.ami, { action: s.etat === 'invitation-recue' ? 'refuse' : 'fin' })
    this.changer(null)
  }

  // ---------- interne ----------

  private async recevoir(ev: SignalEnsemble): Promise<void> {
    const s = this.session
    if (ev.action === 'invite') {
      // une invitation pendant une autre session : on la décline poliment
      if (s?.etat === 'actif' || s?.etat === 'invitation-envoyee') return void this.envoyer(ev.de, { action: 'refuse' })
      if (!ev.url || !estAdresseAutorisee(ev.url)) return
      return this.changer({ ami: ev.de, pseudo: ev.pseudo || this.pages.pseudoAmi(ev.de), ongletId: null, role: 'suit', etat: 'invitation-recue', titre: ev.titre, url: ev.url })
    }
    if (!s || ev.de !== s.ami) return
    if (ev.action === 'accepte' && s.etat === 'invitation-envoyee') {
      this.dernier = { url: '', y: -1 }
      this.changer({ ...s, etat: 'actif' })
      return this.suivre()
    }
    if (ev.action === 'refuse' || ev.action === 'fin') return this.changer(null)
    if (s.etat !== 'actif' || s.ongletId === null) return
    if (ev.action === 'main') {
      this.dernier = { url: '', y: -1 }
      return this.changer({ ...s, role: 'suit' })
    }
    if (s.role !== 'suit') return
    const p = this.pages.page(s.ongletId)
    if (!p) return this.arreter()
    if (ev.action === 'url' && ev.url && estAdresseAutorisee(ev.url) && ev.url !== p.wc.getURL()) {
      this.dernier.url = ev.url
      this.pages.naviguer(s.ongletId, ev.url)
    }
    if (ev.action === 'defile' && typeof ev.y === 'number') {
      const y = Math.min(1, Math.max(0, ev.y))
      await p.wc
        .executeJavaScriptInIsolatedWorld(MONDE, [
          {
            // défilement doux quand la page est à l'écran ; immédiat sinon (une page cachée n'anime rien)
            code: `scrollTo({ top: ${y} * Math.max(0, document.documentElement.scrollHeight - innerHeight), behavior: document.visibilityState === 'visible' ? 'smooth' : 'instant' })`
          }
        ])
        .catch(() => undefined)
    }
  }

  /** Chez celui qui guide : envoie l'adresse et la position quand elles changent. */
  private suivre(): void {
    if (this.minuteur) clearInterval(this.minuteur)
    this.minuteur = setInterval(() => void this.relever(), SUIVI)
  }

  private async relever(): Promise<void> {
    const s = this.session
    if (!s || s.etat !== 'actif' || s.ongletId === null) return
    const p = this.pages.page(s.ongletId)
    if (!p) return this.arreter() // onglet fermé
    if (s.role !== 'guide') return
    const url = p.wc.getURL()
    if (url !== this.dernier.url && estAdresseAutorisee(url)) {
      this.dernier = { url, y: -1 }
      this.envoyer(s.ami, { action: 'url', url, titre: p.titre })
      return
    }
    const y = (await p.wc
      .executeJavaScriptInIsolatedWorld(MONDE, [{ code: 'scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)' }])
      .catch(() => null)) as number | null
    if (typeof y === 'number' && Number.isFinite(y) && Math.abs(y - this.dernier.y) > 0.004) {
      this.dernier.y = y
      this.envoyer(s.ami, { action: 'defile', y: Math.min(1, Math.max(0, y)) })
    }
  }

  private envoyer(ami: string, signal: Omit<SignalEnsemble, 'de'>): boolean {
    return this.social.signal({ type: 'ensemble', a: ami, ...signal })
  }

  private changer(s: EtatEnsemble): void {
    this.session = s
    if (!s || s.etat !== 'actif') {
      if (this.minuteur) clearInterval(this.minuteur)
      this.minuteur = null
    }
    this.emit('etat', s)
  }
}
