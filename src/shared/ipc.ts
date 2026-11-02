/* Contrat IPC : la seule liste des canaux entre l'interface et le main.
 * Le preload n'expose que ces canaux ; le main ne répond qu'à eux. */
import type { CommandeUi, EtatOnglets, Zone } from './onglets'
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
  ongletsZone: 'onglets:zone',
  ongletsFocusPage: 'onglets:focus-page'
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
    deplacer(id: number, index: number): void
    naviguer(id: number, saisie: string): void
    precedent(id: number): void
    suivant(id: number): void
    actualiser(id: number): void
    arreter(id: number): void
    /** L'interface indique où afficher la page (elle suit la taille de la fenêtre et des panneaux). */
    zone(z: Zone): void
    /** Rend le clavier à la page (après Entrée dans la barre d'adresse). */
    focusPage(): void
  }
}
