/* Preload de l'interface : expose window.se7en, et rien d'autre. Aucun accès direct à Node ni à ipcRenderer. */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { CANAUX, type ApiSe7en, type EtatFenetre } from '../shared/ipc'
import type { Favori, Telechargement } from '../shared/donnees'
import type { EtatOllama } from '../shared/ia'
import type { CommandeUi, EtatOnglets } from '../shared/onglets'
import type { Reglages } from '../shared/reglages'

function ecouter<T>(canal: string, rappel: (v: T) => void): () => void {
  const f = (_e: IpcRendererEvent, v: T): void => rappel(v)
  ipcRenderer.on(canal, f)
  return () => ipcRenderer.removeListener(canal, f)
}

const envoyer =
  (canal: string) =>
  (...args: unknown[]): void =>
    ipcRenderer.send(canal, ...args)

const demander =
  (canal: string) =>
  // any : le type précis de chaque réponse est donné par ApiSe7en
  (...args: unknown[]): Promise<any> =>
    ipcRenderer.invoke(canal, ...args)

const api: ApiSe7en = {
  fenetre: {
    reduire: () => ipcRenderer.send(CANAUX.fenetreReduire),
    agrandir: () => ipcRenderer.send(CANAUX.fenetreAgrandir),
    fermer: () => ipcRenderer.send(CANAUX.fenetreFermer),
    surEtat: (rappel) => ecouter<EtatFenetre>(CANAUX.fenetreEtat, rappel)
  },
  app: {
    infos: demander(CANAUX.appInfos),
    surCommande: (rappel) => ecouter<CommandeUi>(CANAUX.uiCommande, rappel),
    menu: envoyer(CANAUX.appMenu)
  },
  reglages: {
    lire: demander(CANAUX.reglagesLire),
    modifier: demander(CANAUX.reglagesModifier),
    surChangement: (rappel) => ecouter<Reglages>(CANAUX.reglagesChange, rappel)
  },
  onglets: {
    lire: demander(CANAUX.ongletsLire),
    surEtat: (rappel) => ecouter<EtatOnglets>(CANAUX.ongletsEtat, rappel),
    nouveau: envoyer(CANAUX.ongletsNouveau),
    fermer: envoyer(CANAUX.ongletsFermer),
    activer: envoyer(CANAUX.ongletsActiver),
    deplacer: envoyer(CANAUX.ongletsDeplacer),
    naviguer: envoyer(CANAUX.ongletsNaviguer),
    precedent: envoyer(CANAUX.ongletsPrecedent),
    suivant: envoyer(CANAUX.ongletsSuivant),
    actualiser: envoyer(CANAUX.ongletsActualiser),
    arreter: envoyer(CANAUX.ongletsArreter),
    zones: envoyer(CANAUX.ongletsZones),
    focusPage: envoyer(CANAUX.ongletsFocusPage),
    menu: envoyer(CANAUX.ongletsMenu),
    prioritaire: envoyer(CANAUX.ongletsPrioritaire),
    masquer: envoyer(CANAUX.ongletsMasquer),
    interne: envoyer(CANAUX.ongletsInterne),
    diviser: envoyer(CANAUX.ongletsDiviser),
    quitterSplit: envoyer(CANAUX.ongletsQuitterSplit),
    ratio: envoyer(CANAUX.ongletsRatio)
  },
  historique: {
    chercher: demander(CANAUX.historiqueChercher),
    plusVisites: demander(CANAUX.historiquePlusVisites),
    supprimer: demander(CANAUX.historiqueSupprimer),
    effacer: demander(CANAUX.historiqueEffacer)
  },
  favoris: {
    lire: demander(CANAUX.favorisLire),
    basculer: envoyer(CANAUX.favorisBasculer),
    supprimer: envoyer(CANAUX.favorisSupprimer),
    surChangement: (rappel) => ecouter<Favori[]>(CANAUX.favorisChange, rappel)
  },
  telechargements: {
    lire: demander(CANAUX.telechargementsLire),
    action: envoyer(CANAUX.telechargementsAction),
    effacer: envoyer(CANAUX.telechargementsEffacer),
    surChangement: (rappel) => ecouter<Telechargement[]>(CANAUX.telechargementsChange, rappel)
  },
  ia: {
    etat: demander(CANAUX.iaEtat),
    verifier: demander(CANAUX.iaVerifier),
    installer: envoyer(CANAUX.iaInstaller),
    demarrer: envoyer(CANAUX.iaDemarrer),
    arreter: envoyer(CANAUX.iaArreter),
    telecharger: envoyer(CANAUX.iaTelecharger),
    annuler: envoyer(CANAUX.iaAnnuler),
    surChangement: (rappel) => ecouter<EtatOllama>(CANAUX.iaChange, rappel)
  }
}

contextBridge.exposeInMainWorld('se7en', api)
