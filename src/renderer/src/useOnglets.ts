/* État des onglets côté interface : une copie de ce que le main envoie. */
import { useEffect, useState } from 'react'
import type { EtatOnglet, EtatOnglets } from '../../shared/onglets'

/** Même contenu (les objets imbriqués, comme la traduction, sont comparés par leur valeur). */
function identiques(a: EtatOnglet, b: EtatOnglet): boolean {
  for (const cle of Object.keys(b) as (keyof EtatOnglet)[]) {
    const x = a[cle]
    const y = b[cle]
    if (x === y) continue
    if (typeof x !== 'object' || typeof y !== 'object' || x === null || y === null || JSON.stringify(x) !== JSON.stringify(y)) return false
  }
  return Object.keys(a).length === Object.keys(b).length
}

/** Garde l'objet précédent de chaque onglet qui n'a pas changé : les composants mémoïsés (OngletItem) ne se redessinent
 * que pour les onglets réellement modifiés. */
function fusionner(avant: EtatOnglets, apres: EtatOnglets): EtatOnglets {
  const anciens = new Map(avant.onglets.map((o) => [o.id, o]))
  return {
    ...apres,
    onglets: apres.onglets.map((o) => {
      const ancien = anciens.get(o.id)
      return ancien && identiques(ancien, o) ? ancien : o
    })
  }
}

export function useOnglets(): { etat: EtatOnglets; actif: EtatOnglet | undefined } {
  const [etat, setEtat] = useState<EtatOnglets>({ onglets: [], actifId: null, split: null, groupes: [], sessions: [{ id: 'principale', nom: 'Principale', emoji: '🏠' }], sessionActive: 'principale' })
  useEffect(() => {
    window.se7en.onglets.lire().then((e) => e && setEtat((avant) => fusionner(avant, e)))
    return window.se7en.onglets.surEtat((e) => setEtat((avant) => fusionner(avant, e)))
  }, [])
  return { etat, actif: etat.onglets.find((o) => o.id === etat.actifId) }
}
