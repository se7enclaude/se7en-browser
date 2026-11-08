/* Menus des onglets, des groupes et du bouclier : des menus en verre (voir menuVerre.ts). */
import type { BrowserWindow } from 'electron'
import { afficherMenu } from './menuVerre'
import type { GestionnaireOnglets } from './onglets'
import { estException, hoteDe } from '../bloqueur/bloqueur'

export function ouvrirMenuOnglet(fenetre: BrowserWindow, g: GestionnaireOnglets, id: number): void {
  const etat = g.etat()
  const o = etat.onglets.find((x) => x.id === id)
  if (!o) return
  afficherMenu(fenetre, [
    o.prioritaire
      ? { label: 'Retirer des prioritaires', click: () => g.definirPrioritaire(id, false) }
      : { label: 'Épingler en prioritaire', enabled: !!o.url, click: () => g.definirPrioritaire(id, true) },
    { label: 'Dupliquer', enabled: !!o.url, click: () => g.dupliquer(id) },
    { label: 'Actualiser', enabled: !!o.url && !o.endormi, click: () => g.actualiser(id) },
    { type: 'separator' },
    etat.split && (etat.split.gauche === id || etat.split.droite === id)
      ? { label: 'Quitter la vue partagée', click: () => g.quitterSplit() }
      : id === etat.actifId
        ? { label: 'Vue partagée avec un nouvel onglet', click: () => g.diviser() }
        : { label: "Vue partagée avec l'onglet actif", click: () => g.diviser(id) },
    {
      label: 'Déplacer vers la session',
      visible: !o.prioritaire && !o.prive && etat.sessions.length > 1,
      submenu: etat.sessions.filter((s) => s.id !== o.session).map((s) => ({ label: `${s.emoji} ${s.nom}`, click: () => g.deplacerVersSession(id, s.id) }))
    },
    { type: 'separator' },
    { label: o.prioritaire ? 'Mettre en veille' : 'Fermer', accelerator: 'Ctrl+W', click: () => g.fermer(id) },
    { label: 'Fermer les autres onglets', visible: !o.prioritaire, click: () => g.fermerAutres(id) }
  ])
}

/** Menu principal (bouton en haut à droite). */
export function ouvrirMenuPrincipal(fenetre: BrowserWindow, g: GestionnaireOnglets, ouvrirFichier: () => void, ranger: () => void): void {
  const etat = g.etat()
  afficherMenu(fenetre, [
    { label: 'Nouvel onglet', accelerator: 'Ctrl+T', click: () => g.nouveau() },
    { label: 'Ouvrir un fichier PDF…', accelerator: 'Ctrl+O', click: ouvrirFichier },
    etat.split
      ? { label: 'Quitter la vue partagée', click: () => g.quitterSplit() }
      : { label: 'Vue partagée', click: () => g.diviser() },
    { label: 'Ranger les onglets avec l’IA', enabled: g.ongletsARanger().length >= 3, click: ranger },
    { type: 'separator' },
    { label: 'Historique', accelerator: 'Ctrl+H', click: () => g.ouvrirInterne('se7en://historique') },
    { label: 'Favoris', accelerator: 'Ctrl+Shift+O', click: () => g.ouvrirInterne('se7en://favoris') },
    { label: 'Téléchargements', accelerator: 'Ctrl+J', click: () => g.ouvrirInterne('se7en://telechargements') },
    { label: 'Amis', click: () => g.ouvrirInterne('se7en://amis') },
    { label: 'Recherche approfondie', click: () => g.ouvrirInterne('se7en://recherche') },
    { label: 'Tâches', click: () => g.ouvrirInterne('se7en://taches') },
    { label: 'Extensions', click: () => g.ouvrirInterne('se7en://extensions') },
    { type: 'separator' },
    { label: 'Paramètres', accelerator: 'Ctrl+,', click: () => g.ouvrirInterne('se7en://parametres') }
  ])
}

/** Menu d'un groupe d'onglets. */
export function ouvrirMenuGroupe(fenetre: BrowserWindow, g: GestionnaireOnglets, id: string): void {
  const groupe = g.etat().groupes.find((x) => x.id === id)
  if (!groupe) return
  afficherMenu(fenetre, [
    { label: groupe.replie ? 'Déplier le groupe' : 'Replier le groupe', click: () => g.basculerGroupe(id) },
    { label: 'Dégrouper (garder les onglets)', click: () => g.dissoudreGroupe(id) },
    { type: 'separator' },
    { label: 'Fermer les onglets du groupe', click: () => g.fermerGroupe(id) }
  ])
}

/** Menu du bouclier de la barre d'adresse. */
export function ouvrirMenuBloqueur(
  fenetre: BrowserWindow,
  g: GestionnaireOnglets,
  idOnglet: number,
  r: { actif: boolean; pret: boolean; exceptions: string[]; changer: (actif: boolean, exceptions: string[]) => void }
): void {
  const o = g.etat().onglets.find((x) => x.id === idOnglet)
  if (!o) return
  const hote = hoteDe(o.url)
  const exclu = !!hote && estException(hote, r.exceptions)
  const n = o.bloques
  const resume = !r.actif
    ? 'Bloqueur désactivé'
    : !r.pret
      ? 'Listes de blocage en cours de chargement…'
      : exclu
        ? `Bloqueur désactivé sur ${hote}`
        : `${n} pub${n > 1 ? 's' : ''} et traqueur${n > 1 ? 's' : ''} bloqué${n > 1 ? 's' : ''} sur cette page`
  const recharger = (): void => g.actualiser(idOnglet)
  afficherMenu(fenetre, [
    { label: resume, enabled: false },
    { type: 'separator' },
    {
      label: exclu ? `Réactiver le bloqueur sur ${hote}` : `Désactiver le bloqueur sur ${hote}`,
      visible: !!hote && r.actif,
      click: () => {
        r.changer(r.actif, exclu ? r.exceptions.filter((e) => !(hote === e || hote.endsWith(`.${e}`))) : [...r.exceptions, hote])
        recharger()
      }
    },
    {
      label: 'Bloquer les pubs et les traqueurs',
      type: 'checkbox',
      checked: r.actif,
      click: () => {
        r.changer(!r.actif, r.exceptions)
        recharger()
      }
    }
  ])
}