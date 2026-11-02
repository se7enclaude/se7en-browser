/* Preload de l'interface : expose window.se7en, et rien d'autre. Aucun accès direct à Node ni à ipcRenderer. */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { CANAUX, type ApiSe7en, type EtatFenetre } from '../shared/ipc'
import type { Reglages } from '../shared/reglages'

function ecouter<T>(canal: string, rappel: (v: T) => void): () => void {
  const f = (_e: IpcRendererEvent, v: T): void => rappel(v)
  ipcRenderer.on(canal, f)
  return () => ipcRenderer.removeListener(canal, f)
}

const api: ApiSe7en = {
  fenetre: {
    reduire: () => ipcRenderer.send(CANAUX.fenetreReduire),
    agrandir: () => ipcRenderer.send(CANAUX.fenetreAgrandir),
    fermer: () => ipcRenderer.send(CANAUX.fenetreFermer),
    surEtat: (rappel) => ecouter<EtatFenetre>(CANAUX.fenetreEtat, rappel)
  },
  app: {
    infos: () => ipcRenderer.invoke(CANAUX.appInfos)
  },
  reglages: {
    lire: () => ipcRenderer.invoke(CANAUX.reglagesLire),
    modifier: (partiel) => ipcRenderer.invoke(CANAUX.reglagesModifier, partiel),
    surChangement: (rappel) => ecouter<Reglages>(CANAUX.reglagesChange, rappel)
  }
}

contextBridge.exposeInMainWorld('se7en', api)
