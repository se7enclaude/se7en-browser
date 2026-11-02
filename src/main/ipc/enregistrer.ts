/* Branche les canaux IPC de l'interface. Chaque message est vérifié : il doit venir de notre fenêtre,
 * et chaque argument est contrôlé avant d'être utilisé. */
import { app, BrowserWindow, dialog, ipcMain, nativeImage, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
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
import type { Bloqueur } from '../bloqueur/bloqueur'
import type { Memoire } from '../ia/memoire'
import { RE_NOM_MODELE } from '../../shared/ia'
import type { ClientSocial } from '../social/client'
import type { AssistantEcriture } from '../ia/ecriture'
import type { MemoireNavigation } from '../ia/memoireNavigation'
import { MAX_MESSAGE } from '../../shared/social'

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
  return BrowserWindow.fromWebContents(e.sender)
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
    fenetreDe(e) ? { version: app.getVersion(), effetNatif: effetNatifDisponible() } : null
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
  ipcMain.on(CANAUX.ongletsMenu, (e, id: unknown) => {
    const f = fenetreDe(e)
    const go = f && ongletsDe(f)
    if (f && go && estId(id)) ouvrirMenuOnglet(f, go, id)
  })
  ipcMain.on(CANAUX.ongletsPrioritaire, (e, id: unknown, oui: unknown) => estId(id) && g(e)?.definirPrioritaire(id, oui === true))
  ipcMain.on(CANAUX.ongletsMasquer, (e, oui: unknown) => g(e)?.definirMasque(oui === true))
  ipcMain.on(CANAUX.ongletsInterne, (e, page: unknown) => typeof page === 'string' && estPageInterne(page) && g(e)?.ouvrirInterne(page))
  ipcMain.on(CANAUX.ongletsDiviser, (e, id: unknown) => g(e)?.diviser(estId(id) ? id : undefined))
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
  ipcMain.handle(CANAUX.socialMessages, (e, ami: unknown, avant: unknown) =>
    estIdSocial(ami) ? social$(e, () => social.messages(ami, typeof avant === 'number' ? avant : undefined)) : { erreur: 'Ami introuvable.' }
  )
  ipcMain.handle(CANAUX.socialEnvoyer, (e, ami: unknown, texte: unknown) =>
    estIdSocial(ami) && typeof texte === 'string' ? social$(e, () => social.envoyer(ami, { texte: texte.slice(0, MAX_MESSAGE) })) : { erreur: 'Message invalide.' }
  )
  ipcMain.handle(CANAUX.socialEnvoyerOnglet, (e, ami: unknown, idOnglet: unknown) => {
    const o = estId(idOnglet) ? g(e)?.etat().onglets.find((x) => x.id === idOnglet) : undefined
    // seules les pages web s'envoient (pas un PDF du PC ni une page interne)
    if (!estIdSocial(ami) || !o || !estAdresseAutorisee(o.url)) return { erreur: 'Cet onglet ne peut pas être envoyé.' }
    return social$(e, () => social.envoyer(ami, { texte: '', url: o.url, titre: o.titre }))
  })
  ipcMain.on(CANAUX.socialLu, (e, ami: unknown) => fenetreDe(e) && estIdSocial(ami) && void social.marquerLu(ami).catch(() => undefined))
  ipcMain.on(CANAUX.socialOuvrirLien, (e, url: unknown) => typeof url === 'string' && estAdresseAutorisee(url) && g(e)?.nouveau(url, { aCote: true }))

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
