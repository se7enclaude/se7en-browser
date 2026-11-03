/* Notification de message, en bas à droite du navigateur. C'est une petite vue posée au-dessus des pages web
 * (une notification dessinée par l'interface serait cachée sous la page). Clic : ouvre la conversation. */
import { StrictMode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { NotifMessage } from '../../../shared/social'
import './notif.css'

declare global {
  interface Window {
    notif: {
      surMessage(rappel: (n: NotifMessage) => void): void
      taille(hauteur: number): void
      ouvrir(cible: NotifMessage['cible']): void
    }
  }
}

const DUREE = 6000
const MAX = 3

interface Carte extends NotifMessage {
  /** Identifiant de la carte affichée (une nouvelle à chaque message). */
  num: number
  nombre: number
  sortante: boolean
  jusqua: number
}

function Notifications(): React.JSX.Element {
  const [cartes, setCartes] = useState<Carte[]>([])
  const [survol, setSurvol] = useState(false)
  const pile = useRef<HTMLDivElement>(null)
  const cle = useRef(0)

  const retirer = (c: number): void => {
    setCartes((l) => l.map((x) => (x.num === c ? { ...x, sortante: true } : x)))
    setTimeout(() => setCartes((l) => l.filter((x) => x.num !== c)), 220)
  }

  useEffect(
    () =>
      window.notif.surMessage((n) => {
        document.documentElement.dataset.theme = n.sombre ? 'sombre' : 'clair'
        setCartes((l) => {
          // un nouveau message du même ami (ou du même groupe) remplace sa notification (avec le nombre de messages)
          const avant = l.find((x) => x.cle === n.cle && !x.sortante)
          const reste = l.filter((x) => x !== avant)
          const carte: Carte = { ...n, num: ++cle.current, nombre: (avant?.nombre ?? 0) + 1, sortante: false, jusqua: Date.now() + DUREE }
          return [...reste, carte].slice(-MAX)
        })
      }),
    []
  )

  // disparition au bout de 6 s, en pause tant que la souris est dessus
  useEffect(() => {
    if (survol || !cartes.some((c) => !c.sortante)) return
    const t = setInterval(() => {
      const maintenant = Date.now()
      for (const c of cartes) if (!c.sortante && c.jusqua <= maintenant) retirer(c.num)
    }, 250)
    return () => clearInterval(t)
  }, [cartes, survol])
  useEffect(() => {
    if (survol) return
    // en quittant le survol, chaque notification repart pour quelques secondes
    setCartes((l) => l.map((c) => ({ ...c, jusqua: Math.max(c.jusqua, Date.now() + 2500) })))
  }, [survol])

  // le main ajuste la taille de la vue à la pile (0 : vue cachée)
  useLayoutEffect(() => {
    const el = pile.current
    if (!el) return
    const envoyer = (): void => window.notif.taille(cartes.length ? Math.ceil(el.getBoundingClientRect().height) + 24 : 0)
    const obs = new ResizeObserver(envoyer)
    obs.observe(el)
    envoyer()
    return () => obs.disconnect()
  }, [cartes.length])

  return (
    <div ref={pile} className="pile" onMouseEnter={() => setSurvol(true)} onMouseLeave={() => setSurvol(false)}>
      {cartes.map((c) => (
        <div
          key={c.num}
          className={`carte${c.sortante ? ' sortante' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => {
            window.notif.ouvrir(c.cible)
            retirer(c.num)
          }}
        >
          <div className="avatar">{c.photo ? <img src={c.photo} alt="" /> : <span>{c.pseudo.slice(0, 1).toUpperCase()}</span>}</div>
          <div className="texte">
            <div className="ligne-haut">
              <strong>{c.pseudo}</strong>
              <span className="discret">{c.nombre > 1 ? `${c.nombre} nouveaux` : 'maintenant'}</span>
            </div>
            <p>{c.texte}</p>
          </div>
          <button
            className="fermer"
            title="Fermer"
            onClick={(e) => {
              e.stopPropagation()
              retirer(c.num)
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

createRoot(document.getElementById('racine')!).render(
  <StrictMode>
    <Notifications />
  </StrictMode>
)
