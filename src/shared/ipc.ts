/* Contrat IPC : la seule liste des canaux entre l'interface et le main.
 * Le preload n'expose que ces canaux ; le main ne répond qu'à eux. */
import type { PageInterne } from './adresse'
import type { ActionTelechargement, EntreeHistorique, Favori, SitePopulaire, Telechargement } from './donnees'
import type { CommandeUi, EtatOnglets, ZoneOnglet } from './onglets'
import type { Reglages } from './reglages'

export const CANAUX = {
  // fenêtre
  fenetreReduire: 'fenetre:reduire',
  fenetreAgrandir: 'fenetre:agrandir',
  fenetreFermer: 'fenetre:fermer',
  fenetreEtat: 'fenetre:etat', // main → interface
  // application
  appInfos: 'app:infos',
  uiCommande: 'ui:commande', // main → interface
  appMenu: 'app:menu',
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
  ongletsMasquer: 'onglets:masquer',
  ongletsInterne: 'onglets:interne',
  ongletsDiviser: 'onglets:diviser',
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
  telechargementsChange: 'telechargements:change' // main → interface
} as const

export interface EtatFenetre {
  agrandie: boolean
  focus: boolean
}

export interface InfosApp {
  version: string
  /** Vrai si Windows applique l'effet de verre natif (Windows 11 22H2 ou plus récent). */
  effetNatif: boolean
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
    /** Cache les pages pendant qu'un écran de l'interface passe devant (accueil). */
    masquer(oui: boolean): void
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
    diviser(avecId?: number): void
    quitterSplit(): void
    ratio(r: number): void
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
  }
  telechargements: {
    lire(): Promise<Telechargement[]>
    action(id: string, action: ActionTelechargement): void
    effacer(): void
    surChangement(rappel: (t: Telechargement[]) => void): () => void
  }
}
