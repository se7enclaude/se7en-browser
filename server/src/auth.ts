/* Authentification par signature Ed25519 : pas de mot de passe, pas de session.
 * Chaque requête porte la clé publique, l'heure, un nonce et la signature de :
 *   MÉTHODE \n chemin \n heure \n nonce \n sha256(corps en hexa)
 * Le serveur vérifie la signature, refuse une heure trop éloignée (2 min) et un nonce déjà vu. */

export const FENETRE = 2 * 60 * 1000

export function b64urlVersOctets(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  const bin = atob(b64)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export async function sha256Hex(octets: ArrayBuffer | Uint8Array): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', octets))
  return [...h].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function texteASigner(methode: string, chemin: string, heure: string, nonce: string, empreinteCorps: string): string {
  return `${methode.toUpperCase()}\n${chemin}\n${heure}\n${nonce}\n${empreinteCorps}`
}

export interface Signature {
  cle: string
  heure: string
  nonce: string
  signature: string
}

/** Vérifie la signature Ed25519. Renvoie vrai si elle est valide (l'heure et le nonce sont vérifiés à part). */
export async function verifier(s: Signature, methode: string, chemin: string, corps: ArrayBuffer): Promise<boolean> {
  try {
    const cle = b64urlVersOctets(s.cle)
    const sig = b64urlVersOctets(s.signature)
    if (cle.length !== 32 || sig.length !== 64 || !/^[\w-]{16,64}$/.test(s.nonce) || !/^\d{13}$/.test(s.heure)) return false
    const publique = await crypto.subtle.importKey('raw', cle, { name: 'Ed25519' }, false, ['verify'])
    const message = new TextEncoder().encode(texteASigner(methode, chemin, s.heure, s.nonce, await sha256Hex(corps)))
    return await crypto.subtle.verify('Ed25519', publique, sig, message)
  } catch {
    return false
  }
}
