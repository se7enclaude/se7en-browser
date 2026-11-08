/* Contrat IPC : la seule liste des canaux entre l'interface et le main.
 * Le preload n'expose que ces canaux ; le main ne répond qu'à eux. */
import type { PageInterne } from './adresse'
import type { ActionTelechargement, EntreeHistorique, Favori, SitePopulaire, Telechargement } from './donnees'
import type { Conversation, DemandeChat, FluxChat, ReponseEnvoi, ResumeConversation, Skill, Souvenir } from './chat'
import type { Coffre, EtatCoffre } from './coffre'
import type { AnalyseFormulaire, AnalyseFormulaireWeb, ResultatRemplissage, ValeurARemplir } from './formulaire'
import type { EtatOllama } from './ia'
import type { Materiel } from './materiel'
import type { DemandeTache, Tache } from './taches'
import type { Recherche } from './recherche'
import type { ExtensionInstallee, ExtensionTrouvee } from './extensions'
import type { CommandeUi, EtatOnglets, PageFigee, ZoneOnglet } from './onglets'
import type { Reglages } from './reglages'
import type { EtatVpn } from './vpn'
import type { Actualite, Equipe, JeuGratuit, MeteoActuelle, ResultatsEquipe, SortieJeu, Ville } from './widgets'
import type { Ami, CibleSocial, StatutSocial, EtatEnsemble, EtatSocial, EvenementSocial, GroupeSocial, MessageSocial } from './social'
import type { EtatEcriture } from './ecriture'
import type { EtatMiseAJour } from './miseAJour'
import type { RapportPlantage } from './plantages'

export const CANAUX = {
  // fenêtre
  fenetreReduire: 'fenetre:reduire',
  // rapports de plantage (locaux)
  plantagesLister: 'plantages:lister',
  plantagesVus: 'plantages:vus',
  plantagesEffacer: 'plantages:effacer',
  plantagesSignaler: 'plantages:signaler',
  fenetreAgrandir: 'fenetre:agrandir',
  fenetreFermer: 'fenetre:fermer',
  fenetreEtat: 'fenetre:etat', // main → interface
  // application
  appInfos: 'app:infos',
  appRedemarrer: 'app:redemarrer',
  uiCommande: 'ui:commande', // main → interface
  // notification de message (vue à part, en bas à droite)
  notifMessage: 'notif:message', // main → notification
  notifTaille: 'notif:taille',
  notifOuvrir: 'notif:ouvrir',
  appMenu: 'app:menu',
  appOuvrirFichier: 'app:ouvrir-fichier',
  menuChoix: 'menu:choix',
  sauvegardeExporter: 'sauvegarde:exporter',
  formulaireWebAnalyser: 'formulaire-web:analyser',
  formulaireWebRemplir: 'formulaire-web:remplir',
  sauvegardeImporter: 'sauvegarde:importer',
  raccourciCapture: 'raccourci:capture',
  // VPN (Tor)
  vpnEtat: 'vpn:etat',
  vpnChange: 'vpn:change', // main → interface
  vpnActiver: 'vpn:activer',
  vpnDesactiver: 'vpn:desactiver',
  vpnNouvelleIdentite: 'vpn:nouvelle-identite',
  // widgets du Nouvel onglet
  widgetsVilles: 'widgets:villes',
  widgetsMeteo: 'widgets:meteo',
  widgetsActualites: 'widgets:actualites',
  widgetsJeux: 'widgets:jeux',
  widgetsSorties: 'widgets:sorties',
  widgetsEquipes: 'widgets:equipes',
  widgetsResultats: 'widgets:resultats',
  widgetsTraduire: 'widgets:traduire',
  // réglages
  reglagesLire: 'reglages:lire',
  reglagesModifier: 'reglages:modifier',
  reglagesChange: 'reglages:change', // main → interface
  // onglets
  ongletsLire: 'onglets:lire',
  ongletsEtat: 'onglets:etat', // main → interface
  ongletsNouveau: 'onglets:nouveau',
  ongletsFermer: 'onglets:fermer',
  ongletsActiver: 'onglets:activer',
  ongletsDeplacer: 'onglets:deplacer',
  ongletsNaviguer: 'onglets:naviguer',
  ongletsPrecedent: 'onglets:precedent',
  ongletsSuivant: 'onglets:suivant',
  ongletsActualiser: 'onglets:actualiser',
  ongletsArreter: 'onglets:arreter',
  ongletsZones: 'onglets:zones',
  ongletsFocusPage: 'onglets:focus-page',
  ongletsMenu: 'onglets:menu',
  ongletsPrioritaire: 'onglets:prioritaire',
  ongletsFiger: 'onglets:figer',
  ongletsLiberer: 'onglets:liberer',
  ongletsInterne: 'onglets:interne',
  ongletsDiviser: 'onglets:diviser',
  ongletsNouveauPrive: 'onglets:nouveau-prive',
  sessionChanger: 'session:changer',
  sessionCreer: 'session:creer',
  sessionRenommer: 'session:renommer',
  sessionSupprimer: 'session:supprimer',
  sessionDeplacer: 'session:deplacer',
  ongletsQuitterSplit: 'onglets:quitter-split',
  ongletsRatio: 'onglets:ratio',
  // historique
  historiqueChercher: 'historique:chercher',
  historiquePlusVisites: 'historique:plus-visites',
  historiqueSupprimer: 'historique:supprimer',
  historiqueEffacer: 'historique:effacer',
  // favoris
  favorisLire: 'favoris:lire',
  favorisBasculer: 'favoris:basculer',
  favorisSupprimer: 'favoris:supprimer',
  favorisChange: 'favoris:change', // main → interface
  // téléchargements
  telechargementsLire: 'telechargements:lire',
  telechargementsAction: 'telechargements:action',
  telechargementsEffacer: 'telechargements:effacer',
  telechargementsChange: 'telechargements:change', // main → interface
  // IA locale (Ollama)
  iaEtat: 'ia:etat',
  iaVerifier: 'ia:verifier',
  iaInstaller: 'ia:installer',
  iaDemarrer: 'ia:demarrer',
  iaTelecharger: 'ia:telecharger',
  iaAnnuler: 'ia:annuler',
  iaArreter: 'ia:arreter',
  iaChange: 'ia:change', // main → interface
  iaMateriel: 'ia:materiel',
  tachesLister: 'taches:lister',
  rechercheLister: 'recherche:lister',
  extensionsLister: 'extensions:lister',
  extensionsInstaller: 'extensions:installer',
  extensionsActiver: 'extensions:activer',
  extensionsSupprimer: 'extensions:supprimer',
  extensionsTrouver: 'extensions:trouver',
  extensionsChange: 'extensions:change', // main → interface
  rechercheLancer: 'recherche:lancer',
  rechercheArreter: 'recherche:arreter',
  rechercheSupprimer: 'recherche:supprimer',
  rechercheCle: 'recherche:cle',
  rechercheDefinirCle: 'recherche:definir-cle',
  rechercheChange: 'recherche:change', // main → interface
  tachesCreer: 'taches:creer',
  tachesModifier: 'taches:modifier',
  tachesSupprimer: 'taches:supprimer',
  tachesVerifier: 'taches:verifier',
  tachesChange: 'taches:change', // main → interface
  iaVitesse: 'ia:vitesse',
  // chat avec l'IA
  chatEnvoyer: 'chat:envoyer',
  chatArreter: 'chat:arreter',
  chatFlux: 'chat:flux', // main → interface
  conversationsLister: 'conversations:lister',
  conversationsLire: 'conversations:lire',
  conversationsSupprimer: 'conversations:supprimer',
  skillsLire: 'skills:lire',
  skillsSauver: 'skills:sauver',
  skillsReinitialiser: 'skills:reinitialiser',
  // coffre et formulaires PDF
  coffreLire: 'coffre:lire',
  coffreSauver: 'coffre:sauver',
  formulaireCompter: 'formulaire:compter',
  formulaireAnalyser: 'formulaire:analyser',
  formulaireRemplir: 'formulaire:remplir',
  formulaireEnregistrer: 'formulaire:enregistrer',
  // bloqueur, groupes d'onglets, mémoire
  bloqueurMenu: 'bloqueur:menu',
  ongletsRanger: 'onglets:ranger',
  groupeMenu: 'groupe:menu',
  groupeBasculer: 'groupe:basculer',
  memoireLire: 'memoire:lire',
  memoireAjouter: 'memoire:ajouter',
  memoireSupprimer: 'memoire:supprimer',
  memoireEffacer: 'memoire:effacer',
  // profils et amis
  socialEtat: 'social:etat',
  socialChange: 'social:change', // main → interface
  socialEvenement: 'social:evenement', // main → interface
  socialProfil: 'social:profil',
  socialPhoto: 'social:photo',
  socialChoisirPhoto: 'social:choisir-photo',
  socialSupprimer: 'social:supprimer',
  socialAmis: 'social:amis',
  socialAjouter: 'social:ajouter',
  socialAccepter: 'social:accepter',
  socialRetirer: 'social:retirer',
  socialMessages: 'social:messages',
  socialEnvoyer: 'social:envoyer',
  socialEnvoyerOnglet: 'social:envoyer-onglet',
  socialLu: 'social:lu',
  socialOuvrirLien: 'social:ouvrir-lien',
  socialGroupes: 'social:groupes',
  socialCreerGroupe: 'social:creer-groupe',
  socialAjouterMembre: 'social:ajouter-membre',
  socialRenommerGroupe: 'social:renommer-groupe',
  socialQuitterGroupe: 'social:quitter-groupe',
  socialImage: 'social:image',
  socialEnvoyerImage: 'social:envoyer-image',
  socialEcrit: 'social:ecrit',
  socialCodeSecours: 'social:code-secours',
  socialEnregistrerCode: 'social:enregistrer-code',
  socialRecuperer: 'social:recuperer',
  socialEnvoyerVocal: 'social:envoyer-vocal',
  socialStatut: 'social:statut',
  discussionOuvrir: 'discussion:ouvrir',
  discussionFermer: 'discussion:fermer',
  discussionAgrandir: 'discussion:agrandir',
  ensembleEtat: 'ensemble:etat',
  ensembleChange: 'ensemble:change', // main → interface
  ensembleInviter: 'ensemble:inviter',
  ensembleRepondre: 'ensemble:repondre',
  ensembleMain: 'ensemble:main',
  ensembleArreter: 'ensemble:arreter',
  // aide à l'écriture, zone de l'écran, insertion d'une réponse dans la page
  ecritureEtat: 'ecriture:etat', // main → interface
  ecritureAppliquer: 'ecriture:appliquer',
  ecritureAnnuler: 'ecriture:annuler',
  iaZone: 'ia:zone',
  iaInserer: 'ia:inserer',
  navigationNombre: 'navigation:nombre',
  navigationEffacer: 'navigation:effacer',
  majEtat: 'maj:etat',
  majChange: 'maj:change', // main → interface
  majVerifier: 'maj:verifier',
  majInstaller: 'maj:installer',
  favorisImporter: 'favoris:importer',
  defautEtat: 'defaut:etat',
  defautChoisir: 'defaut:choisir',
  phishingIgnorer: 'phishing:ignorer',
  traductionTraduire: 'traduction:traduire',
  traductionOriginal: 'traduction:original'
} as const

export interface EtatFenetre {
  agrandie: boolean
  focus: boolean
}

export interface InfosApp {
  version: string
  /** Vrai si Windows applique l'effet de verre natif (Windows 11 22H2 ou plus récent). */
  effetNatif: boolean
  /** PC modeste (peu de cœurs, peu de mémoire ou pas d'accélération graphique) : effets de verre allégés en « auto ». */
  modeste: boolean
  /** Accélération graphique active pour cette session (elle ne change qu'au redémarrage). */
  acceleration: boolean
}

/** API exposée à l'interface par le preload, sous window.se7en. */
export interface ApiSe7en {
  fenetre: {
    reduire(): void
    agrandir(): void
    fermer(): void
    surEtat(rappel: (etat: EtatFenetre) => void): () => void
  }
  app: {
    infos(): Promise<InfosApp>
    surCommande(rappel: (c: CommandeUi) => void): () => void
    /** Menu principal (historique, favoris, téléchargements, paramètres). */
    menu(): void
    /** Choisir un PDF sur le PC et l'ouvrir dans un onglet. */
    ouvrirFichier(): void
    /** Réponse à un menu en verre : l'entrée choisie, ou null (fermé sans choix). */
    choixMenu(id: number, entree: string | null): void
    /** Les Paramètres attendent une combinaison : les raccourcis du navigateur sont suspendus. */
    captureRaccourci(active: boolean): void
    /** Relance le navigateur (réglage appliqué au démarrage). */
    redemarrer(): void
  }
  reglages: {
    lire(): Promise<Reglages>
    modifier(partiel: Partial<Reglages>): Promise<Reglages>
    surChangement(rappel: (r: Reglages) => void): () => void
  }
  onglets: {
    lire(): Promise<EtatOnglets>
    surEtat(rappel: (e: EtatOnglets) => void): () => void
    /** Ouvre un onglet ; `saisie` est ce que l'utilisateur a tapé (adresse ou recherche), vide = Nouvel onglet. */
    nouveau(saisie?: string): void
    fermer(id: number): void
    activer(id: number): void
    /** Met l'onglet `id` à la place de l'onglet `versId` (glisser-déposer, y compris d'une liste à l'autre). */
    deplacer(id: number, versId: number): void
    /** Menu clic droit de l'onglet. */
    menu(id: number): void
    /** Épingle l'onglet dans la barre latérale (ou l'en retire). */
    prioritaire(id: number, oui: boolean): void
    /** Fige les pages visibles : leur image est renvoyée et elles sont cachées, le temps qu'une animation
     * ou un écran de l'interface passe devant. Chaque appel doit être suivi d'un `liberer()`. */
    figer(): Promise<PageFigee[]>
    liberer(): void
    /** Ouvre une page interne (paramètres, historique…), ou revient sur son onglet. */
    interne(page: PageInterne): void
    naviguer(id: number, saisie: string): void
    precedent(id: number): void
    suivant(id: number): void
    actualiser(id: number): void
    arreter(id: number): void
    /** L'interface indique où afficher chaque page visible (elle suit la fenêtre, les panneaux et la vue partagée). */
    zones(liste: ZoneOnglet[]): void
    /** Rend le clavier à la page (après Entrée dans la barre d'adresse). */
    focusPage(): void
    /** Vue partagée entre l'onglet actif et un autre (un Nouvel onglet si aucun n'est donné). */
    diviser(avecId?: number, aGauche?: boolean): void
    /** Ouvre un onglet privé (Ctrl+Maj+N). */
    nouveauPrive(): void
    /** Sessions d'onglets (espaces « Jeux vidéo », « Recherche travail »…). */
    changerSession(id: string): void
    creerSession(nom: string, emoji: string): void
    renommerSession(id: string, nom: string, emoji?: string): void
    supprimerSession(id: string): void
    deplacerVersSession(idOnglet: number, session: string): void
    quitterSplit(): void
    ratio(r: number): void
  }
  /** Extensions du Chrome Web Store (pages web seulement, jamais l'interface ni l'IA). */
  extensions: {
    lister(): Promise<ExtensionInstallee[]>
    /** Installe depuis le Chrome Web Store, par son lien ou son identifiant. */
    installer(lienOuId: string): Promise<ExtensionInstallee | { erreur: string }>
    activer(id: string, activee: boolean): void
    supprimer(id: string): void
    /** Extensions des autres navigateurs du PC (identifiant et nom seulement). */
    trouver(): Promise<ExtensionTrouvee[]>
    surChangement(rappel: (l: ExtensionInstallee[]) => void): () => void
  }
  /** Recherche approfondie en local : sources lues sur le PC, rapport où chaque affirmation renvoie à sa source. */
  recherche: {
    lister(): Promise<Recherche[]>
    lancer(question: string): Promise<Recherche | { erreur: string }>
    arreter(): void
    supprimer(id: string): void
    /** Vrai si une clé de l'API Brave Search est enregistrée (chiffrée avec le compte Windows). */
    cle(): Promise<boolean>
    definirCle(cle: string | null): Promise<boolean>
    surChangement(rappel: (r: Recherche) => void): () => void
  }
  /** Tâches en arrière-plan : pages surveillées (prix, changement, résumé du jour). */
  taches: {
    lister(): Promise<Tache[]>
    /** Surveille une page (l'onglet actif, en général). */
    creer(url: string, titre: string, demande: DemandeTache): Promise<Tache | { erreur: string }>
    modifier(id: string, partiel: { active?: boolean; seuil?: number | null; intervalleMin?: number; heure?: string }): void
    supprimer(id: string): void
    verifier(id: string): void
    surChangement(rappel: (t: Tache[]) => void): () => void
  }
  /** VPN gratuit du navigateur (réseau Tor), activé seulement par l'utilisateur. */
  vpn: {
    etat(): Promise<EtatVpn>
    surEtat(rappel: (e: EtatVpn) => void): () => void
    /** Active le VPN avec ce pays de sortie ('' : automatique), ou change de pays s'il est actif. */
    activer(pays: string): void
    desactiver(): void
    nouvelleIdentite(): void
  }
  /** Données des widgets du Nouvel onglet (récupérées par le main ; null si le service ne répond pas). */
  widgets: {
    villes(nom: string): Promise<Ville[] | null>
    meteo(ville: Ville): Promise<MeteoActuelle | null>
    actualites(source: string): Promise<Actualite[] | null>
    jeux(): Promise<JeuGratuit[] | null>
    sorties(): Promise<SortieJeu[] | null>
    equipes(nom: string): Promise<(Equipe & { sport: string })[] | null>
    resultats(equipe: Equipe): Promise<ResultatsEquipe | null>
    /** Traduit avec l'IA locale ; une erreur si elle n'est pas prête. */
    traduire(texte: string, langue: string): Promise<{ texte: string } | { erreur: string }>
  }
  historique: {
    chercher(texte: string): Promise<EntreeHistorique[]>
    plusVisites(n: number): Promise<SitePopulaire[]>
    supprimer(ids: string[]): Promise<void>
    effacer(): Promise<void>
  }
  favoris: {
    lire(): Promise<Favori[]>
    /** Ajoute (ou retire) la page de l'onglet aux favoris. */
    basculer(idOnglet: number): void
    supprimer(id: string): void
    surChangement(rappel: (f: Favori[]) => void): () => void
    /** Choisir le fichier de favoris exporté d'un autre navigateur et l'importer (null : annulé). */
    importer(): Promise<{ ajoutes: number; trouves: number } | { erreur: string } | null>
  }
  /** Naviguer ensemble : un onglet partagé en direct avec un ami. */
  ensemble: {
    etat(): Promise<EtatEnsemble>
    surEtat(rappel: (e: EtatEnsemble) => void): () => void
    inviter(ami: string, idOnglet: number): Promise<{ ok: true } | { erreur: string }>
    repondre(accepter: boolean): void
    prendreLaMain(): void
    arreter(): void
  }
  /** Remplir le formulaire d'une page web avec le coffre (après confirmation de l'utilisateur). */
  formulaireWeb: {
    analyser(idOnglet: number): Promise<(AnalyseFormulaireWeb & { phishing: string | null }) | { erreur: string }>
    remplir(idOnglet: number, valeurs: { nom: string; valeur: string }[]): Promise<{ remplis: number } | { erreur: string }>
  }
  /** Sauvegarde chiffrée (réglages, coffre, favoris, Skills) dans un fichier protégé par un mot de passe. */
  sauvegarde: {
    exporter(motDePasse: string): Promise<{ ok: true; fichier: string } | { erreur: string } | null>
    importer(motDePasse: string): Promise<{ ok: true; favoris: number } | { erreur: string } | null>
  }
  traduction: {
    /** Traduit la page de l'onglet en français, en gardant sa mise en page (IA locale). */
    traduire(id: number): void
    /** Remet le texte d'origine (et arrête une traduction en cours). */
    original(id: number): void
  }
  phishing: {
    /** « Je fais confiance à ce site » : plus d'alerte pour ce site (l'onglet est rechargé sans alerte). */
    ignorer(idOnglet: number): void
  }
  navigateurDefaut: {
    /** Vrai si Windows ouvre les liens avec se7en Browser. */
    etat(): Promise<boolean>
    /** Ouvre la page de Windows pour choisir le navigateur par défaut. */
    choisir(): void
  }
  telechargements: {
    lire(): Promise<Telechargement[]>
    action(id: string, action: ActionTelechargement): void
    effacer(): void
    surChangement(rappel: (t: Telechargement[]) => void): () => void
  }
  ia: {
    etat(): Promise<EtatOllama>
    /** Regarde à nouveau si Ollama est installé, lancé, et quels modèles il a. */
    verifier(): Promise<EtatOllama>
    /** Télécharge l'installeur officiel d'Ollama, vérifie sa signature et l'installe. */
    installer(): void
    /** Active l'IA : lance Ollama pour la durée de la session du navigateur. */
    demarrer(): void
    /** Désactive l'IA (si c'est le navigateur qui l'a lancée). */
    arreter(): void
    /** Capture l'onglet actif pour y choisir une zone (la capture arrive par app.surCommande). */
    zone(): void
    /** Insère un texte (réponse proposée par l'IA) dans le champ où se trouve le curseur, dans la page de l'onglet. */
    inserer(idOnglet: number, texte: string): Promise<boolean>
    /** Télécharge ces modèles (noms Ollama, ex. « qwen3:8b »). */
    telecharger(noms: string[]): void
    annuler(): void
    /** Mémoire et carte graphique du PC, pour proposer le bon modèle. */
    materiel(): Promise<Materiel>
    /** Mesure la vitesse d'un modèle téléchargé (jetons par seconde), ou null si le test échoue. */
    vitesse(modele: string): Promise<number | null>
    surChangement(rappel: (e: EtatOllama) => void): () => void
  }
  chat: {
    /** Pose une question ; la réponse arrive par surFlux. */
    envoyer(d: DemandeChat): Promise<ReponseEnvoi | { erreur: string }>
    arreter(): void
    surFlux(rappel: (f: FluxChat) => void): () => void
    conversations(): Promise<ResumeConversation[]>
    conversation(id: string): Promise<Conversation | null>
    supprimer(id: string): Promise<void>
  }
  skills: {
    lire(): Promise<Skill[]>
    sauver(liste: Skill[]): Promise<Skill[]>
    reinitialiser(): Promise<Skill[]>
  }
  coffre: {
    lire(): Promise<EtatCoffre>
    sauver(c: Coffre): Promise<EtatCoffre | { erreur: string }>
  }
  formulaire: {
    /** Nombre de champs de texte du PDF de l'onglet (0 : pas un formulaire). */
    compter(idOnglet: number): Promise<number>
    /** Champs, libellés et valeurs proposées (l'IA ne voit pas les valeurs). */
    analyser(idOnglet: number): Promise<AnalyseFormulaire | { erreur: string }>
    /** Remplit, après confirmation de l'utilisateur, dans un nouveau fichier affiché dans l'onglet. */
    remplir(idOnglet: number, valeurs: ValeurARemplir[]): Promise<ResultatRemplissage | { erreur: string }>
    enregistrerSous(idOnglet: number): Promise<string | null | { erreur: string }>
  }
  bloqueur: {
    /** Menu du bouclier : nombre de blocages, désactiver sur ce site, activer / désactiver. */
    menu(idOnglet: number): void
  }
  groupes: {
    /** L'IA range les onglets en groupes par sujet. */
    ranger(): Promise<{ groupes: number } | { erreur: string }>
    basculer(id: string): void
    menu(id: string): void
  }
  memoire: {
    lire(): Promise<Souvenir[]>
    ajouter(texte: string): Promise<Souvenir[]>
    supprimer(id: string): Promise<Souvenir[]>
    effacer(): Promise<Souvenir[]>
  }
  plantages: {
    lister(): Promise<{ rapports: RapportPlantage[]; nonVus: number }>
    /** L'utilisateur a vu les rapports : le bandeau ne revient plus pour eux. */
    vus(): void
    /** Efface un rapport (ou tous, sans identifiant). */
    effacer(id?: string): Promise<{ rapports: RapportPlantage[]; nonVus: number }>
    /** Erreur JavaScript de l'interface, notée dans les rapports. */
    signaler(message: string, pile: string): void
  }
  miseAJour: {
    etat(): Promise<EtatMiseAJour>
    verifier(): Promise<EtatMiseAJour>
    /** Installe la mise à jour téléchargée et rouvre le navigateur. */
    installer(): void
    surChangement(rappel: (e: EtatMiseAJour) => void): () => void
  }
  navigation: {
    /** Nombre de pages gardées dans la mémoire de navigation. */
    nombre(): Promise<number>
    effacer(): Promise<number>
  }
  ecriture: {
    /** Proposition de réécriture en cours (null : aucune). */
    surEtat(rappel: (e: EtatEcriture | null) => void): () => void
    /** « Remplacer » : la proposition (éventuellement retouchée) remplace le texte du champ. */
    appliquer(id: string, texte: string): void
    annuler(): void
  }
  social: {
    etat(): Promise<EtatSocial>
    surEtat(rappel: (e: EtatSocial) => void): () => void
    /** Messages, demandes d'amis et présence, en direct. */
    surEvenement(rappel: (e: EvenementSocial) => void): () => void
    /** Crée le profil (première fois) ou change le pseudo. */
    profil(pseudo: string): Promise<EtatSocial | { erreur: string }>
    /** Photo d'un ami ou la sienne (data: URL), ou null. */
    photo(id: string): Promise<string | null>
    /** Choisit une image sur le PC, la réduit et l'envoie comme photo de profil. */
    choisirPhoto(): Promise<{ ok: true } | { erreur: string } | null>
    supprimer(): Promise<EtatSocial | { erreur: string }>
    amis(): Promise<Ami[] | { erreur: string }>
    /** Demande d'ami par « pseudo#1234 ». */
    ajouter(code: string): Promise<{ statut: string } | { erreur: string }>
    accepter(id: string): Promise<{ ok: true } | { erreur: string }>
    /** Refuse une demande, l'annule, ou retire un ami. */
    retirer(id: string): Promise<{ ok: true } | { erreur: string }>
    messages(cible: CibleSocial, avant?: number): Promise<MessageSocial[] | { erreur: string }>
    envoyer(cible: CibleSocial, texte: string): Promise<MessageSocial | { erreur: string }>
    /** Envoie l'adresse et le titre de l'onglet à un ami ou un groupe. */
    envoyerOnglet(cible: CibleSocial, idOnglet: number, avecResume?: boolean): Promise<MessageSocial | { erreur: string }>
    lu(cible: CibleSocial): void
    groupes(): Promise<GroupeSocial[] | { erreur: string }>
    creerGroupe(nom: string, membres: string[]): Promise<{ id: string } | { erreur: string }>
    ajouterMembre(groupe: string, id: string): Promise<{ ok: true } | { erreur: string }>
    renommerGroupe(groupe: string, nom: string): Promise<{ ok: true } | { erreur: string }>
    quitterGroupe(groupe: string): Promise<{ ok: true } | { erreur: string }>
    /** Image d'un message (data: URL), ou null. */
    image(id: string): Promise<string | null>
    /** Envoie une image : choisie sur le PC, capture d'un onglet, ou collée (data: URL). Réduite avant l'envoi. */
    envoyerImage(
      cible: CibleSocial,
      source: { type: 'fichier' } | { type: 'capture'; idOnglet: number } | { type: 'collee'; donnees: string }
    ): Promise<MessageSocial | { erreur: string } | null>
    /** « Je suis en train d'écrire » (à envoyer de temps en temps pendant la frappe). */
    ecrit(cible: CibleSocial): void
    /** Code de secours du profil de ce PC (pour le retrouver sur un autre PC). */
    codeSecours(): Promise<string | null>
    /** Enregistre le code de secours dans un fichier texte choisi par l'utilisateur. */
    enregistrerCode(): Promise<boolean>
    /** Retrouve un profil existant avec son code de secours. */
    recuperer(code: string): Promise<EtatSocial | { erreur: string }>
    /** Envoie un message vocal enregistré par l'interface (WebM/Opus). */
    envoyerVocal(cible: CibleSocial, son: Uint8Array, type: string): Promise<MessageSocial | { erreur: string }>
    /** Change son statut (null : disponible). */
    statut(s: StatutSocial | null): Promise<EtatSocial | { erreur: string }>
    /** Ouvre la conversation dans la petite fenêtre de discussion, au-dessus de la page. */
    discussion(cible: CibleSocial): void
    /** Ferme la petite fenêtre de discussion. */
    fermerDiscussion(): void
    /** Ferme la petite fenêtre et ouvre la conversation en grand (page Amis). */
    agrandirDiscussion(cible: CibleSocial): void
    /** Ouvre un lien reçu dans un nouvel onglet (http/https seulement). */
    ouvrirLien(url: string): void
  }
}