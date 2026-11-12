/* Affichage des réponses de l'IA : un Markdown simple, transformé en éléments React.
 * Aucun HTML n'est jamais injecté tel quel : une réponse (qui peut répéter du texte venu d'une page) ne peut pas
 * insérer de script ni d'élément dans l'interface. Les liens s'ouvrent dans un nouvel onglet, au clic de l'utilisateur. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

function lienSur(url: string): string | null {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}

function Lien({ url, children }: { url: string; children: ReactNode }): React.JSX.Element {
  const sur = lienSur(url)
  if (!sur) return <>{children}</>
  return (
    <a
      href={sur}
      title={sur}
      onClick={(e) => {
        e.preventDefault()
        window.se7en.onglets.nouveau(sur)
      }}
    >
      {children}
    </a>
  )
}

/** **gras**, *italique*, `code`, [texte](lien) et adresses nues. */
function enLigne(texte: string, cle: string): ReactNode[] {
  const res: ReactNode[] = []
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>)]+[^\s<>).,;:!?])|\*([^*\s][^*]*)\*)/g
  let dernier = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(texte))) {
    if (m.index > dernier) res.push(texte.slice(dernier, m.index))
    const k = `${cle}-${i++}`
    if (m[2]) res.push(<strong key={k}>{m[2]}</strong>)
    else if (m[3]) res.push(<code key={k}>{m[3]}</code>)
    else if (m[4]) res.push(<Lien key={k} url={m[5]}>{m[4]}</Lien>)
    else if (m[6]) res.push(<Lien key={k} url={m[6]}>{m[6]}</Lien>)
    else if (m[7]) res.push(<em key={k}>{m[7]}</em>)
    dernier = re.lastIndex
  }
  if (dernier < texte.length) res.push(texte.slice(dernier))
  return res
}

export function Markdown({ texte }: { texte: string }): React.JSX.Element {
  return <div className="markdown">{blocsMarkdown(texte)}</div>
}

/** Position de la dernière ligne vide hors bloc de code : tout ce qui la précède forme des blocs terminés,
 * qui ne changeront plus pendant que la réponse s'écrit. */
function finBlocsTermines(texte: string): number {
  let dansCode = false
  let fin = 0
  let pos = 0
  for (const ligne of texte.split('\n')) {
    if (/^```/.test(ligne)) dansCode = !dansCode
    else if (!dansCode && pos > 0 && !ligne.trim()) fin = pos
    pos += ligne.length + 1
  }
  return fin
}

function blocsMarkdown(texte: string, prefixe = 'b'): ReactNode[] {
  const blocs: ReactNode[] = []
  const lignes = texte.replace(/\r/g, '').split('\n')
  let i = 0
  let n = 0
  while (i < lignes.length) {
    const l = lignes[i]
    const k = `${prefixe}${n++}`
    // bloc de code
    if (/^```/.test(l)) {
      const code: string[] = []
      i++
      while (i < lignes.length && !/^```/.test(lignes[i])) code.push(lignes[i++])
      i++
      blocs.push(
        <pre key={k}>
          <code>{code.join('\n')}</code>
        </pre>
      )
      continue
    }
    // titre
    const titre = /^(#{1,4})\s+(.*)$/.exec(l)
    if (titre) {
      blocs.push(<p key={k} className={`titre-md niveau-${titre[1].length}`}>{enLigne(titre[2], k)}</p>)
      i++
      continue
    }
    // liste à puces ou numérotée
    if (/^\s*([-*•]|\d+[.)])\s+/.test(l)) {
      const numerotee = /^\s*\d+[.)]/.test(l)
      const items: ReactNode[] = []
      while (i < lignes.length && /^\s*([-*•]|\d+[.)])\s+/.test(lignes[i])) {
        items.push(<li key={`${k}-${items.length}`}>{enLigne(lignes[i].replace(/^\s*([-*•]|\d+[.)])\s+/, ''), `${k}-${items.length}`)}</li>)
        i++
      }
      blocs.push(numerotee ? <ol key={k}>{items}</ol> : <ul key={k}>{items}</ul>)
      continue
    }
    if (!l.trim()) {
      i++
      continue
    }
    // paragraphe : lignes consécutives
    const para: string[] = []
    while (i < lignes.length && lignes[i].trim() && !/^(```|#{1,4}\s|\s*([-*•]|\d+[.)])\s+)/.test(lignes[i])) para.push(lignes[i++])
    blocs.push(<p key={k}>{enLigne(para.join('\n'), k)}</p>)
  }
  return blocs
}

/** Réponse de l'IA en cours d'écriture : le texte arrive par paquets irréguliers ; on le dévoile à un rythme régulier
 * (plus vite quand il y a du retard), une fois par image, pour qu'il coule au lieu de sauter. */
export function ReponseFluide({ texte, enCours, surAvance }: { texte: string; enCours: boolean; surAvance?: () => void }): React.JSX.Element {
  const [montre, setMontre] = useState(() => (enCours ? 0 : texte.length))
  const montreRef = useRef(montre)
  useEffect(() => {
    if (montreRef.current >= texte.length) return
    let id = 0
    const pas = (): void => {
      const reste = texte.length - montreRef.current
      if (reste <= 0) return
      // environ 90 caractères par seconde, et le retard se rattrape en quelques images (vite à la fin du flux)
      const avance = Math.max(enCours ? 1.5 : 6, reste / (enCours ? 12 : 4))
      montreRef.current = Math.min(texte.length, montreRef.current + Math.ceil(avance))
      setMontre(montreRef.current)
      surAvance?.()
      id = requestAnimationFrame(pas)
    }
    id = requestAnimationFrame(pas)
    return () => cancelAnimationFrame(id)
  }, [texte, enCours])
  // à chaque image, seul le bloc en cours d'écriture est relu : les blocs terminés sont gardés (mémoïsés)
  const visible = texte.slice(0, montre)
  const fin = finBlocsTermines(visible)
  const termine = visible.slice(0, fin)
  const finis = useMemo(() => blocsMarkdown(termine, 'f'), [termine])
  return (
    <div className="markdown">
      {finis}
      {blocsMarkdown(visible.slice(fin), 'c')}
    </div>
  )
}
