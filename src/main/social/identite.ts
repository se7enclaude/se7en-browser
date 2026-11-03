/* Identité sociale : une paire de clés Ed25519 créée sur ce PC, à la place d'un mot de passe.
 * La clé privée est chiffrée avec le compte Windows (safeStorage → DPAPI) dans identite.bin ;
 * le serveur ne connaît que la clé publique. Chaque requête est signée (voir server/src/auth.ts).
 * Le « code de secours » est cette clé écrite en clair (lettres et chiffres) : l'utilisateur le garde pour
 * retrouver son profil sur un autre PC. Il ne sort du PC que si l'utilisateur l'affiche lui-même. */
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto'

export interface EnTetesSignes {
  'X-Se7en-Cle': string
  'X-Se7en-Heure': string
  'X-Se7en-Nonce': string
  'X-Se7en-Signature': string
}

/** Texte signé : identique à celui que vérifie le serveur. */
export function texteASigner(methode: string, chemin: string, heure: string, nonce: string, corps: Uint8Array): string {
  const empreinte = createHash('sha256').update(corps).digest('hex')
  return `${methode.toUpperCase()}\n${chemin}\n${heure}\n${nonce}\n${empreinte}`
}

export class Identite {
  readonly clePublique: string

  private constructor(private readonly privee: KeyObject) {
    // clé publique brute (32 octets) en base64url : c'est le « x » de sa forme JWK
    this.clePublique = String(createPublicKey(privee).export({ format: 'jwk' }).x)
  }

  static nouvelle(): Identite {
    return new Identite(generateKeyPairSync('ed25519').privateKey)
  }

  /** Recrée l'identité à partir de sa clé privée (PKCS8 PEM). */
  static depuis(pem: string): Identite {
    return new Identite(createPrivateKey(pem))
  }

  /** Code de secours : la graine de la clé (32 octets) et 2 octets de contrôle, en base 32, par groupes de 5. */
  codeSecours(): string {
    const d = String(this.privee.export({ format: 'jwk' }).d)
    const graine = Buffer.from(d, 'base64url')
    return enBase32(Buffer.concat([graine, controle(graine)]))
      .match(/.{1,5}/g)!
      .join('-')
  }

  /** Recrée l'identité depuis un code de secours (espaces, tirets et minuscules acceptés) ; null si le code est faux. */
  static depuisCode(code: string): Identite | null {
    const octets = depuisBase32(code.toUpperCase().replace(/[\s-]/g, ''))
    if (!octets || octets.length !== 34) return null
    const graine = octets.subarray(0, 32)
    if (!controle(graine).equals(octets.subarray(32))) return null
    // clé privée Ed25519 au format PKCS8 : en-tête fixe, puis la graine
    const der = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), graine])
    return new Identite(createPrivateKey({ key: der, format: 'der', type: 'pkcs8' }))
  }

  exporter(): string {
    return String(this.privee.export({ format: 'pem', type: 'pkcs8' }))
  }

  /** En-têtes à joindre à une requête (chemin sans les paramètres d'adresse). */
  signer(methode: string, chemin: string, corps: Uint8Array = new Uint8Array()): EnTetesSignes {
    const heure = String(Date.now())
    const nonce = randomBytes(18).toString('base64url')
    const signature = sign(null, Buffer.from(texteASigner(methode, chemin, heure, nonce, corps)), this.privee).toString('base64url')
    return { 'X-Se7en-Cle': this.clePublique, 'X-Se7en-Heure': heure, 'X-Se7en-Nonce': nonce, 'X-Se7en-Signature': signature }
  }
}

// Base 32 de Crockford : pas de I, L, O ni U (rien à confondre en recopiant le code)
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

const controle = (graine: Uint8Array): Buffer => createHash('sha256').update(graine).digest().subarray(0, 2)

function enBase32(octets: Uint8Array): string {
  let bits = 0
  let valeur = 0
  let res = ''
  for (const o of octets) {
    valeur = (valeur << 8) | o
    bits += 8
    while (bits >= 5) {
      res += ALPHABET[(valeur >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) res += ALPHABET[(valeur << (5 - bits)) & 31]
  return res
}

function depuisBase32(texte: string): Buffer | null {
  // lettres faciles à confondre : O → 0, I et L → 1
  const t = texte.replace(/O/g, '0').replace(/[IL]/g, '1')
  let bits = 0
  let valeur = 0
  const res: number[] = []
  for (const c of t) {
    const v = ALPHABET.indexOf(c)
    if (v < 0) return null
    valeur = ((valeur << 5) | v) & 0xffff
    bits += 5
    if (bits >= 8) {
      res.push((valeur >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(res)
}
