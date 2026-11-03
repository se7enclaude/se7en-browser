/* VPN du navigateur (Tor) : état partagé entre le main et l'interface. */

export type PhaseVpn = 'arrete' | 'connexion' | 'actif' | 'erreur'

export interface EtatVpn {
  phase: PhaseVpn
  /** Connexion au réseau Tor, en % (0 à 100). */
  progression: number
  /** Pays de sortie choisi ('' : automatique). */
  pays: string
  /** Adresse IP vue par les sites (vérifiée auprès du Tor Project une fois connecté). */
  ip?: string
  message?: string
}

/** Pays de sortie proposés (codes ISO, ceux où le réseau Tor a beaucoup de relais). */
export const PAYS_VPN = [
  { code: '', nom: 'Automatique (le plus rapide)' },
  { code: 'fr', nom: 'France' },
  { code: 'de', nom: 'Allemagne' },
  { code: 'nl', nom: 'Pays-Bas' },
  { code: 'ch', nom: 'Suisse' },
  { code: 'se', nom: 'Suède' },
  { code: 'gb', nom: 'Royaume-Uni' },
  { code: 'us', nom: 'États-Unis' },
  { code: 'ca', nom: 'Canada' }
] as const

export const estPaysVpn = (p: unknown): p is string => typeof p === 'string' && PAYS_VPN.some((x) => x.code === p)

/** Configuration de Tor (torrc) : client seul, ports locaux, pays de sortie éventuel. */
export function configTor(o: { portSocks: number; portControle: number; donnees: string; geoip: string; pays: string }): string {
  const lignes = [
    `SocksPort 127.0.0.1:${o.portSocks}`,
    `ControlPort 127.0.0.1:${o.portControle}`,
    'CookieAuthentication 1',
    `DataDirectory ${o.donnees}`,
    `GeoIPFile ${o.geoip}`,
    'ClientOnly 1',
    'AvoidDiskWrites 1',
    'Log notice stdout'
  ]
  if (o.pays) lignes.push(`ExitNodes {${o.pays}}`, 'StrictNodes 1')
  return lignes.join('\n') + '\n'
}

/** Lit la progression dans une ligne du journal de Tor (« Bootstrapped 45% (…) »), ou null. */
export function progressionTor(ligne: string): number | null {
  const m = /Bootstrapped (\d{1,3})%/.exec(ligne)
  return m ? Math.min(100, Number(m[1])) : null
}
