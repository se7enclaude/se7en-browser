/* « Demander sur une zone de l'écran » : la capture de l'onglet s'affiche à la place des pages,
 * l'utilisateur encadre une zone à la souris, puis écrit sa question. La zone part au modèle vision. */
import { useEffect, useRef, useState } from 'react'
import type { ZoneCapture } from '../../../shared/chat'
import { IconeCroix, IconeIA } from './Icones'
import { useFigerPages } from '../pagesFigees'

interface Props {
  idCapture: string
  image: string
  valider: (zone: ZoneCapture, question: string) => void
  fermer: () => void
}

interface Rect {
  x: number
  y: number
  l: number
  h: number
}

const QUESTIONS = ['Explique ce que montre cette zone.', 'Lis et recopie le texte de cette zone.', 'Traduis le texte de cette zone en français.']

/** Rectangle réellement occupé par l'image (elle est « contenue » dans son cadre, sans déformation). */
function rectImage(img: HTMLImageElement | null): DOMRect | null {
  if (!img || !img.naturalWidth) return null
  const b = img.getBoundingClientRect()
  const echelle = Math.min(b.width / img.naturalWidth, b.height / img.naturalHeight)
  const l = img.naturalWidth * echelle
  const h = img.naturalHeight * echelle
  return new DOMRect(b.left + (b.width - l) / 2, b.top + (b.height - h) / 2, l, h)
}

export function SelecteurZone({ idCapture, image, valider, fermer }: Props): React.JSX.Element {
  const img = useRef<HTMLImageElement>(null)
  const [rect, setRect] = useState<Rect | null>(null)
  const [fini, setFini] = useState(false)
  const [question, setQuestion] = useState('')

  // les pages web passent au-dessus de l'interface : figées le temps du choix
  useFigerPages()
  useEffect(() => {
    const echap = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') fermer()
    }
    window.addEventListener('keydown', echap)
    return () => window.removeEventListener('keydown', echap)
  }, [])

  const commencer = (e: React.PointerEvent): void => {
    const b = rectImage(img.current)
    if (!b) return
    const borne = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v))
    const x0 = borne(e.clientX, b.left, b.right)
    const y0 = borne(e.clientY, b.top, b.bottom)
    setFini(false)
    setRect({ x: x0, y: y0, l: 0, h: 0 })
    const bouger = (ev: PointerEvent): void => {
      const x1 = borne(ev.clientX, b.left, b.right)
      const y1 = borne(ev.clientY, b.top, b.bottom)
      setRect({ x: Math.min(x0, x1), y: Math.min(y0, y1), l: Math.abs(x1 - x0), h: Math.abs(y1 - y0) })
    }
    const lacher = (): void => {
      window.removeEventListener('pointermove', bouger)
      window.removeEventListener('pointerup', lacher)
      setFini(true)
    }
    window.addEventListener('pointermove', bouger)
    window.addEventListener('pointerup', lacher)
  }

  const envoyer = (q: string): void => {
    const b = rectImage(img.current)
    if (!b || !rect || rect.l < 8 || rect.h < 8) return
    valider(
      { idCapture, x: (rect.x - b.left) / b.width, y: (rect.y - b.top) / b.height, largeur: rect.l / b.width, hauteur: rect.h / b.height },
      q.trim() || QUESTIONS[0]
    )
  }

  const valide = !!rect && rect.l >= 8 && rect.h >= 8
  return (
    <div className="selecteur-zone">
      <div className="consigne-zone verre-fort">
        <IconeIA />
        <span>Encadre la zone qui t’intéresse</span>
        <button className="bouton-icone" title="Annuler (Échap)" onClick={fermer}>
          <IconeCroix />
        </button>
      </div>
      <div className="cadre-capture" onPointerDown={commencer}>
        <img ref={img} src={image} alt="" draggable={false} />
        {rect && <div className="rect-zone" style={{ left: rect.x, top: rect.y, width: rect.l, height: rect.h }} />}
      </div>
      {fini && valide && rect && (
        <form
          className="question-zone verre-fort"
          style={{ left: Math.min(rect.x, window.innerWidth - 440), top: Math.min(rect.y + rect.h + 10, window.innerHeight - 150) }}
          onSubmit={(e) => {
            e.preventDefault()
            envoyer(question)
          }}
        >
          <input autoFocus className="champ" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Que veux-tu savoir sur cette zone ?" />
          <div className="liste-chips">
            {QUESTIONS.map((q) => (
              <button key={q} type="button" className="chip petit" onClick={() => envoyer(q)}>
                {q}
              </button>
            ))}
          </div>
        </form>
      )}
    </div>
  )
}
