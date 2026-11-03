/* Branche les canaux IPC de l'interface. Chaque message est vérifié : il doit venir de notre fenêtre,
 * et chaque argument est contrôlé avant d'être utilisé. */
import { cpus, totalmem } from 'node:os'
import { app, BrowserWindow, dialog, ipcMain, nativeImage, webContents, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { estAdresseAutorisee, estPageInterne } from '../../shared/adresse'
import type { ActionTelechargement } from '../../shared/donnees'
import { CANAUX, type InfosApp } from '../../shared/ipc'
import type { ZoneCapture } from '../../shared/chat'
import type { ZoneOnglet } from '../../shared/onglets'
import { estAdresseInterface } from '../securite/politiques'
import type { Favoris } from '../stockage/favoris'
import type { Historique } from '../stockage/historique'
import type { MagasinReglages } from '../stockage/reglages'
import { appliquerTheme, effetNatifDisponible } from '../fenetre/fenetrePrincipale'
import type { GestionnaireOnglets } from '../navigateur/onglets'
import { ouvrirMenuBloqueur, ouvrirMenuGroupe, ouvrirMenuOnglet, ouvrirMenuPrincipal } from '../navigateur/menuOnglet'
import type { Telechargements } from '../navigateur/telechargements'
import type { Ollama } from '../ia/ollama'
import type { ServiceChat } from '../ia/chat'
import type { Conversations, Skills } from '../ia/conversations'
import type { CoffreChiffre } from '../coffre/coffre'
import type { ServiceFormulaire } from '../pdf/serviceFormulaire'
import { hoteDe, type Bloqueur } from '../bloqueur/bloqueur'
import type { Memoire } from '../ia/memoire'
import { modeleEclair, modelePresent, RE_NOM_MODELE } from '../../shared/ia'
import type { ClientSocial } from '../social/client'
import type { AssistantEcriture } from '../ia/ecriture'
import type { MemoireNavigation } from '../ia/memoireNavigation'
import { lirePage } from '../ia/lecturePage'
import { resumerPourEnvoi } from '../ia/eclair'
import type { MiseAJour } from '../miseAJour'
import type { Plantages } from '../plantages'
import { vuesInterface } from '../social/miniDiscussion'
import { analyserFormulaireWeb, remplirFormulaireWeb } from '../ia/formulaireWeb'
import { chiffrer, dechiffrer, MOT_DE_PASSE_MIN, type ContenuSauvegarde } from '../sauvegarde'
import { captureRaccourci } from '../navigateur/commandes'
import type { Ensemble } from '../social/ensemble'
import { estNavigateurParDefaut, ouvrirChoixNavigateur } from '../navigateurDefaut'
import { lireFavorisExportes } from '../../shared/importFavoris'
import { promises as fsp } from 'node:fs'
import { MAX_MEMBRES_GROUPE, MAX_MESSAGE, type CibleSocial, type StatutSocial } from '../../shared/social'

export interface Services {
  reglages: MagasinReglages
  historique: Historique
  favoris: Favoris
  telechargements: Telechargements
  ollama: Ollama
  chat: ServiceChat
  conversations: Conversations
  skills: Skills
  coffre: CoffreChiffre
  formulaires: ServiceFormulaire
  bloqueur: Bloqueur
  memoire: Memoire
  social: ClientSocial
  ecriture: AssistantEcriture
  navigation: MemoireNavigation
  miseAJour: MiseAJour
  plantages: Plantages
  /** Ouvre (ou ferme, avec null) la petite fenêtre de discussion. */
  discussion: (f: BrowserWindow, cible: CibleSocial | null) => void
  agrandirDiscussion: (f: BrowserWindow, cible: CibleSocial) => void
  ensemble: Ensemble
  /** Traduit la page d'un onglet (ou remet l'original). */
  traduire: (f: BrowserWindow, id: number, original: boolean) => void
  /** Capture l'onglet actif et l'envoie à l'interface pour choisir une zone. */
  zone: (f: BrowserWindow) => void
  /** Range les onglets de la fenêtre en groupes (IA). */
  ranger: (g: GestionnaireOnglets) => Promise<{ groupes: number } | { erreur: string }>
  /** Fenêtre « Ouvrir » pour choisir un PDF du PC. */
  ouvrirFichier: (f: BrowserWindow) => void
  ongletsDe: (f: BrowserWindow) => GestionnaireOnglets | undefined
}

function fenetreDe(e: IpcMainEvent | IpcMainInvokeEvent): BrowserWindow | null {
  // Une page web (onglet) n'a pas accès à ces canaux : seul le code de l'interface peut les appeler.
  if (!e.senderFrame || !estAdresseInterface(e.senderFrame.url)) return null
  return BrowserWindow.fromWebContents(e.sender) ?? vuesInterface.get(e.sender.id) ?? null
}

const estId = (v: unknown): v is number => Number.isInteger(v)
const estTexte = (v: unknown): v is string => typeof v === 'string' && v.length <= 8192
/** Zone de l'écran envoyée par l'interface : un identifiant de capture et un rectangle en fractions (0 à 1). */
function zoneValide(v: unknown): ZoneCapture | undefined {
  if (!v || typeof v !== 'object') return undefined
  const z = v as Record<string, unknown>
  const f = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1
  if (typeof z.idCapture !== 'string' || !f(z.x) || !f(z.y) || !f(z.largeur) || !f(z.hauteur)) return undefined
  if (z.x + z.largeur > 1.001 || z.y + z.hauteur > 1.001 || z.largeur < 0.002 || z.hauteur < 0.002) return undefined
  return { idCapture: z.idCapture, x: z.x, y: z.y, largeur: z.largeur, hauteur: z.hauteur }
}

const ACTIONS_TELECHARGEMENT: readonly ActionTelechargement[] = ['annuler', 'pause', 'reprendre', 'ouvrir', 'montrer', 'retirer']

/** Envoie un message à toutes les fenêtres de l'interface. */
function diffuser(canal: string, valeur: unknown): void {
  for (const f of BrowserWindow.getAllWindows()) if (!f.isDestroyed()) f.webContents.send(canal, valeur)
  // petite fenêtre de discussion : elle aussi suit les évènements (messages, amis, réglages…)
  for (const id of vuesInterface.keys()) webContents.fromId(id)?.send(canal, valeur)
}

/** Image à envoyer : 1600 px au plus de côté, en JPEG ; plus petite si elle reste trop lourde. Null : impossible. */
function reduireImage(img: Electron.NativeImage): Buffer | null {
  for (const [cote, qualite] of [[1600, 82], [1280, 75], [960, 70]] as const) {
    const { width, height } = img.getSize()
    const r = Math.min(1, cote / Math.max(width, height))
    const petite = r < 1 ? img.resize({ width: Math.round(width * r), height: Math.round(height * r), quality: 'best' }) : img
    const jpeg = petite.toJPEG(qualite)
    if (jpeg.length <= 1400 * 1024) return jpeg
  }
  return null
}

/** Peu de cœurs, peu de mémoire, ou rendu sans carte graphique : le flou du verre coûte cher, on l'allège. */
function pcModeste(): boolean {
  const gpu = app.getGPUFeatureStatus()
  return cpus().length <= 4 || totalmem() < 8 * 1024 ** 3 || gpu.gpu_compositing !== 'enabled'
}

export function enregistrerIpc(s: Services): void {
  const { reglages, historique, favoris, telechargements, ollama, chat, conversations, skills, coffre, formulaires, bloqueur, memoire, social, ecriture, ongletsDe } = s

  // ---------- fenêtre et application ----------
  ipcMain.on(CANAUX.fenetreReduire, (e) => fenetreDe(e)?.minimize())
  ipcMain.on(CANAUX.fenetreAgrandir, (e) => {
    const f = fenetreDe(e)
    if (f) f.isMaximized() ? f.unmaximize() : f.maximize()
  })
  ipcMain.on(CANAUX.fenetreFermer, (e) => fenetreDe(e)?.close())
  ipcMain.handle(CANAUX.appInfos, (e): InfosApp | null =>
    fenetreDe(e) ? { version: app.getVersion(), effetNatif: effetNatifDisponible(), modeste: pcModeste() } : null
  )

  // ---------- réglages ----------
  ipcMain.handle(CANAUX.reglagesLire, (e) => (fenetreDe(e) ? reglages.get() : null))
  ipcMain.handle(CANAUX.reglagesModifier, (e, partiel: unknown) => (fenetreDe(e) ? reglages.modifier(partiel) : null))
  // Toute modification est renvoyée à toutes les fenêtres, et le thème natif suit.
  reglages.on('change', (r) => {
    appliquerTheme(r.theme)
    diffuser(CANAUX.reglagesChange, r)
  })

  // ---------- onglets ----------
  const g = (e: IpcMainEvent | IpcMainInvokeEvent): GestionnaireOnglets | undefined => {
    const f = fenetreDe(e)
    return f ? ongletsDe(f) : undefined
  }
  ipcMain.handle(CANAUX.ongletsLire, (e) => g(e)?.etat() ?? null)
  ipcMain.on(CANAUX.ongletsNouveau, (e, saisie: unknown) => g(e)?.nouveau(estTexte(saisie) ? saisie : ''))
  ipcMain.on(CANAUX.ongletsFermer, (e, id: unknown) => estId(id) && g(e)?.fermer(id))
  ipcMain.on(CANAUX.ongletsActiver, (e, id: unknown) => estId(id) && g(e)?.activer(id))
  ipcMain.on(CANAUX.ongletsDeplacer, (e, id: unknown, versId: unknown) => estId(id) && estId(versId) && g(e)?.deplacer(id, versId))
  ipcMain.on(CANAUX.ongletsNaviguer, (e, id: unknown, saisie: unknown) => estId(id) && estTexte(saisie) && g(e)?.naviguer(id, saisie))
  ipcMain.on(CANAUX.ongletsPrecedent, (e, id: unknown) => estId(id) && g(e)?.precedent(id))
  ipcMain.on(CANAUX.ongletsSuivant, (e, id: unknown) => estId(id) && g(e)?.suivant(id))
  ipcMain.on(CANAUX.ongletsActualiser, (e, id: unknown) => estId(id) && g(e)?.actualiser(id))
  ipcMain.on(CANAUX.ongletsArreter, (e, id: unknown) => estId(id) && g(e)?.arreter(id))
  ipcMain.on(CANAUX.ongletsZones, (e, liste: unknown) => Array.isArray(liste) && g(e)?.definirZones(liste as ZoneOnglet[]))
  ipcMain.on(CANAUX.ongletsFocusPage, (e) => g(e)?.focusPage())
  ipcMain.on(CANAUX.appMenu, (e) => {
    const f = fenetreDe(e)
    const go = f && ongletsDe(f)
    if (f && go) ouvrirMenuPrincipal(f, go, () => s.ouvrirFichier(f), () => void s.ranger(go))
  })
  ipcMain.on(CANAUX.ongletsNouveauPrive, (e) => g(e)?.nouveau('', { prive: true }))
  const estTexteCourt = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max
  ipcMain.on(CANAUX.sessionChanger, (e, id: unknown) => estTexteCourt(id, 40) && g(e)?.changerSession(id))
  ipcMain.on(CANAUX.sessionCreer, (e, nom: unknown, emoji: unknown) => estTexteCourt(nom, 60) && g(e)?.creerSession(nom, estTexteCourt(emoji, 16) ? emoji : '📁'))
  ipcMain.on(CANAUX.sessionRenommer, (e, id: unknown, nom: unknown, emoji: unknown) =>
    estTexteCourt(id, 40) && estTexteCourt(nom, 60) && g(e)?.renommerSession(id, nom, estTexteCourt(emoji, 16) ? emoji : undefined)
  )
  ipcMain.on(CANAUX.sessionSupprimer, (e, id: unknown) => estTexteCourt(id, 40) && g(e)?.supprimerSession(id))
  ipcMain.on(CANAUX.sessionDeplacer, (e, idOnglet: unknown, session: unknown) => estId(idOnglet) && estTexteCourt(session, 40) && g(e)?.deplacerVersSession(idOnglet, session))
  ipcMain.on(CANAUX.raccourciCapture, (e, oui: unknown) => {
    if (fenetreDe(e)) captureRaccourci.active = oui === true
  })
  ipcMain.on(CANAUX.appOuvrirFichier, (e) => {
    const f = fenetreDe(e)
    if (f) s.ouvrirFichier(f)
  })
  ipcMain.on(CANAUX.ongletsMenu, (e, id: unknown) => {
    const f = fenetreDe(e)
    const go = f && ongletsDe(f)
    if (f && go && estId(id)) ouvrirMenuOnglet(f, go, id)
  })
  ipcMain.on(CANAUX.ongletsPrioritaire, (e, id: unknown, oui: unknown) => estId(id) && g(e)?.definirPrioritaire(id, oui === true))
  ipcMain.handle(CANAUX.ongletsFiger, (e) => g(e)?.figer() ?? [])
  ipcMain.on(CANAUX.ongletsLiberer, (e) => g(e)?.liberer())
  ipcMain.on(CANAUX.ongletsInterne, (e, page: unknown) => typeof page === 'string' && estPageInterne(page) && g(e)?.ouvrirInterne(page))
  ipcMain.on(CANAUX.ongletsDiviser, (e, id: unknown, aGauche: unknown) => g(e)?.diviser(estId(id) ? id : undefined, aGauche === true))
  ipcMain.on(CANAUX.ongletsQuitterSplit, (e) => g(e)?.quitterSplit())
  ipcMain.on(CANAUX.ongletsRatio, (e, r: unknown) => typeof r === 'number' && g(e)?.definirRatio(r))

  // ---------- historique ----------
  ipcMain.handle(CANAUX.historiqueChercher, (e, texte: unknown) => (fenetreDe(e) ? historique.chercher(estTexte(texte) ? texte : '') : []))
  ipcMain.handle(CANAUX.historiquePlusVisites, (e, n: unknown) =>
    fenetreDe(e) ? historique.plusVisites(estId(n) ? Math.min(24, Math.max(1, n)) : 8) : []
  )
  ipcMain.handle(CANAUX.historiqueSupprimer, (e, ids: unknown) => {
    if (fenetreDe(e) && Array.isArray(ids)) historique.supprimer(ids.filter((x): x is string => typeof x === 'string'))
  })
  ipcMain.handle(CANAUX.historiqueEffacer, (e) => {
    if (fenetreDe(e)) historique.effacer()
  })

  // ---------- favoris ----------
  ipcMain.handle(CANAUX.favorisLire, (e) => (fenetreDe(e) ? favoris.lire() : []))
  // l'adresse vient de l'onglet lui-même (dans le main), pas d'un texte envoyé par l'interface
  ipcMain.on(CANAUX.favorisBasculer, (e, idOnglet: unknown) => {
    const o = estId(idOnglet) ? g(e)?.etat().onglets.find((x) => x.id === idOnglet) : undefined
    if (o && /^https?:\/\//.test(o.url)) favoris.basculer(o.url, o.titre, o.favicon)
  })
  ipcMain.on(CANAUX.favorisSupprimer, (e, id: unknown) => fenetreDe(e) && typeof id === 'string' && favoris.supprimer(id))
  favoris.on('change', (liste) => diffuser(CANAUX.favorisChange, liste))

  // ---------- téléchargements ----------
  ipcMain.handle(CANAUX.telechargementsLire, (e) => (fenetreDe(e) ? telechargements.lire() : []))
  ipcMain.on(CANAUX.telechargementsAction, (e, id: unknown, action: unknown) => {
    if (fenetreDe(e) && typeof id === 'string' && ACTIONS_TELECHARGEMENT.includes(action as ActionTelechargement))
      telechargements.action(id, action as ActionTelechargement)
  })
  ipcMain.on(CANAUX.telechargementsEffacer, (e) => fenetreDe(e) && telechargements.effacer())
  telechargements.on('change', (liste) => diffuser(CANAUX.telechargementsChange, liste))

  // ---------- IA locale ----------
  ipcMain.handle(CANAUX.iaEtat, (e) => (fenetreDe(e) ? ollama.etat() : null))
  ipcMain.handle(CANAUX.iaVerifier, (e) => (fenetreDe(e) ? ollama.verifier() : null))
  ipcMain.on(CANAUX.iaInstaller, (e) => fenetreDe(e) && void ollama.installer())
  ipcMain.on(CANAUX.iaDemarrer, (e) => fenetreDe(e) && void ollama.demarrer())
  ipcMain.on(CANAUX.iaTelecharger, (e, noms: unknown) => {
    if (!fenetreDe(e) || !Array.isArray(noms)) return
    const valides = noms.filter((n): n is string => typeof n === 'string' && RE_NOM_MODELE.test(n)).slice(0, 4)
    if (valides.length) void ollama.telecharger(valides)
  })
  ipcMain.on(CANAUX.iaAnnuler, (e) => fenetreDe(e) && ollama.annuler())
  ipcMain.on(CANAUX.iaArreter, (e) => fenetreDe(e) && ollama.arreter())
  ollama.on('change', (etat) => diffuser(CANAUX.iaChange, etat))

  // ---------- chat ----------
  ipcMain.handle(CANAUX.chatEnvoyer, (e, d: unknown) => {
    if (!fenetreDe(e) || !d || typeof d !== 'object') return { erreur: 'Demande invalide.' }
    const o = d as Record<string, unknown>
    if (!estTexte(o.texte) || !o.texte.trim()) return { erreur: 'Question vide.' }
    return chat.envoyer({
      idConversation: typeof o.idConversation === 'string' ? o.idConversation : null,
      texte: o.texte.slice(0, 8000),
      avecPageActive: o.avecPageActive === true,
      idsOnglets: Array.isArray(o.idsOnglets) ? o.idsOnglets.filter(estId) : [],
      zone: zoneValide(o.zone),
      avecNavigation: o.avecNavigation === true
    })
  })
  ipcMain.on(CANAUX.chatArreter, (e) => fenetreDe(e) && chat.arreter())
  chat.on('flux', (f) => diffuser(CANAUX.chatFlux, f))
  ipcMain.handle(CANAUX.conversationsLister, (e) => (fenetreDe(e) ? conversations.resumes() : []))
  ipcMain.handle(CANAUX.conversationsLire, (e, id: unknown) => (fenetreDe(e) && typeof id === 'string' ? (conversations.lire(id) ?? null) : null))
  ipcMain.handle(CANAUX.conversationsSupprimer, (e, id: unknown) => {
    if (fenetreDe(e) && typeof id === 'string') conversations.supprimer(id)
  })
  ipcMain.handle(CANAUX.skillsLire, (e) => (fenetreDe(e) ? skills.lire() : []))
  ipcMain.handle(CANAUX.skillsSauver, (e, liste: unknown) => (fenetreDe(e) ? skills.sauver(liste) : []))
  ipcMain.handle(CANAUX.skillsReinitialiser, (e) => (fenetreDe(e) ? skills.reinitialiser() : []))

  // ---------- coffre (chiffré) et formulaires PDF ----------
  const erreur = (err: unknown): { erreur: string } => ({ erreur: (err as Error)?.message || 'Erreur inconnue.' })
  ipcMain.handle(CANAUX.coffreLire, (e) => (fenetreDe(e) ? coffre.etat() : null))
  ipcMain.handle(CANAUX.coffreSauver, async (e, c: unknown) => (fenetreDe(e) ? coffre.sauver(c).catch(erreur) : null))
  ipcMain.handle(CANAUX.formulaireCompter, async (e, id: unknown) => {
    const go = g(e)
    return go && estId(id) ? formulaires.compter(go, id) : 0
  })
  ipcMain.handle(CANAUX.formulaireAnalyser, async (e, id: unknown) => {
    const go = g(e)
    return go && estId(id) ? formulaires.analyser(go, id).catch(erreur) : erreur(new Error('Onglet introuvable.'))
  })
  ipcMain.handle(CANAUX.formulaireRemplir, async (e, id: unknown, valeurs: unknown) => {
    const go = g(e)
    if (!go || !estId(id) || !Array.isArray(valeurs)) return erreur(new Error('Demande invalide.'))
    const propres = valeurs
      .filter((v): v is { nom: string; valeur: string } => !!v && typeof v.nom === 'string' && typeof v.valeur === 'string')
      .slice(0, 500)
      .map((v) => ({ nom: v.nom.slice(0, 500), valeur: v.valeur.slice(0, 2000) }))
    return formulaires.remplir(go, id, propres).catch(erreur)
  })
  ipcMain.handle(CANAUX.formulaireEnregistrer, async (e, id: unknown) => {
    const f = fenetreDe(e)
    const go = f && ongletsDe(f)
    return f && go && estId(id) ? formulaires.enregistrerSous(f, go, id).catch(erreur) : null
  })

  // ---------- bloqueur ----------
  ipcMain.on(CANAUX.bloqueurMenu, (e, id: unknown) => {
    const f = fenetreDe(e)
    const go = f && ongletsDe(f)
    if (!f || !go || !estId(id)) return
    const r = reglages.get()
    ouvrirMenuBloqueur(f, go, id, {
      actif: r.bloqueur,
      pret: bloqueur.pret,
      exceptions: r.bloqueurExceptions,
      changer: (actif, exceptions) => void reglages.modifier({ bloqueur: actif, bloqueurExceptions: exceptions })
    })
  })

  // ---------- groupes d'onglets ----------
  ipcMain.handle(CANAUX.ongletsRanger, async (e) => {
    const go = g(e)
    return go ? s.ranger(go) : { erreur: 'Fenêtre introuvable.' }
  })
  ipcMain.on(CANAUX.groupeBasculer, (e, id: unknown) => typeof id === 'string' && g(e)?.basculerGroupe(id))
  ipcMain.on(CANAUX.groupeMenu, (e, id: unknown) => {
    const f = fenetreDe(e)
    const go = f && ongletsDe(f)
    if (f && go && typeof id === 'string') ouvrirMenuGroupe(f, go, id)
  })

  // ---------- mémoire de l'IA ----------
  ipcMain.handle(CANAUX.memoireLire, (e) => (fenetreDe(e) ? memoire.lire() : []))
  ipcMain.handle(CANAUX.memoireAjouter, (e, texte: unknown) => {
    if (fenetreDe(e) && estTexte(texte) && texte.trim()) memoire.ajouter(texte)
    return memoire.lire()
  })
  ipcMain.handle(CANAUX.memoireSupprimer, (e, id: unknown) => {
    if (fenetreDe(e) && typeof id === 'string') memoire.supprimer(id)
    return memoire.lire()
  })
  ipcMain.handle(CANAUX.memoireEffacer, (e) => {
    if (fenetreDe(e)) memoire.effacer()
    return memoire.lire()
  })

  // ---------- profils et amis ----------
  const estIdSocial = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{1,64}$/.test(v)
  /** Exécute une action du client social ; une erreur devient { erreur } pour l'interface. */
  const social$ = async <T>(e: IpcMainInvokeEvent, action: () => Promise<T>): Promise<T | { erreur: string }> =>
    fenetreDe(e) ? action().catch(erreur) : { erreur: 'Fenêtre introuvable.' }
  social.on('etat', (etat) => diffuser(CANAUX.socialChange, etat))
  social.on('evenement', (ev) => diffuser(CANAUX.socialEvenement, ev))
  ipcMain.handle(CANAUX.socialEtat, (e) => (fenetreDe(e) ? social.etat() : null))
  ipcMain.handle(CANAUX.socialProfil, (e, pseudo: unknown) => social$(e, () => social.enregistrerProfil(String(pseudo ?? '').slice(0, 100))))
  ipcMain.handle(CANAUX.socialSupprimer, (e) => social$(e, () => social.supprimerProfil()))
  ipcMain.handle(CANAUX.socialPhoto, (e, id: unknown) => (fenetreDe(e) && estIdSocial(id) ? social.photo(id) : null))
  ipcMain.handle(CANAUX.socialChoisirPhoto, async (e) => {
    const f = fenetreDe(e)
    if (!f) return null
    const r = await dialog.showOpenDialog(f, { title: 'Photo de profil', filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }], properties: ['openFile'] })
    if (!r.filePaths[0]) return null
    // recadrée en carré au centre puis réduite à 256 px : le fichier d'origine ne quitte pas le PC
    const img = nativeImage.createFromPath(r.filePaths[0])
    if (img.isEmpty()) return { erreur: 'Image illisible.' }
    const { width, height } = img.getSize()
    const c = Math.min(width, height)
    const carre = img.crop({ x: Math.floor((width - c) / 2), y: Math.floor((height - c) / 2), width: c, height: c }).resize({ width: 256, height: 256, quality: 'best' })
    return social$(e, () => social.envoyerPhoto(carre.toJPEG(85)).then(() => ({ ok: true as const })))
  })
  ipcMain.handle(CANAUX.socialAmis, (e) => social$(e, () => social.amis()))
  ipcMain.handle(CANAUX.socialAjouter, (e, code: unknown) => social$(e, () => social.ajouter(String(code ?? '').slice(0, 40))))
  ipcMain.handle(CANAUX.socialAccepter, (e, id: unknown) =>
    estIdSocial(id) ? social$(e, () => social.accepter(id).then(() => ({ ok: true as const }))) : { erreur: 'Demande introuvable.' }
  )
  ipcMain.handle(CANAUX.socialRetirer, (e, id: unknown) =>
    estIdSocial(id) ? social$(e, () => social.retirer(id).then(() => ({ ok: true as const }))) : { erreur: 'Ami introuvable.' }
  )
  const estCible = (v: unknown): v is CibleSocial => {
    const c = v as CibleSocial | null
    return !!c && (c.type === 'ami' || c.type === 'groupe') && estIdSocial(c.id)
  }
  ipcMain.handle(CANAUX.socialMessages, (e, cible: unknown, avant: unknown) =>
    estCible(cible) ? social$(e, () => social.messagesDe(cible, typeof avant === 'number' ? avant : undefined)) : { erreur: 'Conversation introuvable.' }
  )
  ipcMain.handle(CANAUX.socialEnvoyer, (e, cible: unknown, texte: unknown) =>
    estCible(cible) && typeof texte === 'string' ? social$(e, () => social.envoyerA(cible, { texte: texte.slice(0, MAX_MESSAGE) })) : { erreur: 'Message invalide.' }
  )
  ipcMain.handle(CANAUX.socialEnvoyerOnglet, async (e, cible: unknown, idOnglet: unknown, avecResume: unknown) => {
    const p = estId(idOnglet) ? g(e)?.pageDe(idOnglet) : null
    const o = p?.etat
    // seules les pages web s'envoient (pas un PDF du PC ni une page interne)
    if (!estCible(cible) || !p || !o || !estAdresseAutorisee(o.url)) return { erreur: 'Cet onglet ne peut pas être envoyé.' }
    // résumé en deux phrases par l'IA locale (si elle est prête) : il part avec le lien, comme un message
    let texte = ''
    const r = reglages.get()
    const etat = ollama.etat()
    if (avecResume === true && etat.phase === 'pret' && modelePresent(r.modeleTexte, etat.modeles)) {
      const lue = await lirePage(p.wc, o.url)
      if (lue.texte.length > 200 && !lue.motDePasse) texte = await resumerPourEnvoi(modeleEclair(r, etat.modeles), lue).catch(() => '')
    }
    return social$(e, () => social.envoyerA(cible, { texte, url: o.url, titre: o.titre }))
  })
  ipcMain.on(CANAUX.socialLu, (e, cible: unknown) => fenetreDe(e) && estCible(cible) && void social.marquerLuDe(cible).catch(() => undefined))
  ipcMain.handle(CANAUX.socialGroupes, (e) => social$(e, () => social.groupes()))
  ipcMain.handle(CANAUX.socialCreerGroupe, (e, nom: unknown, membres: unknown) =>
    typeof nom === 'string' && Array.isArray(membres) && membres.every(estIdSocial)
      ? social$(e, () => social.creerGroupe(nom.slice(0, 40), membres.slice(0, MAX_MEMBRES_GROUPE)).then((id) => ({ id })))
      : { erreur: 'Groupe invalide.' }
  )
  ipcMain.handle(CANAUX.socialAjouterMembre, (e, groupe: unknown, id: unknown) =>
    estIdSocial(groupe) && estIdSocial(id) ? social$(e, () => social.ajouterMembre(groupe, id).then(() => ({ ok: true as const }))) : { erreur: 'Membre invalide.' }
  )
  ipcMain.handle(CANAUX.socialRenommerGroupe, (e, groupe: unknown, nom: unknown) =>
    estIdSocial(groupe) && typeof nom === 'string' ? social$(e, () => social.renommerGroupe(groupe, nom.slice(0, 40)).then(() => ({ ok: true as const }))) : { erreur: 'Nom invalide.' }
  )
  ipcMain.handle(CANAUX.socialQuitterGroupe, (e, groupe: unknown) =>
    estIdSocial(groupe) ? social$(e, () => social.quitterGroupe(groupe).then(() => ({ ok: true as const }))) : { erreur: 'Groupe introuvable.' }
  )
  ipcMain.handle(CANAUX.socialImage, (e, id: unknown) => (fenetreDe(e) && estIdSocial(id) ? social.image(id).catch(() => null) : null))
  ipcMain.handle(CANAUX.socialEnvoyerImage, async (e, cible: unknown, source: unknown) => {
    const f = fenetreDe(e)
    if (!f || !estCible(cible)) return { erreur: 'Conversation introuvable.' }
    const src = source as { type?: string; idOnglet?: unknown; donnees?: unknown } | null
    let img: Electron.NativeImage | null = null
    if (src?.type === 'fichier') {
      const r = await dialog.showOpenDialog(f, { title: 'Envoyer une image', filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] }], properties: ['openFile'] })
      if (!r.filePaths[0]) return null
      img = nativeImage.createFromPath(r.filePaths[0])
    } else if (src?.type === 'capture' && estId(src.idOnglet)) {
      const go = g(e)
      const p = go?.pageDe(src.idOnglet)
      if (!go || !p) return { erreur: 'Cet onglet ne peut pas être capturé.' }
      // une page cachée ne se capture pas : on prend l'image gardée quand on l'a quittée ; sinon on l'affiche
      // le temps de la capture (un tiers de seconde), puis on revient à l'onglet de départ
      const capturer = (): Promise<Electron.NativeImage | null> => p.wc.capturePage().then((i) => (i.isEmpty() ? null : i), () => null)
      img = await capturer()
      const memo = img ? undefined : go.imageMemorisee(src.idOnglet)
      if (memo) img = nativeImage.createFromDataURL(memo)
      if (!img) {
        const depart = go.idActif()
        go.activer(src.idOnglet)
        await new Promise((r) => setTimeout(r, 450))
        img = await capturer()
        if (depart !== null) go.activer(depart)
      }
    } else if (src?.type === 'collee' && typeof src.donnees === 'string' && /^data:image\/(png|jpeg|webp|gif|bmp);base64,/.test(src.donnees) && src.donnees.length < 30_000_000) {
      img = nativeImage.createFromDataURL(src.donnees)
    }
    if (!img || img.isEmpty()) return { erreur: 'Image illisible.' }
    const jpeg = reduireImage(img)
    if (!jpeg) return { erreur: 'Image trop lourde, même réduite.' }
    return social$(e, () => social.envoyerImage(cible, jpeg))
  })
  ipcMain.on(CANAUX.socialEcrit, (e, cible: unknown) => {
    if (!fenetreDe(e) || !estCible(cible)) return
    social.signal(cible.type === 'ami' ? { type: 'ecrit', a: cible.id } : { type: 'ecrit', groupe: cible.id })
  })
  ipcMain.handle(CANAUX.socialCodeSecours, (e) => (fenetreDe(e) ? social.codeSecours() : null))
  ipcMain.handle(CANAUX.socialEnregistrerCode, async (e) => {
    const f = fenetreDe(e)
    const code = social.codeSecours()
    if (!f || !code) return false
    const r = await dialog.showSaveDialog(f, { title: 'Enregistrer le code de secours', defaultPath: 'se7en - code de secours.txt', filters: [{ name: 'Texte', extensions: ['txt'] }] })
    if (!r.filePath) return false
    await fsp.writeFile(
      r.filePath,
      `Code de secours se7en Browser (profil ${social.etat().profil?.pseudo ?? ''})\r\n\r\n${code}\r\n\r\n` +
        'Il permet de retrouver ton profil, tes amis et tes messages sur un autre PC (page Amis › « J’ai déjà un profil »).\r\n' +
        'Garde-le pour toi : quiconque l’a peut utiliser ton profil.\r\n'
    )
    return true
  })
  ipcMain.handle(CANAUX.socialEnvoyerVocal, (e, cible: unknown, son: unknown, type: unknown) => {
    if (!estCible(cible) || !(son instanceof Uint8Array) || (type !== 'audio/webm' && type !== 'audio/ogg')) return { erreur: 'Message vocal invalide.' }
    if (son.byteLength > 1024 * 1024) return { erreur: 'Message vocal trop long.' }
    if (son.byteLength < 200) return { erreur: 'Message vocal vide.' }
    return social$(e, () => social.envoyerVocal(cible, Buffer.from(son), type))
  })
  ipcMain.handle(CANAUX.socialStatut, (e, s: unknown) => {
    const o = s as { type?: unknown; texte?: unknown } | null
    const statut: StatutSocial | null = o && (o.type === 'occupe' || o.type === 'jeu' || o.type === 'absent') ? { type: o.type, texte: typeof o.texte === 'string' ? o.texte.slice(0, 60) : '' } : null
    return social$(e, () => social.changerStatut(statut))
  })
  ipcMain.on(CANAUX.discussionOuvrir, (e, cible: unknown) => {
    const f = fenetreDe(e)
    if (f && estCible(cible)) s.discussion(f, cible)
  })
  ipcMain.on(CANAUX.discussionAgrandir, (e, cible: unknown) => {
    const f = fenetreDe(e)
    if (f && estCible(cible)) s.agrandirDiscussion(f, cible)
  })
  ipcMain.on(CANAUX.discussionFermer, (e) => {
    const f = fenetreDe(e)
    if (f) s.discussion(f, null)
  })
  ipcMain.handle(CANAUX.socialRecuperer, (e, code: unknown) => (typeof code === 'string' ? social$(e, () => social.recuperer(code.slice(0, 200))) : { erreur: 'Code invalide.' }))

  // ---------- naviguer ensemble ----------
  s.ensemble.on('etat', (etat) => diffuser(CANAUX.ensembleChange, etat))
  ipcMain.handle(CANAUX.ensembleEtat, (e) => (fenetreDe(e) ? s.ensemble.etat() : null))
  ipcMain.handle(CANAUX.ensembleInviter, (e, ami: unknown, idOnglet: unknown) => {
    if (!fenetreDe(e) || !estIdSocial(ami) || !estId(idOnglet)) return { erreur: 'Invitation invalide.' }
    const erreurInvitation = s.ensemble.inviter(ami, idOnglet)
    return erreurInvitation ? { erreur: erreurInvitation } : { ok: true as const }
  })
  ipcMain.on(CANAUX.ensembleRepondre, (e, oui: unknown) => fenetreDe(e) && s.ensemble.repondre(oui === true))
  ipcMain.on(CANAUX.ensembleMain, (e) => fenetreDe(e) && s.ensemble.prendreLaMain())
  ipcMain.on(CANAUX.ensembleArreter, (e) => fenetreDe(e) && s.ensemble.arreter())
  ipcMain.on(CANAUX.socialOuvrirLien, (e, url: unknown) => typeof url === 'string' && estAdresseAutorisee(url) && g(e)?.nouveau(url, { aCote: true }))

  // ---------- venir d'un autre navigateur ----------
  // les favoris viennent uniquement du fichier que l'utilisateur a exporté lui-même et choisit ici
  ipcMain.handle(CANAUX.favorisImporter, async (e) => {
    const f = fenetreDe(e)
    if (!f) return null
    const r = await dialog.showOpenDialog(f, {
      title: 'Importer des favoris',
      filters: [{ name: 'Favoris exportés (HTML)', extensions: ['html', 'htm'] }],
      properties: ['openFile']
    })
    if (!r.filePaths[0]) return null
    try {
      const st = await fsp.stat(r.filePaths[0])
      if (st.size > 30 * 1024 * 1024) return { erreur: 'Fichier trop gros pour un export de favoris.' }
      const liste = lireFavorisExportes(await fsp.readFile(r.filePaths[0], 'utf8'))
      if (!liste.length) return { erreur: 'Aucun favori trouvé dans ce fichier. Choisis le fichier exporté par ton ancien navigateur.' }
      return { ajoutes: favoris.importer(liste), trouves: liste.length }
    } catch {
      return { erreur: 'Impossible de lire ce fichier.' }
    }
  })
  ipcMain.on(CANAUX.phishingIgnorer, (e, id: unknown) => {
    const p = estId(id) ? g(e)?.pageDe(id) : null
    if (!p) return
    const hote = hoteDe(p.etat.url)
    if (hote) void reglages.modifier({ phishingExceptions: [...reglages.get().phishingExceptions, hote] })
    g(e)?.definirPhishing(p.wc, null)
  })
  ipcMain.handle(CANAUX.defautEtat, (e) => (fenetreDe(e) ? estNavigateurParDefaut() : false))
  ipcMain.on(CANAUX.defautChoisir, (e) => fenetreDe(e) && ouvrirChoixNavigateur())

  ipcMain.on(CANAUX.traductionTraduire, (e, id: unknown) => {
    const f = fenetreDe(e)
    if (f && estId(id)) s.traduire(f, id, false)
  })
  ipcMain.on(CANAUX.traductionOriginal, (e, id: unknown) => {
    const f = fenetreDe(e)
    if (f && estId(id)) s.traduire(f, id, true)
  })

  // ---------- remplir un formulaire web avec le coffre ----------
  ipcMain.handle(CANAUX.formulaireWebAnalyser, async (e, id: unknown) => {
    const p = estId(id) ? g(e)?.pageDe(id) : null
    if (!p) return { erreur: 'Cette page ne peut pas être remplie.' }
    const etat = ollama.etat()
    const r = reglages.get()
    const modele = etat.phase === 'pret' && modelePresent(r.modeleTexte, etat.modeles) ? r.modeleTexte : null
    try {
      return { ...(await analyserFormulaireWeb(p.wc, coffre.lire(), modele)), phishing: p.etat.phishing }
    } catch {
      return { erreur: 'Impossible de lire les champs de cette page.' }
    }
  })
  ipcMain.handle(CANAUX.formulaireWebRemplir, async (e, id: unknown, valeurs: unknown) => {
    const p = estId(id) ? g(e)?.pageDe(id) : null
    if (!p || !Array.isArray(valeurs)) return { erreur: 'Cette page ne peut pas être remplie.' }
    const propres = (valeurs as { nom?: unknown; valeur?: unknown }[]).filter((v) => typeof v?.nom === 'string' && typeof v.valeur === 'string') as { nom: string; valeur: string }[]
    try {
      return { remplis: await remplirFormulaireWeb(p.wc, propres) }
    } catch {
      return { erreur: 'Le formulaire a changé entre-temps : relance le remplissage.' }
    }
  })

  // ---------- sauvegarde chiffrée ----------
  ipcMain.handle(CANAUX.sauvegardeExporter, async (e, mdp: unknown) => {
    const f = fenetreDe(e)
    if (!f || typeof mdp !== 'string') return null
    if (mdp.length < MOT_DE_PASSE_MIN) return { erreur: `Choisis un mot de passe d'au moins ${MOT_DE_PASSE_MIN} caractères.` }
    const date = new Date().toISOString().slice(0, 10)
    const r = await dialog.showSaveDialog(f, {
      title: 'Enregistrer la sauvegarde',
      defaultPath: `se7en Browser - sauvegarde ${date}.se7en`,
      filters: [{ name: 'Sauvegarde se7en', extensions: ['se7en'] }]
    })
    if (!r.filePath) return null
    const contenu: ContenuSauvegarde = { version: 1, date: Date.now(), reglages: reglages.get(), coffre: coffre.lire(), favoris: favoris.lire(), skills: skills.lire() }
    await fsp.writeFile(r.filePath, chiffrer(contenu, mdp))
    return { ok: true as const, fichier: r.filePath }
  })
  ipcMain.handle(CANAUX.sauvegardeImporter, async (e, mdp: unknown) => {
    const f = fenetreDe(e)
    if (!f || typeof mdp !== 'string') return null
    const r = await dialog.showOpenDialog(f, { title: 'Restaurer une sauvegarde', filters: [{ name: 'Sauvegarde se7en', extensions: ['se7en'] }], properties: ['openFile'] })
    if (!r.filePaths[0]) return null
    const st = await fsp.stat(r.filePaths[0])
    if (st.size > 50 * 1024 * 1024) return { erreur: 'Fichier trop gros pour une sauvegarde se7en.' }
    const c = dechiffrer(await fsp.readFile(r.filePaths[0]), mdp)
    if (!c) return { erreur: 'Mot de passe incorrect, ou ce fichier n’est pas une sauvegarde se7en Browser.' }
    // chaque partie passe par les mêmes vérifications que si l'utilisateur l'avait saisie
    await reglages.modifier(c.reglages)
    if (coffre.disponible()) await coffre.sauver(c.coffre).catch(() => undefined)
    if (Array.isArray(c.skills)) skills.sauver(c.skills)
    const liste = Array.isArray(c.favoris)
      ? (c.favoris as { url?: unknown; titre?: unknown; favicon?: unknown; date?: unknown }[])
          .filter((x) => typeof x?.url === 'string' && estAdresseAutorisee(x.url))
          .map((x) => ({ url: x.url as string, titre: typeof x.titre === 'string' ? x.titre : '', favicon: typeof x.favicon === 'string' ? x.favicon : null, date: typeof x.date === 'number' ? x.date : Date.now() }))
      : []
    return { ok: true as const, favoris: favoris.importer(liste) }
  })

  // ---------- rapports de plantage ----------
  ipcMain.handle(CANAUX.plantagesLister, (e) => (fenetreDe(e) ? s.plantages.lister() : null))
  ipcMain.on(CANAUX.plantagesVus, (e) => fenetreDe(e) && s.plantages.marquerVus())
  ipcMain.handle(CANAUX.plantagesEffacer, (e, id: unknown) => {
    if (!fenetreDe(e)) return null
    s.plantages.effacer(typeof id === 'string' ? id : undefined)
    return s.plantages.lister()
  })
  ipcMain.on(CANAUX.plantagesSignaler, (e, m: unknown, p: unknown) => fenetreDe(e) && typeof m === 'string' && s.plantages.signalerInterface(m, typeof p === 'string' ? p : ''))

  // ---------- mise à jour du navigateur ----------
  s.miseAJour.on('etat', (e) => diffuser(CANAUX.majChange, e))
  ipcMain.handle(CANAUX.majEtat, (e) => (fenetreDe(e) ? s.miseAJour.etat() : null))
  ipcMain.handle(CANAUX.majVerifier, (e) => (fenetreDe(e) ? s.miseAJour.verifier() : null))
  ipcMain.on(CANAUX.majInstaller, (e) => fenetreDe(e) && s.miseAJour.installerMaintenant())

  // ---------- mémoire de navigation ----------
  ipcMain.handle(CANAUX.navigationNombre, (e) => (fenetreDe(e) ? s.navigation.nombre() : 0))
  ipcMain.handle(CANAUX.navigationEffacer, (e) => {
    if (fenetreDe(e)) s.navigation.effacer()
    return s.navigation.nombre()
  })

  // ---------- aide à l'écriture, zone de l'écran, insertion ----------
  ecriture.on('etat', (e) => diffuser(CANAUX.ecritureEtat, e))
  ipcMain.on(CANAUX.ecritureAppliquer, (e, id: unknown, texte: unknown) => {
    if (fenetreDe(e) && typeof id === 'string') ecriture.appliquer(id, typeof texte === 'string' ? texte : undefined)
  })
  ipcMain.on(CANAUX.ecritureAnnuler, (e) => fenetreDe(e) && ecriture.annuler())
  ipcMain.on(CANAUX.iaZone, (e) => {
    const f = fenetreDe(e)
    if (f) s.zone(f)
  })
  // la réponse proposée par l'IA va dans le champ où se trouve le curseur (après un clic de l'utilisateur)
  ipcMain.handle(CANAUX.iaInserer, async (e, idOnglet: unknown, texte: unknown) => {
    const p = estId(idOnglet) && typeof texte === 'string' ? g(e)?.pageDe(idOnglet) : null
    if (!p || p.wc.isDestroyed()) return false
    p.wc.focus()
    // Gmail : si le curseur n'est pas déjà dans un champ, on vise la zone de réponse ouverte
    const champ = await p.wc
      .executeJavaScriptInIsolatedWorld(7007, [
        {
          code: `(() => { const a = document.activeElement; if (a && (a.isContentEditable || /^(TEXTAREA|INPUT)$/.test(a.tagName))) return true;
            const z = document.querySelector('div[contenteditable="true"][role="textbox"], div[contenteditable="true"][g_editable="true"]'); if (z) { z.focus(); return true } return false })()`
        }
      ])
      .catch(() => false)
    if (champ !== true) return false
    p.wc.insertText((texte as string).slice(0, 20000))
    return true
  })
}
