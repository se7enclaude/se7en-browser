/* Import de favoris depuis le fichier que l'utilisateur a exporté de son ancien navigateur
 * (Chrome, Edge, Firefox, Opera, Brave… : tous exportent au même format HTML « Netscape »).
 * On ne lit que ce fichier, choisi par l'utilisateur : jamais les données d'un autre navigateur. */

export interface FavoriImporte {
  url: string
  titre: string
  /** Icône incluse dans le fichier (data:image/…), si elle est raisonnable. */
  favicon: string | null
  date: number
}

const MAX_ICONE = 20_000

function decoder(t: string): string {
  return t
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

/** Lit un fichier de favoris exporté. Ne garde que les adresses web (http/https), sans doublon. */
export function lireFavorisExportes(html: string): FavoriImporte[] {
  const res: FavoriImporte[] = []
  const vus = new Set<string>()
  const re = /<A\s([^>]*)>([\s\S]*?)<\/A>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) && res.length < 5000) {
    const attrs = m[1]
    const attr = (nom: string): string | null => {
      const a = new RegExp(`\\b${nom}\\s*=\\s*"([^"]*)"`, 'i').exec(attrs)
      return a ? decoder(a[1]) : null
    }
    const href = attr('HREF')
    if (!href) continue
    let url: URL
    try {
      url = new URL(href)
    } catch {
      continue
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue
    if (vus.has(url.href)) continue
    vus.add(url.href)
    const icone = attr('ICON')
    const ajout = Number(attr('ADD_DATE'))
    res.push({
      url: url.href,
      titre: decoder(m[2].replace(/<[^>]*>/g, '')).trim().slice(0, 500) || url.hostname,
      favicon: icone && /^data:image\/(png|x-icon|vnd\.microsoft\.icon|gif|jpeg|webp|svg\+xml);base64,/.test(icone) && icone.length < MAX_ICONE ? icone : null,
      // Chrome et Firefox donnent la date en secondes
      date: Number.isFinite(ajout) && ajout > 0 ? ajout * 1000 : Date.now()
    })
  }
  return res
}
