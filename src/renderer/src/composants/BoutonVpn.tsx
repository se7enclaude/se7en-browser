/* Bouton « VPN » de la barre d'outils : active ou désactive le VPN gratuit (réseau Tor), choisit le pays de sortie,
 * demande une nouvelle identité. Rien ne s'active tout seul : seulement sur clic. */
import { useEffect, useState } from 'react'
import { PAYS_VPN, type EtatVpn } from '../../../shared/vpn'
import { MenuVerre, type ElementMenu } from './MenuVerre'

function useVpn(): EtatVpn | null {
  const [etat, setEtat] = useState<EtatVpn | null>(null)
  useEffect(() => {
    void window.se7en.vpn.etat().then(setEtat)
    return window.se7en.vpn.surEtat(setEtat)
  }, [])
  return etat
}

function texteEtat(e: EtatVpn): string {
  const pays = PAYS_VPN.find((p) => p.code === e.pays)
  switch (e.phase) {
    case 'arrete':
      return 'VPN désactivé : les sites voient ton adresse réelle'
    case 'connexion':
      return `Connexion au réseau Tor… ${e.progression} %`
    case 'actif':
      return `Protégé · ${e.pays ? pays?.nom : 'pays automatique'}`
    case 'erreur':
      return e.message ?? 'Le VPN a rencontré un problème.'
  }
}

export function BoutonVpn(): React.JSX.Element | null {
  const etat = useVpn()
  const [ouvert, setOuvert] = useState(false)
  if (!etat) return null
  const v = window.se7en.vpn
  const allume = etat.phase !== 'arrete'

  const elements: ElementMenu[] = [
    { libelle: texteEtat(etat), actif: false },
    ...(etat.phase === 'actif' ? [{ libelle: etat.ip ? `Adresse IP : ${etat.ip}` : 'Vérification de l’adresse…', actif: false }] : []),
    ...(etat.phase === 'actif' && etat.message ? [{ libelle: etat.message, actif: false }] : []),
    { separateur: true },
    allume ? { libelle: 'Désactiver le VPN', action: () => v.desactiver() } : { libelle: 'Activer le VPN', action: () => v.activer(etat.pays) },
    {
      libelle: 'Pays de sortie',
      sous: PAYS_VPN.map((p) => ({ libelle: p.nom, coche: etat.pays === p.code, action: () => v.activer(p.code) }))
    },
    { libelle: 'Nouvelle identité (nouvelle adresse IP)', actif: etat.phase === 'actif', action: () => v.nouvelleIdentite() },
    { separateur: true },
    { libelle: 'Gratuit, via le réseau Tor', actif: false },
    { libelle: 'Pour les pages du navigateur', actif: false }
  ]

  return (
    <div className="ancre-menu">
      <button
        className={`bouton-vpn vpn-${etat.phase}${ouvert ? ' enfonce' : ''}`}
        title={texteEtat(etat)}
        aria-expanded={ouvert}
        onClick={() => setOuvert((o) => !o)}
        style={{ ['--progression' as string]: `${etat.progression}%` }}
      >
        <span className="point-vpn" />
        VPN
      </button>
      {ouvert && (
        <MenuVerre
          elements={elements}
          position={{ type: 'ancre' }}
          fermer={(choix) => {
            setOuvert(false)
            choix?.action?.()
          }}
        />
      )}
    </div>
  )
}
