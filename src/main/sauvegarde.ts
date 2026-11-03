/* Sauvegarde chiffrée : réglages, coffre, favoris et Skills dans un seul fichier « .se7en », protégé par un mot de passe
 * choisi par l'utilisateur (dérivé avec scrypt, chiffré en AES-256-GCM : un fichier modifié ou un mauvais mot de passe
 * est refusé). Le fichier peut être gardé sur une clé USB ou un autre PC ; sans le mot de passe, il est illisible.
 * Ni l'historique, ni la mémoire de l'IA, ni le profil social n'y sont (le profil a son propre code de secours). */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

const MAGIE = Buffer.from('SE7ENSAV1')
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
export const MOT_DE_PASSE_MIN = 8

export interface ContenuSauvegarde {
  version: 1
  date: number
  reglages: unknown
  coffre: unknown
  favoris: unknown
  skills: unknown
}

export function chiffrer(contenu: ContenuSauvegarde, motDePasse: string): Buffer {
  const sel = randomBytes(16)
  const iv = randomBytes(12)
  const cle = scryptSync(motDePasse.normalize('NFC'), sel, 32, SCRYPT)
  const c = createCipheriv('aes-256-gcm', cle, iv)
  c.setAAD(MAGIE)
  const chiffre = Buffer.concat([c.update(JSON.stringify(contenu), 'utf8'), c.final()])
  return Buffer.concat([MAGIE, sel, iv, c.getAuthTag(), chiffre])
}

/** Null : ce n'est pas une sauvegarde se7en, ou le mot de passe est faux (impossible de distinguer, volontairement). */
export function dechiffrer(fichier: Buffer, motDePasse: string): ContenuSauvegarde | null {
  if (fichier.length < MAGIE.length + 44 || !fichier.subarray(0, MAGIE.length).equals(MAGIE)) return null
  let o = MAGIE.length
  const sel = fichier.subarray(o, (o += 16))
  const iv = fichier.subarray(o, (o += 12))
  const tag = fichier.subarray(o, (o += 16))
  try {
    const cle = scryptSync(motDePasse.normalize('NFC'), sel, 32, SCRYPT)
    const d = createDecipheriv('aes-256-gcm', cle, iv)
    d.setAAD(MAGIE)
    d.setAuthTag(tag)
    const json = Buffer.concat([d.update(fichier.subarray(o)), d.final()]).toString('utf8')
    const c = JSON.parse(json) as ContenuSauvegarde
    return c?.version === 1 ? c : null
  } catch {
    return null
  }
}
