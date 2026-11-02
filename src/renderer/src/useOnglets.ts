/* État des onglets côté interface : une copie de ce que le main envoie. */
import { useEffect, useState } from 'react'
import type { EtatOnglet, EtatOnglets } from '../../shared/onglets'

export function useOnglets(): { etat: EtatOnglets; actif: EtatOnglet | undefined } {
  const [etat, setEtat] = useState<EtatOnglets>({ onglets: [], actifId: null })
  useEffect(() => {
    window.se7en.onglets.lire().then((e) => e && setEtat(e))
    return window.se7en.onglets.surEtat(setEtat)
  }, [])
  return { etat, actif: etat.onglets.find((o) => o.id === etat.actifId) }
}
