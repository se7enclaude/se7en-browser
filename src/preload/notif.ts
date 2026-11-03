/* Preload de la notification de message : reçoit les messages à afficher, donne sa hauteur, ouvre la conversation. Rien d'autre. */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { CibleSocial, NotifMessage } from '../shared/social'

// Noms des canaux recopiés de CANAUX (shared/ipc.ts) : un preload sandboxé doit tenir en un seul fichier,
// et importer CANAUX ici ferait découper le code commun en un morceau à part, que le preload ne peut pas charger.
const CANAUX = { notifMessage: 'notif:message', notifTaille: 'notif:taille', notifOuvrir: 'notif:ouvrir' } as const

contextBridge.exposeInMainWorld('notif', {
  surMessage: (rappel: (n: NotifMessage) => void): void => {
    ipcRenderer.on(CANAUX.notifMessage, (_e: IpcRendererEvent, n: NotifMessage) => rappel(n))
  },
  taille: (hauteur: number): void => ipcRenderer.send(CANAUX.notifTaille, hauteur),
  ouvrir: (cible: CibleSocial): void => ipcRenderer.send(CANAUX.notifOuvrir, cible)
})
