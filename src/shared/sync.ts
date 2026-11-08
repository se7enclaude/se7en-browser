/* Synchronisation chiffrée de bout en bout entre tes PC : favoris, Skills, apparence et moteur de recherche,
 * et la liste des onglets ouverts sur chaque PC. La clé est créée sur ton PC et ne part jamais : le serveur ne garde
 * qu'un paquet chiffré qu'il ne peut pas lire. Logique pure ici (code de liaison, fusion), testée. */

export type CategorieSync = 'favoris' | 'skills' | 'reglages'
export const CATEGORIES_SYNC: CategorieSync[] = ['favoris', 'skills', 'reglages']

/** Réglages qui voyagent d'un PC à l'autre (pas ceux qui dépendent du PC : modèles, accélération, MCP…). */
export const REGLAGES_SYNCHRONISES = ['theme', 'teinte', 'disposition', 'moteurRecherche', 'effetsVerre', 'raccourcis'] as const

export interface OngletDistant {
  titre: string
  url: string
}

export interface AppareilSync {
  nom: string
  maj: number
  onglets: OngletDistant[]
}

export interface PaquetSync {
  v: 1
  categories: Partial<Record<CategorieSync, { modif: number; valeur: unknown }>>
  appareils: Record<string, AppareilSync>
}

export const PAQUET_VIDE: PaquetSync = { v: 1, categories: {}, appareils: {} }

/** Un appareil qui ne s'est pas synchronisé depuis 30 jours disparaît de la liste. */
const OUBLI_APPAREIL = 30 * 24 * 3600 * 1000

/** Fusion : pour chaque catégorie, la modification la plus récente gagne ; chaque appareil garde sa dernière liste d'onglets. */
export function fusionnerPaquets(a: PaquetSync, b: PaquetSync, maintenant = Date.now()): PaquetSync {
  const categories: PaquetSync['categories'] = {}
  for (const c of CATEGORIES_SYNC) {
    const x = a.categories[c]
    const y = b.categories[c]
    const choisi = !x ? y : !y ? x : y.modif > x.modif ? y : x
    if (choisi) categories[c] = choisi
  }
  const appareils: PaquetSync['appareils'] = {}
  for (const [id, ap] of [...Object.entries(a.appareils), ...Object.entries(b.appareils)]) {
    if (maintenant - ap.maj > OUBLI_APPAREIL) continue
    if (!appareils[id] || ap.maj > appareils[id].maj) appareils[id] = ap
  }
  return { v: 1, categories, appareils }
}

/** Lit un paquet déchiffré venu du serveur (données non fiables : chaque champ est vérifié). */
export function lirePaquet(brut: unknown): PaquetSync {
  if (!brut || typeof brut !== 'object' || (brut as PaquetSync).v !== 1) return PAQUET_VIDE
  const b = brut as PaquetSync
  const categories: PaquetSync['categories'] = {}
  for (const c of CATEGORIES_SYNC) {
    const x = b.categories?.[c]
    if (x && typeof x.modif === 'number') categories[c] = { modif: x.modif, valeur: x.valeur }
  }
  const appareils: PaquetSync['appareils'] = {}
  for (const [id, ap] of Object.entries(b.appareils ?? {}).slice(0, 20)) {
    if (!/^[\w-]{1,40}$/.test(id) || !ap || typeof ap.nom !== 'string' || typeof ap.maj !== 'number' || !Array.isArray(ap.onglets)) continue
    appareils[id] = {
      nom: ap.nom.slice(0, 60),
      maj: ap.maj,
      onglets: ap.onglets
        .filter((o): o is OngletDistant => !!o && typeof o.url === 'string' && /^https?:\/\//.test(o.url) && typeof o.titre === 'string')
        .slice(0, 100)
        .map((o) => ({ url: o.url.slice(0, 2000), titre: o.titre.slice(0, 200) }))
    }
  }
  return { v: 1, categories, appareils }
}

// ---------- code de liaison : la clé (32 octets) écrite en base 32, par groupes de 4, avec une somme de contrôle ----------
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // base 32 de Crockford (sans I, L, O, U)

function controle(octets: Uint8Array): string {
  let s = 7
  for (const o of octets) s = (s * 31 + o) % 1024
  return ALPHABET[s >> 5] + ALPHABET[s & 31]
}

export function codeDeCle(cle: Uint8Array): string {
  let bits = 0
  let val = 0
  let txt = ''
  for (const o of cle) {
    val = ((val << 8) | o) & 0xffff
    bits += 8
    while (bits >= 5) {
      txt += ALPHABET[(val >> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits) txt += ALPHABET[(val << (5 - bits)) & 31]
  return (txt + controle(cle)).match(/.{1,4}/g)!.join('-')
}

/** Clé à partir d'un code tapé ou collé (tirets, espaces, minuscules et confusions O/0, I/L/1 tolérés), ou null. */
export function cleDeCode(code: string): Uint8Array | null {
  const t = code
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
  if (t.length !== 54 || [...t].some((c) => !ALPHABET.includes(c))) return null
  const octets = new Uint8Array(32)
  let bits = 0
  let val = 0
  let i = 0
  for (const c of t.slice(0, 52)) {
    val = ((val << 5) | ALPHABET.indexOf(c)) & 0xffff
    bits += 5
    if (bits >= 8) {
      if (i < 32) octets[i++] = (val >> (bits - 8)) & 255
      bits -= 8
    }
  }
  return controle(octets) === t.slice(52) ? octets : null
}

export interface EtatSync {
  active: boolean
  /** Nom de ce PC dans la liste des appareils. */
  appareil: string
  derniere: number | null
  erreur: string | null
  enCours: boolean
  /** Les autres PC et leurs onglets ouverts. */
  autres: (AppareilSync & { id: string })[]
}
