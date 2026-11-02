/* Contrat IPC : la seule liste des canaux entre l'interface et le main.
 * Le preload n'expose que ces canaux ; le main ne répond qu'à eux. */
import type { Reglages } from './reglages'

export const CANAUX = {
  // fenêtre
  fenetreReduire: 'fenetre:reduire',
  fenetreAgrandir: 'fenetre:agrandir',
  fenetreFermer: 'fenetre:fermer',
  fenetreEtat: 'fenetre:etat', // main → interface
  // application
  appInfos: 'app:infos',
  // réglages
  reglagesLire: 'reglages:lire',
  reglagesModifier: 'reglages:modifier',
  reglagesChange: 'reglages:change' // main → interface
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
  }
  reglages: {
    lire(): Promise<Reglages>
    modifier(partiel: Partial<Reglages>): Promise<Reglages>
    surChangement(rappel: (r: Reglages) => void): () => void
  }
}
