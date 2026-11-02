/* Branche les canaux IPC de l'interface. Chaque message est vérifié : il doit venir de notre fenêtre,
 * et chaque argument est contrôlé avant d'être utilisé. */
import { app, BrowserWindow, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { estPageInterne } from '../../shared/adresse'
import type { ActionTelechargement } from '../../shared/donnees'
import { CANAUX, type InfosApp } from '../../shared/ipc'
import type { ZoneOnglet } from '../../shared/onglets'
import { estAdresseInterface } from '../securite/politiques'
import type { Favoris } from '../stockage/favoris'
import type { Historique } from '../stockage/historique'
import type { MagasinReglages } from '../stockage/reglages'
import { appliquerTheme, effetNatifDisponible } from '../fenetre/fenetrePrincipale'
import type { GestionnaireOnglets } from '../navigateur/onglets'
import { ouvrirMenuOnglet, ouvrirMenuPrincipal } from '../navigateur/menuOnglet'
import type { Telechargements } from '../navigateur/telechargements'
import type { Ollama } from '../ia/ollama'
import { RE_NOM_MODELE } from '../../shared/ia'

export interface Services {
  reglages: MagasinReglages
  historique: Historique
  favoris: Favoris
  telechargements: Telechargements
  ollama: Ollama
  ongletsDe: (f: BrowserWindow) => GestionnaireOnglets | undefined
}

function fenetreDe(e: IpcMainEvent | IpcMainInvokeEvent): BrowserWindow | null {
  // Une page web (onglet) n'a pas accès à ces canaux : seul le code de l'interface peut les appeler.
  if (!e.senderFrame || !estAdresseInterface(e.senderFrame.url)) return null
  return BrowserWindow.fromWebContents(e.sender)
}

const estId = (v: unknown): v is number => Number.isInteger(v)
const estTexte = (v: unknown): v is string => typeof v === 'string' && v.length <= 8192
const ACTIONS_TELECHARGEMENT: readonly ActionTelechargement[] = ['annuler', 'pause', 'reprendre', 'ouvrir', 'montrer', 'retirer']

/** Envoie un message à toutes les fenêtres de l'interface. */
function diffuser(canal: string, valeur: unknown): void {
  for (const f of BrowserWindow.getAllWindows()) if (!f.isDestroyed()) f.webContents.send(canal, valeur)
}

export function enregistrerIpc(s: Services): void {
  const { reglages, historique, favoris, telechargements, ollama, ongletsDe } = s

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
    if (f && go) ouvrirMenuPrincipal(f, go)
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
  ollama.on('change', (etat) => diffuser(CANAUX.iaChange, etat))
}
