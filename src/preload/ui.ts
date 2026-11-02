/* Preload de l'interface : expose window.se7en, et rien d'autre. Aucun accès direct à Node ni à ipcRenderer. */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { CANAUX, type ApiSe7en, type EtatFenetre } from '../shared/ipc'
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

const api: ApiSe7en = {
  fenetre: {
    reduire: () => ipcRenderer.send(CANAUX.fenetreReduire),
    agrandir: () => ipcRenderer.send(CANAUX.fenetreAgrandir),
    fermer: () => ipcRenderer.send(CANAUX.fenetreFermer),
    surEtat: (rappel) => ecouter<EtatFenetre>(CANAUX.fenetreEtat, rappel)
  },
  app: {
    infos: () => ipcRenderer.invoke(CANAUX.appInfos),
    surCommande: (rappel) => ecouter<CommandeUi>(CANAUX.uiCommande, rappel)
  },
  reglages: {
    lire: () => ipcRenderer.invoke(CANAUX.reglagesLire),
    modifier: (partiel) => ipcRenderer.invoke(CANAUX.reglagesModifier, partiel),
    surChangement: (rappel) => ecouter<Reglages>(CANAUX.reglagesChange, rappel)
  },
  onglets: {
    lire: () => ipcRenderer.invoke(CANAUX.ongletsLire),
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
    zone: envoyer(CANAUX.ongletsZone),
    focusPage: envoyer(CANAUX.ongletsFocusPage)
  }
}

contextBridge.exposeInMainWorld('se7en', api)
