/* Preload de l'interface : expose window.se7en, et rien d'autre. Aucun accès direct à Node ni à ipcRenderer. */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { CANAUX, type ApiSe7en, type EtatFenetre } from '../shared/ipc'
import type { Tache } from '../shared/taches'
import type { Recherche } from '../shared/recherche'
import type { Favori, Telechargement } from '../shared/donnees'
import type { FluxChat } from '../shared/chat'
import type { EtatOllama } from '../shared/ia'
import type { CommandeUi, EtatOnglets } from '../shared/onglets'
import type { Reglages } from '../shared/reglages'
import type { EtatEnsemble, EtatSocial, EvenementSocial } from '../shared/social'
import type { EtatVpn } from '../shared/vpn'
import type { EtatEcriture } from '../shared/ecriture'
import type { EtatMiseAJour } from '../shared/miseAJour'

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
    menu: envoyer(CANAUX.appMenu),
    ouvrirFichier: envoyer(CANAUX.appOuvrirFichier),
    choixMenu: envoyer(CANAUX.menuChoix),
    captureRaccourci: envoyer(CANAUX.raccourciCapture),
    redemarrer: envoyer(CANAUX.appRedemarrer)
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
    nouveauPrive: envoyer(CANAUX.ongletsNouveauPrive),
    changerSession: envoyer(CANAUX.sessionChanger),
    creerSession: envoyer(CANAUX.sessionCreer),
    renommerSession: envoyer(CANAUX.sessionRenommer),
    supprimerSession: envoyer(CANAUX.sessionSupprimer),
    deplacerVersSession: envoyer(CANAUX.sessionDeplacer),
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
    figer: demander(CANAUX.ongletsFiger),
    liberer: envoyer(CANAUX.ongletsLiberer),
    interne: envoyer(CANAUX.ongletsInterne),
    diviser: envoyer(CANAUX.ongletsDiviser),
    quitterSplit: envoyer(CANAUX.ongletsQuitterSplit),
    ratio: envoyer(CANAUX.ongletsRatio)
  },
  vpn: {
    etat: demander(CANAUX.vpnEtat),
    surEtat: (rappel) => ecouter<EtatVpn>(CANAUX.vpnChange, rappel),
    activer: envoyer(CANAUX.vpnActiver),
    desactiver: envoyer(CANAUX.vpnDesactiver),
    nouvelleIdentite: envoyer(CANAUX.vpnNouvelleIdentite)
  },
  widgets: {
    villes: demander(CANAUX.widgetsVilles),
    meteo: demander(CANAUX.widgetsMeteo),
    actualites: demander(CANAUX.widgetsActualites),
    jeux: demander(CANAUX.widgetsJeux),
    sorties: demander(CANAUX.widgetsSorties),
    equipes: demander(CANAUX.widgetsEquipes),
    resultats: demander(CANAUX.widgetsResultats),
    traduire: demander(CANAUX.widgetsTraduire)
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
    surChangement: (rappel) => ecouter<Favori[]>(CANAUX.favorisChange, rappel),
    importer: demander(CANAUX.favorisImporter)
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
    zone: envoyer(CANAUX.iaZone),
    inserer: demander(CANAUX.iaInserer),
    annuler: envoyer(CANAUX.iaAnnuler),
    materiel: demander(CANAUX.iaMateriel),
    vitesse: demander(CANAUX.iaVitesse),
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
  phishing: {
    ignorer: envoyer(CANAUX.phishingIgnorer)
  },
  navigateurDefaut: {
    etat: demander(CANAUX.defautEtat),
    choisir: envoyer(CANAUX.defautChoisir)
  },
  ensemble: {
    etat: demander(CANAUX.ensembleEtat),
    surEtat: (rappel) => ecouter<EtatEnsemble>(CANAUX.ensembleChange, rappel),
    inviter: demander(CANAUX.ensembleInviter),
    repondre: envoyer(CANAUX.ensembleRepondre),
    prendreLaMain: envoyer(CANAUX.ensembleMain),
    arreter: envoyer(CANAUX.ensembleArreter)
  },
  formulaireWeb: {
    analyser: demander(CANAUX.formulaireWebAnalyser),
    remplir: demander(CANAUX.formulaireWebRemplir)
  },
  sauvegarde: {
    exporter: demander(CANAUX.sauvegardeExporter),
    importer: demander(CANAUX.sauvegardeImporter)
  },
  traduction: {
    traduire: envoyer(CANAUX.traductionTraduire),
    original: envoyer(CANAUX.traductionOriginal)
  },
  plantages: {
    lister: demander(CANAUX.plantagesLister),
    vus: envoyer(CANAUX.plantagesVus),
    effacer: demander(CANAUX.plantagesEffacer),
    signaler: envoyer(CANAUX.plantagesSignaler)
  },
  miseAJour: {
    etat: demander(CANAUX.majEtat),
    verifier: demander(CANAUX.majVerifier),
    installer: envoyer(CANAUX.majInstaller),
    surChangement: (rappel) => ecouter<EtatMiseAJour>(CANAUX.majChange, rappel)
  },
  navigation: {
    nombre: demander(CANAUX.navigationNombre),
    effacer: demander(CANAUX.navigationEffacer)
  },
  ecriture: {
    surEtat: (rappel) => ecouter<EtatEcriture | null>(CANAUX.ecritureEtat, rappel),
    appliquer: envoyer(CANAUX.ecritureAppliquer),
    annuler: envoyer(CANAUX.ecritureAnnuler)
  },
  recherche: {
    lister: demander(CANAUX.rechercheLister),
    lancer: demander(CANAUX.rechercheLancer),
    arreter: envoyer(CANAUX.rechercheArreter),
    supprimer: envoyer(CANAUX.rechercheSupprimer),
    cle: demander(CANAUX.rechercheCle),
    definirCle: demander(CANAUX.rechercheDefinirCle),
    surChangement: (rappel) => ecouter<Recherche>(CANAUX.rechercheChange, rappel)
  },
  taches: {
    lister: demander(CANAUX.tachesLister),
    creer: demander(CANAUX.tachesCreer),
    modifier: envoyer(CANAUX.tachesModifier),
    supprimer: envoyer(CANAUX.tachesSupprimer),
    verifier: envoyer(CANAUX.tachesVerifier),
    surChangement: (rappel) => ecouter<Tache[]>(CANAUX.tachesChange, rappel)
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
    ouvrirLien: envoyer(CANAUX.socialOuvrirLien),
    groupes: demander(CANAUX.socialGroupes),
    creerGroupe: demander(CANAUX.socialCreerGroupe),
    ajouterMembre: demander(CANAUX.socialAjouterMembre),
    renommerGroupe: demander(CANAUX.socialRenommerGroupe),
    quitterGroupe: demander(CANAUX.socialQuitterGroupe),
    image: demander(CANAUX.socialImage),
    envoyerImage: demander(CANAUX.socialEnvoyerImage),
    ecrit: envoyer(CANAUX.socialEcrit),
    codeSecours: demander(CANAUX.socialCodeSecours),
    enregistrerCode: demander(CANAUX.socialEnregistrerCode),
    recuperer: demander(CANAUX.socialRecuperer),
    envoyerVocal: demander(CANAUX.socialEnvoyerVocal),
    statut: demander(CANAUX.socialStatut),
    discussion: envoyer(CANAUX.discussionOuvrir),
    fermerDiscussion: envoyer(CANAUX.discussionFermer),
    agrandirDiscussion: envoyer(CANAUX.discussionAgrandir)
  }
}

contextBridge.exposeInMainWorld('se7en', api)
