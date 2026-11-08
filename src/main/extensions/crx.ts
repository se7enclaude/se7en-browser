/* Paquet d'extension Chrome (.crx) : un en-tête « Cr24 » (version 2 ou 3) suivi d'une archive zip.
 * On vérifie l'en-tête et on renvoie l'archive zip. (La signature du paquet est celle du Chrome Web Store, d'où on le télécharge en https.) */

export function zipDeCrx(crx: Buffer): Buffer {
  if (crx.length < 16 || crx.toString('latin1', 0, 4) !== 'Cr24') throw new Error("Ce n'est pas un paquet d'extension Chrome.")
  const version = crx.readUInt32LE(4)
  let debut: number
  if (version === 3) debut = 12 + crx.readUInt32LE(8)
  else if (version === 2) debut = 16 + crx.readUInt32LE(8) + crx.readUInt32LE(12)
  else throw new Error(`Version de paquet inconnue (${version}).`)
  if (debut >= crx.length || crx.readUInt32LE(debut) !== 0x04034b50) throw new Error('Paquet d’extension abîmé.')
  return crx.subarray(debut)
}
