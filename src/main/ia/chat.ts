/* Service de chat : lit les pages demandées, construit les messages, interroge Ollama et renvoie la réponse en flux.
 * Une seule réponse à la fois. L'IA ne fait que répondre : elle n'a aucun outil, aucune action possible. */
import { net, type NativeImage } from 'electron'
import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { appliquerSkill, type DemandeChat, type FluxChat, type MessageChat, type PageJointe, type ReponseEnvoi } from '../../shared/chat'
import { modelePresent } from '../../shared/ia'
import type { Reglages } from '../../shared/reglages'
import type { GestionnaireOnglets } from '../navigateur/onglets'
import type { Conversations, Skills } from './conversations'
import { capturerPage, lirePage } from './lecturePage'
import type { DocumentsPdf } from '../pdf/documents'
import { lireTextePdf } from '../pdf/texte'
import { demandeDeRetenir, demandeDOublier, type Memoire } from './memoire'
import { lireNdjson } from './ndjson'
import { API_OLLAMA, type Ollama } from './ollama'
import { alertesManipulation, construireMessages, titreConversation, type PageLue } from './prompts'

/** Contexte du modèle : assez pour une page longue et la conversation, et ça tient dans 16 Go de carte graphique. */
const TAILLE_CONTEXTE = 16384
/** En dessous, la page n'a presque pas de texte lisible (image, vidéo, canvas) : on regarde une capture. */
const TEXTE_MINIMUM = 300

/** Captures gardées pour « Demander sur une zone de l'écran » (les plus récentes seulement). */
const MAX_CAPTURES = 3

export class ServiceChat extends EventEmitter<{ flux: [FluxChat] }> {
  private enCours: AbortController | null = null
  private readonly captures = new Map<string, NativeImage>()

  constructor(
    private readonly ollama: Ollama,
    private readonly conversations: Conversations,
    private readonly skills: Skills,
    private readonly documents: DocumentsPdf,
    private readonly memoire: Memoire,
    private readonly reglages: () => Reglages,
    private readonly onglets: () => GestionnaireOnglets | undefined
  ) {
    super()
  }

  get occupe(): boolean {
    return this.enCours !== null
  }

  arreter(): void {
    this.enCours?.abort()
  }

  /** Capture l'onglet actif pour que l'utilisateur y choisisse une zone. Renvoie l'image (data: URL) et son identifiant. */
  async capturerZone(): Promise<{ idCapture: string; image: string } | null> {
    const g = this.onglets()
    const id = g?.etat().actifId
    const p = id != null ? g?.pageDe(id) : null
    if (!p) return null
    try {
      const image = await p.wc.capturePage()
      if (image.isEmpty()) return null
      const idCapture = randomUUID()
      this.captures.set(idCapture, image)
      while (this.captures.size > MAX_CAPTURES) this.captures.delete(this.captures.keys().next().value!)
      return { idCapture, image: image.toDataURL() }
    } catch {
      return null
    }
  }

  /** La zone choisie, recadrée (JPEG en base64, 1280 px de large au plus). */
  private zoneDe(z: NonNullable<DemandeChat['zone']>): string | null {
    const capture = this.captures.get(z.idCapture)
    if (!capture) return null
    const { width, height } = capture.getSize()
    const rect = {
      x: Math.round(z.x * width),
      y: Math.round(z.y * height),
      width: Math.max(8, Math.round(z.largeur * width)),
      height: Math.max(8, Math.round(z.hauteur * height))
    }
    rect.width = Math.min(rect.width, width - rect.x)
    rect.height = Math.min(rect.height, height - rect.y)
    let zone = capture.crop(rect)
    if (zone.getSize().width > 1280) zone = zone.resize({ width: 1280, quality: 'good' })
    return zone.toJPEG(85).toString('base64')
  }

  /** Enregistre la question, répond tout de suite avec les identifiants, puis la réponse arrive par l'évènement « flux ». */
  envoyer(d: DemandeChat): ReponseEnvoi | { erreur: string } {
    if (this.enCours) return { erreur: "L'IA est déjà en train de répondre." }
    const etat = this.ollama.etat()
    if (etat.phase !== 'pret') return { erreur: "L'IA locale n'est pas activée." }
    const r = this.reglages()
    if (!modelePresent(r.modeleTexte, etat.modeles)) return { erreur: `Le modèle ${r.modeleTexte} n'est pas téléchargé (page IA locale).` }
    if (d.zone && !modelePresent(r.modeleVision, etat.modeles)) return { erreur: `Le modèle vision ${r.modeleVision} n'est pas téléchargé (page IA locale).` }
    if (d.zone && !this.captures.has(d.zone.idCapture)) return { erreur: 'Cette capture a expiré : choisis à nouveau la zone.' }

    const conv = (d.idConversation && this.conversations.lire(d.idConversation)) || this.conversations.creer(titreConversation(d.texte))
    const historique = conv.messages.filter((m) => !m.erreur).map((m) => ({ role: m.role, texte: m.texte }))
    const question: MessageChat = { id: randomUUID(), role: 'user', texte: d.texte, date: Date.now() }
    const reponse: MessageChat = { id: randomUUID(), role: 'assistant', texte: '', date: Date.now() }
    conv.messages.push(question, reponse)
    this.conversations.toucher(conv)

    // « retiens que … » / « oublie … » : réponse immédiate du navigateur, sans IA
    const reponseLocale = this.commandeMemoire(d.texte)
    if (reponseLocale !== null) {
      reponse.texte = reponseLocale
      this.conversations.toucher(conv)
      return { idConversation: conv.id, idQuestion: question.id, idReponse: reponse.id, reponseImmediate: reponseLocale }
    }

    this.enCours = new AbortController()
    void this.repondre(d, historique, question, reponse, conv.id, this.enCours.signal).finally(() => {
      this.enCours = null
      this.conversations.toucher(conv)
    })
    return { idConversation: conv.id, idQuestion: question.id, idReponse: reponse.id }
  }

  /** Réponse du navigateur à une demande de mémoire, ou null si ce n'en est pas une. */
  private commandeMemoire(texte: string): string | null {
    const aRetenir = demandeDeRetenir(texte)
    const aOublier = aRetenir ? null : demandeDOublier(texte)
    if (!aRetenir && !aOublier) return null
    if (!this.reglages().memoire) return "La mémoire est désactivée. Tu peux l'activer dans Paramètres › Mémoire de l'IA."
    if (aRetenir) {
      const s = this.memoire.ajouter(aRetenir)
      return `C'est noté, je m'en souviendrai : « ${s.texte} ».\n\nTu retrouves tout ce que je retiens dans Paramètres › Mémoire de l'IA.`
    }
    const n = this.memoire.oublier(aOublier!)
    if (aOublier === 'tout') return n ? `C'est oublié : j'ai effacé ${n} souvenir${n > 1 ? 's' : ''}.` : "Je n'avais rien en mémoire."
    return n
      ? `C'est oublié (${n} souvenir${n > 1 ? 's' : ''}).`
      : "Je n'ai rien trouvé à oublier sur ce sujet. Tu peux voir et supprimer mes souvenirs dans Paramètres › Mémoire de l'IA."
  }

  private async repondre(
    d: DemandeChat,
    historique: { role: 'user' | 'assistant'; texte: string }[],
    question: MessageChat,
    reponse: MessageChat,
    idConversation: string,
    signal: AbortSignal
  ): Promise<void> {
    const flux = (f: Omit<FluxChat, 'idConversation' | 'idReponse'>): void => {
      this.emit('flux', { idConversation, idReponse: reponse.id, ...f })
    }
    try {
      // 1. lecture des pages jointes
      flux({ etape: 'lecture' })
      const g = this.onglets()
      const ids = new Set(d.idsOnglets.slice(0, 5))
      const idActif = g?.etat().actifId
      if (d.avecPageActive && idActif != null) ids.add(idActif)
      const pages: PageLue[] = []
      let image: string | undefined
      for (const id of ids) {
        const p = g?.pageDe(id)
        if (!p) continue
        const lue = await lirePage(p.wc, p.etat.url)
        // un PDF : son texte complet est lu dans le fichier (la visionneuse n'affiche que les pages visibles)
        const doc = p.etat.pdf ? this.documents.lire(p.etat.pdf) : undefined
        if (doc) {
          lue.titre = doc.nom
          lue.texte = await lireTextePdf(doc.chemin).catch(() => '')
        }
        pages.push(lue)
        // peu de texte sur la page active : le modèle vision regarde une capture
        if (id === idActif && lue.texte.length < TEXTE_MINIMUM && !image) image = (await capturerPage(p.wc)) ?? undefined
      }
      const r = this.reglages()
      const etat = this.ollama.etat()
      const visionDispo = modelePresent(r.modeleVision, etat.modeles)
      // une zone choisie par l'utilisateur passe avant la capture automatique
      if (d.zone) image = this.zoneDe(d.zone) ?? undefined
      if (image && !visionDispo) image = undefined
      const jointes: PageJointe[] = pages.map((p) => ({ titre: p.titre, url: p.url }))
      const alertes = alertesManipulation(pages).map((a) => a.titre)
      question.pages = jointes
      question.image = !!image
      if (alertes.length) question.alertes = alertes
      flux({ etape: 'preparation', pages: jointes, image: !!image, alertes })

      // 2. la Skill éventuelle (/resume…) devient sa consigne ; on garde le texte tapé dans l'historique affiché
      const { texte } = appliquerSkill(d.texte, this.skills.lire())

      // 3. réponse en flux
      const rep = await net.fetch(`${API_OLLAMA}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: image ? r.modeleVision : r.modeleTexte,
          messages: construireMessages(historique, texte, pages, image, undefined, r.memoire ? this.memoire.lire().map((s) => s.texte) : []),
          stream: true,
          think: false,
          options: { num_ctx: TAILLE_CONTEXTE }
        }),
        signal
      })
      if (!rep.ok || !rep.body) throw new Error(`Ollama a répondu par une erreur (${rep.status}).`)
      let tampon = ''
      let dernier = 0
      let erreur: string | null = null
      await lireNdjson(rep.body, (o) => {
        const l = o as { message?: { content?: string }; error?: string }
        if (l.error) erreur = l.error
        const morceau = l.message?.content ?? ''
        if (!morceau) return
        reponse.texte += morceau
        tampon += morceau
        // regroupe les morceaux (environ 20 envois par seconde) pour garder l'interface fluide
        if (Date.now() - dernier > 50) {
          flux({ etape: 'ecriture', delta: tampon })
          tampon = ''
          dernier = Date.now()
        }
      })
      if (tampon) flux({ etape: 'ecriture', delta: tampon })
      if (erreur) throw new Error(erreur)
      flux({ etape: 'fini' })
    } catch (err) {
      if (signal.aborted) {
        if (!reponse.texte) reponse.texte = '(réponse arrêtée)'
        flux({ etape: 'fini' })
        return
      }
      reponse.erreur = true
      reponse.texte = (err as Error).message || "L'IA n'a pas pu répondre."
      flux({ etape: 'erreur', erreur: reponse.texte })
    }
  }
}
