/* Identité sociale : une paire de clés Ed25519 créée sur ce PC, à la place d'un mot de passe.
 * La clé privée est chiffrée avec le compte Windows (safeStorage → DPAPI) dans identite.bin et ne sort jamais du PC ;
 * le serveur ne connaît que la clé publique. Chaque requête est signée (voir server/src/auth.ts). */
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
