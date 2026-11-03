/* Petite fenêtre de discussion (vue posée en bas à droite, au-dessus des pages) : une conversation avec un ami
 * ou un groupe, comme dans la page Amis, en plus compact. Le main lui dit quelle conversation afficher. */
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { EtatOnglets } from '../../../shared/onglets'
import type { Ami, CibleSocial, GroupeSocial, ProfilSocial } from '../../../shared/social'
import { Conversation } from '../composants/PageAmis'
import { useAttributsTheme, useInfosApp, useReglages } from '../useReglages'
import '../theme/glass.css'

const ETAT_VIDE: EtatOnglets = { onglets: [], actifId: null, split: null, groupes: [], sessions: [], sessionActive: '' }

function Discussion(): React.JSX.Element | null {
  const [reglages] = useReglages()
  const infos = useInfosApp()
  useAttributsTheme(reglages, infos)
  const [cible, setCible] = useState<CibleSocial | null>(null)
  const [moi, setMoi] = useState<ProfilSocial | null>(null)
  const [amis, setAmis] = useState<Ami[]>([])
  const [groupes, setGroupes] = useState<GroupeSocial[]>([])
  const [onglets, setOnglets] = useState<EtatOnglets>(ETAT_VIDE)

  useEffect(() => {
    const charger = (): void => {
      void window.se7en.social.etat().then((e) => setMoi(e.profil))
      void window.se7en.social.amis().then((r) => Array.isArray(r) && setAmis(r))
      void window.se7en.social.groupes().then((r) => Array.isArray(r) && setGroupes(r))
      void window.se7en.onglets.lire().then((e) => e && setOnglets(e))
    }
    const fin = window.se7en.app.surCommande((c) => {
      if (c.type !== 'discussion') return
      setCible(c.cible)
      charger()
    })
    const finEv = window.se7en.social.surEvenement((ev) => {
      if (ev.type === 'presence') setAmis((l) => l.map((a) => (a.id === ev.id ? { ...a, enLigne: ev.enLigne } : a)))
      else if (ev.type === 'statut') setAmis((l) => l.map((a) => (a.id === ev.id ? { ...a, humeur: ev.statut } : a)))
    })
    const finOnglets = window.se7en.onglets.surEtat(setOnglets)
    return () => {
      fin()
      finEv()
      finOnglets?.()
    }
  }, [])

  if (!cible || !moi) return null
  const ami = cible.type === 'ami' ? amis.find((a) => a.id === cible.id) : undefined
  const groupe = cible.type === 'groupe' ? groupes.find((g) => g.id === cible.id) : undefined
  if (!ami && !groupe) return <div className="mini-discussion verre-fort chargement" />
  return (
    <div className="mini-discussion">
      <Conversation
        key={`${cible.type}-${cible.id}`}
        cible={cible}
        ami={ami}
        groupe={groupe}
        amis={amis.filter((a) => a.statut === 'ami')}
        moi={moi}
        onglets={onglets}
        retour={() => window.se7en.social.fermerDiscussion()}
        mini={{ agrandir: () => window.se7en.social.agrandirDiscussion(cible) }}
      />
    </div>
  )
}

createRoot(document.getElementById('racine')!).render(
  <StrictMode>
    <Discussion />
  </StrictMode>
)
