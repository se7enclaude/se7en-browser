/* Navigateur par défaut : l'installeur déclare se7en Browser à Windows (Paramètres › Applications par défaut) ;
 * c'est l'utilisateur qui le choisit, Windows ne laisse pas une appli se mettre elle-même par défaut.
 * Les liens ouverts depuis d'autres applis (e-mails, Discord…) arrivent ensuite en argument du programme. */
import { app, shell } from 'electron'
import { execFile } from 'node:child_process'
import { estAdresseAutorisee } from '../shared/adresse'

const PROGID = 'se7enBrowserHTML'
/** Clé du registre où Windows note le navigateur choisi pour les liens https. */
export const CLE_CHOIX_HTTPS = 'HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice'

/** Vrai si Windows ouvre les liens https avec se7en Browser. */
export function estNavigateurParDefaut(): Promise<boolean> {
  return new Promise((ok) => {
    execFile(
      'reg',
      ['query', CLE_CHOIX_HTTPS, '/v', 'ProgId'],
      { windowsHide: true, timeout: 5000 },
      (err, sortie) => ok(!err && sortie.includes(PROGID))
    )
  })
}

/** Ouvre la page de Windows où l'utilisateur choisit son navigateur (sur la fiche de se7en Browser quand c'est possible). */
export function ouvrirChoixNavigateur(): void {
  const page = app.isPackaged ? `ms-settings:defaultapps?registeredAppUser=${encodeURIComponent('se7en Browser')}` : 'ms-settings:defaultapps'
  void shell.openExternal(page).catch(() => shell.openExternal('ms-settings:defaultapps'))
}

/** Adresses web et PDF passés en argument (lien cliqué dans une autre appli, fichier PDF ouvert avec le navigateur). */
export function liensDesArguments(argv: string[]): { urls: string[]; pdfs: string[] } {
  const urls: string[] = []
  const pdfs: string[] = []
  for (const a of argv.slice(1)) {
    if (a.startsWith('--')) continue
    if (estAdresseAutorisee(a)) urls.push(a)
    else if (/^[a-z]:\\.+\.pdf$/i.test(a)) pdfs.push(a)
  }
  return { urls: urls.slice(0, 20), pdfs: pdfs.slice(0, 20) }
}
