import { describe, expect, it } from 'vitest'
import { configTor, estPaysVpn, progressionTor } from '../src/shared/vpn'

describe('VPN (Tor)', () => {
  const base = { portSocks: 9150, portControle: 9151, donnees: 'C:\\donnees\\tor', geoip: 'C:\\tor\\geoip' }

  it('écrit une configuration de client Tor, sur des ports locaux seulement', () => {
    const c = configTor({ ...base, pays: '' })
    expect(c).toContain('SocksPort 127.0.0.1:9150')
    expect(c).toContain('ControlPort 127.0.0.1:9151')
    expect(c).toContain('CookieAuthentication 1')
    expect(c).toContain('ClientOnly 1')
    expect(c).not.toContain('ExitNodes')
  })

  it('impose le pays de sortie choisi', () => {
    const c = configTor({ ...base, pays: 'fr' })
    expect(c).toContain('ExitNodes {fr}')
    expect(c).toContain('StrictNodes 1')
  })

  it("n'accepte que les pays proposés", () => {
    expect(estPaysVpn('fr')).toBe(true)
    expect(estPaysVpn('')).toBe(true)
    expect(estPaysVpn('fr}\nSocksPort 0.0.0.0:80')).toBe(false)
    expect(estPaysVpn(3)).toBe(false)
  })

  it('lit la progression de connexion dans le journal de Tor', () => {
    expect(progressionTor('Nov 03 20:41:00.000 [notice] Bootstrapped 45% (requesting_descriptors): Asking for relay descriptors')).toBe(45)
    expect(progressionTor('Nov 03 20:41:05.000 [notice] Bootstrapped 100% (done): Done')).toBe(100)
    expect(progressionTor('[notice] Opening Socks listener on 127.0.0.1:9150')).toBeNull()
  })
})
