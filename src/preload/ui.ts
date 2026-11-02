/* Preload de l'interface : expose window.se7en, et rien d'autre. Aucun accès direct à Node ni à ipcRenderer. */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { CANAUX, type ApiSe7en, type EtatFenetre } from '../shared/ipc'
import type { Favori, Telechargement } from '../shared/donnees'
import type { FluxChat } from '../shared/chat'
import type { EtatOllama } from '../shared/ia'
import type { CommandeUi, EtatOnglets } from '../shared/onglets'
import type { Reglages } from '../shared/reglages'
import type { EtatSocial, EvenementSocial } from '../shared/social'

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
  },
  chat: {
    envoyer: demander(CANAUX.chatEnvoyer),
    arreter: envoyer(CANAUX.chatArreter),
    surFlux: (rappel) => ecouter<FluxChat>(CANAUX.chatFlux, rappel),
    conversations: demander(CANAUX.conversationsLister),
    conversation: demander(CANAUX.conversationsLire),
    supprimer: demander(CANAUX.conversationsSupprimer)
  },
  skills: {
    lire: demander(CANAUX.skillsLire),
    sauver: demander(CANAUX.skillsSauver),
    reinitialiser: demander(CANAUX.skillsReinitialiser)
  },
  coffre: {
    lire: demander(CANAUX.coffreLire),
    sauver: demander(CANAUX.coffreSauver)
  },
  formulaire: {
    compter: demander(CANAUX.formulaireCompter),
    analyser: demander(CANAUX.formulaireAnalyser),
    remplir: demander(CANAUX.formulaireRemplir),
    enregistrerSous: demander(CANAUX.formulaireEnregistrer)
  },
  bloqueur: {
    menu: envoyer(CANAUX.bloqueurMenu)
  },
  groupes: {
    ranger: demander(CANAUX.ongletsRanger),
    basculer: envoyer(CANAUX.groupeBasculer),
    menu: envoyer(CANAUX.groupeMenu)
  },
  memoire: {
    lire: demander(CANAUX.memoireLire),
    ajouter: demander(CANAUX.memoireAjouter),
    supprimer: demander(CANAUX.memoireSupprimer),
    effacer: demander(CANAUX.memoireEffacer)
  },
  social: {
    etat: demander(CANAUX.socialEtat),
    surEtat: (rappel) => ecouter<EtatSocial>(CANAUX.socialChange, rappel),
    surEvenement: (rappel) => ecouter<EvenementSocial>(CANAUX.socialEvenement, rappel),
    profil: demander(CANAUX.socialProfil),
    photo: demander(CANAUX.socialPhoto),
    choisirPhoto: demander(CANAUX.socialChoisirPhoto),
    supprimer: demander(CANAUX.socialSupprimer),
    amis: demander(CANAUX.socialAmis),
    ajouter: demander(CANAUX.socialAjouter),
    accepter: demander(CANAUX.socialAccepter),
    retirer: demander(CANAUX.socialRetirer),
    messages: demander(CANAUX.socialMessages),
    envoyer: demander(CANAUX.socialEnvoyer),
    envoyerOnglet: demander(CANAUX.socialEnvoyerOnglet),
    lu: envoyer(CANAUX.socialLu),
    ouvrirLien: envoyer(CANAUX.socialOuvrirLien)
  }
}

contextBridge.exposeInMainWorld('se7en', api)
