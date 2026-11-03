/* Widgets du Nouvel onglet : ceux qu'on a ajoutés, où on les a posés et à quelle taille.
 * La position est une fraction de la page (le widget suit la fenêtre), la taille est en pixels. */

export type TypeWidget = 'amis' | 'meteo' | 'actualites' | 'jeux-gratuits' | 'sorties' | 'sport' | 'colis' | 'traducteur'

export interface Ville {
  nom: string
  /** Région et pays, pour distinguer les homonymes. */
  detail: string
  lat: number
  lon: number
}

export interface WidgetPlace {
  id: string
  type: TypeWidget
  /** Coin haut gauche, en fraction de la largeur et de la hauteur de la page (0 à 1). */
  x: number
  y: number
  /** Largeur et hauteur en pixels, pour une page de la taille `ref`. */
  l: number
  h: number
  /** Taille de la page quand le widget a été posé [largeur, hauteur] : si la fenêtre change de taille,
   * le widget (cadre et contenu) suit en proportion. Absent : taille de la page actuelle. */
  ref?: [number, number]
  /** Grossissement du contenu (boutons − / +) ; absent : taille normale. Étirer le cadre ne le change pas. */
  zoom?: number
  /** Météo : la ville choisie. */
  ville?: Ville
  /** Actualités : le journal choisi. */
  source?: string
  /** Sport : les équipes suivies. */
  equipes?: Equipe[]
  /** Suivi de colis : les colis attendus. */
  colis?: Colis[]
  /** Traducteur : la langue vers laquelle traduire. */
  langue?: string
}

export interface Equipe {
  /** Identifiant TheSportsDB. */
  id: string
  nom: string
  ligue: string
}

export interface Colis {
  numero: string
  /** Ce que c'est (« Casque », « Commande Amazon »…). */
  nom: string
  transporteur: string
}

export interface InfoWidget {
  type: TypeWidget
  nom: string
  description: string
  /** Taille à l'ajout. */
  l: number
  h: number
  /** On peut en poser plusieurs (la météo de deux villes, deux journaux…). */
  plusieurs: boolean
}

export const CATALOGUE_WIDGETS: readonly InfoWidget[] = [
  {
    type: 'meteo',
    nom: 'Météo',
    description: 'Le temps qu’il fait, heure par heure et sur 5 jours',
    l: 320,
    h: 300,
    plusieurs: true
  },
  {
    type: 'actualites',
    nom: 'Actualités',
    description: 'Les derniers titres du journal de ton choix',
    l: 340,
    h: 380,
    plusieurs: true
  },
  {
    type: 'jeux-gratuits',
    nom: 'Jeux gratuits',
    description: 'Les jeux offerts en ce moment (Epic Games, Steam, GOG)',
    l: 320,
    h: 380,
    plusieurs: false
  },
  {
    type: 'sorties',
    nom: 'Sorties jeux vidéo',
    description: 'Les jeux les plus attendus et leur date de sortie',
    l: 320,
    h: 380,
    plusieurs: false
  },
  {
    type: 'sport',
    nom: 'Résultats sportifs',
    description: 'Le dernier score et le prochain match de tes équipes',
    l: 320,
    h: 340,
    plusieurs: false
  },
  {
    type: 'colis',
    nom: 'Suivi de colis',
    description: 'Tes numéros de suivi, à suivre en un clic chez le transporteur',
    l: 300,
    h: 300,
    plusieurs: false
  },
  {
    type: 'traducteur',
    nom: 'Traducteur',
    description: 'Traduire une phrase tout de suite, avec l’IA locale',
    l: 320,
    h: 300,
    plusieurs: false
  },
  {
    type: 'amis',
    nom: 'Amis',
    description: 'Messages non lus, qui est en ligne et à quoi il joue',
    l: 290,
    h: 420,
    plusieurs: false
  }
]

/** Journaux proposés (flux RSS publics). */
export const SOURCES_ACTUALITES = [
  {
    id: 'franceinfo',
    nom: 'franceinfo',
    url: 'https://www.francetvinfo.fr/titres.rss'
  },
  { id: 'lemonde', nom: 'Le Monde', url: 'https://www.lemonde.fr/rss/une.xml' },
  {
    id: 'liberation',
    nom: 'Libération',
    url: 'https://www.liberation.fr/arc/outboundfeeds/rss-all/?outputType=xml'
  },
  {
    id: 'lequipe',
    nom: 'L’Équipe',
    url: 'https://dwh.lequipe.fr/api/edito/rss?path=/'
  },
  {
    id: 'numerama',
    nom: 'Numerama (tech)',
    url: 'https://www.numerama.com/feed/'
  },
  {
    id: 'jeuxvideo',
    nom: 'Jeuxvideo.com',
    url: 'https://www.jeuxvideo.com/rss/rss.xml'
  },
  {
    id: 'bbc',
    nom: 'BBC News (anglais)',
    url: 'https://feeds.bbci.co.uk/news/rss.xml'
  }
] as const

export interface MeteoActuelle {
  temperature: number
  ressentie: number
  code: number
  vent: number
  jour: boolean
  /** Les prochaines heures. */
  heures: { heure: string; temperature: number; code: number; pluie: number }[]
  jours: {
    date: string
    code: number
    min: number
    max: number
    pluie: number
  }[]
}

export interface Actualite {
  titre: string
  lien: string
  date: number
}

export interface JeuGratuit {
  titre: string
  lien: string
  /** Image en data: (téléchargée par le main), ou vide. */
  image: string
  plateforme: string
  /** Gratuit jusqu'à… (ms), 0 si inconnu. */
  fin: number
  /** Pas encore gratuit : le sera à partir de `debut`. */
  bientot: boolean
  debut: number
}

export interface SortieJeu {
  titre: string
  lien: string
  image: string
  /** Date telle que Steam l'affiche (« 12 nov. 2026 », « Bientôt », « T1 2027 »…). */
  date: string
}

export interface Match {
  id: string
  ligue: string
  domicile: string
  exterieur: string
  /** Scores, null si le match n'est pas joué. */
  scoreDomicile: number | null
  scoreExterieur: number | null
  /** Date et heure (ms). */
  date: number
}

export interface ResultatsEquipe {
  equipe: Equipe
  /** Écusson en data:, ou vide. */
  ecusson: string
  dernier: Match | null
  prochain: Match | null
}

/** Langues du traducteur. */
export const LANGUES = [
  { code: 'fr', nom: 'Français' },
  { code: 'en', nom: 'Anglais' },
  { code: 'es', nom: 'Espagnol' },
  { code: 'de', nom: 'Allemand' },
  { code: 'it', nom: 'Italien' },
  { code: 'pt', nom: 'Portugais' },
  { code: 'ar', nom: 'Arabe' },
  { code: 'tr', nom: 'Turc' },
  { code: 'ja', nom: 'Japonais' },
  { code: 'zh', nom: 'Chinois' }
] as const

/** Transporteurs : leur page de suivi officielle (le numéro n'y part que quand on clique). */
export const TRANSPORTEURS = [
  {
    id: 'laposte',
    nom: 'La Poste / Colissimo',
    url: 'https://www.laposte.fr/outils/suivre-vos-envois?code=%s'
  },
  {
    id: 'chronopost',
    nom: 'Chronopost',
    url: 'https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=%s'
  },
  {
    id: 'mondialrelay',
    nom: 'Mondial Relay',
    url: 'https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=%s'
  },
  {
    id: 'colisprive',
    nom: 'Colis Privé',
    url: 'https://www.colisprive.com/moncolis/pages/detailColis.aspx?numColis=%s'
  },
  {
    id: 'ups',
    nom: 'UPS',
    url: 'https://www.ups.com/track?loc=fr_FR&tracknum=%s'
  },
  {
    id: 'dhl',
    nom: 'DHL',
    url: 'https://www.dhl.com/fr-fr/home/suivi.html?tracking-id=%s'
  },
  {
    id: 'gls',
    nom: 'GLS',
    url: 'https://gls-group.com/FR/fr/suivi-colis?match=%s'
  },
  { id: 'dpd', nom: 'DPD', url: 'https://trace.dpd.fr/fr/trace/%s' },
  {
    id: 'fedex',
    nom: 'FedEx',
    url: 'https://www.fedex.com/fedextrack/?trknbr=%s'
  },
  {
    id: 'autre',
    nom: 'Autre (recherche Google)',
    url: 'https://www.google.com/search?q=suivi+colis+%s'
  }
] as const

export const RE_NUMERO_COLIS = /^[A-Z0-9]{6,40}$/

/** Nettoie un numéro de suivi collé (espaces, tirets, minuscules). */
export function numeroColis(saisie: string): string {
  return saisie.toUpperCase().replace(/[\s-]/g, '')
}

/** Devine le transporteur d'après la forme du numéro (l'utilisateur peut toujours le changer). */
export function devinerTransporteur(numero: string): string {
  const n = numeroColis(numero)
  if (/^1Z[A-Z0-9]{16}$/.test(n)) return 'ups'
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(n)) return /^X[A-Z]|^E[EF]/.test(n) ? 'chronopost' : 'laposte'
  if (/^\d[A-Z]\d{11}$/.test(n)) return 'laposte'
  if (/^\d{10}$/.test(n) || /^JJD\d+$/.test(n) || /^JVGL\d+$/.test(n)) return 'dhl'
  if (/^\d{8}$/.test(n)) return 'mondialrelay'
  if (/^\d{14}$/.test(n)) return 'dpd'
  if (/^\d{12}$/.test(n) || /^\d{15}$/.test(n)) return 'fedex'
  return 'laposte'
}

export function lienSuivi(c: Colis): string {
  const t = TRANSPORTEURS.find((x) => x.id === c.transporteur) ?? TRANSPORTEURS[0]
  return t.url.replace('%s', encodeURIComponent(c.numero))
}

const TYPES = new Set(CATALOGUE_WIDGETS.map((w) => w.type))
export const MAX_WIDGETS = 20
export const TAILLE_MIN = { l: 180, h: 110 }
export const TAILLE_MAX = { l: 1600, h: 1200 }

export const WIDGETS_DEFAUT: WidgetPlace[] = [
  { id: 'amis', type: 'amis', x: 0.02, y: 0.16, l: 290, h: 420 },
  { id: 'meteo', type: 'meteo', x: 0.78, y: 0.16, l: 320, h: 300 }
]

const borne = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v))

export function villeValide(v: unknown): v is Ville {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.nom === 'string' &&
    o.nom.length > 0 &&
    o.nom.length <= 100 &&
    typeof o.detail === 'string' &&
    o.detail.length <= 200 &&
    typeof o.lat === 'number' &&
    Math.abs(o.lat) <= 90 &&
    typeof o.lon === 'number' &&
    Math.abs(o.lon) <= 180
  )
}

const estTexteCourt = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max

/** Vérifie une liste reçue (fichier de réglages, interface) : les widgets invalides sont écartés, jamais propagés. */
export function validerWidgets(brut: unknown): WidgetPlace[] | null {
  if (!Array.isArray(brut)) return null
  const vus = new Set<string>()
  const res: WidgetPlace[] = []
  for (const o of brut.slice(0, MAX_WIDGETS) as Record<string, unknown>[]) {
    if (!o || typeof o !== 'object') continue
    const { id, type, x, y, l, h } = o
    if (typeof id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(id) || vus.has(id)) continue
    if (!TYPES.has(type as TypeWidget)) continue
    if (![x, y, l, h].every((n) => typeof n === 'number' && Number.isFinite(n))) continue
    vus.add(id)
    const w: WidgetPlace = {
      id,
      type: type as TypeWidget,
      x: borne(x as number, 0, 1),
      y: borne(y as number, 0, 1),
      l: Math.round(borne(l as number, TAILLE_MIN.l, TAILLE_MAX.l)),
      h: Math.round(borne(h as number, TAILLE_MIN.h, TAILLE_MAX.h))
    }
    if (w.type === 'meteo' && villeValide(o.ville))
      w.ville = {
        nom: o.ville.nom,
        detail: o.ville.detail,
        lat: o.ville.lat,
        lon: o.ville.lon
      }
    if (w.type === 'actualites') w.source = SOURCES_ACTUALITES.some((s) => s.id === o.source) ? (o.source as string) : SOURCES_ACTUALITES[0].id
    if (w.type === 'sport')
      w.equipes = (Array.isArray(o.equipes) ? (o.equipes as Record<string, unknown>[]) : [])
        .filter((e) => e && typeof e.id === 'string' && /^\d{1,10}$/.test(e.id) && estTexteCourt(e.nom, 100) && typeof e.ligue === 'string' && e.ligue.length <= 100)
        .slice(0, 6)
        .map((e) => ({
          id: e.id as string,
          nom: e.nom as string,
          ligue: e.ligue as string
        }))
    if (w.type === 'colis')
      w.colis = (Array.isArray(o.colis) ? (o.colis as Record<string, unknown>[]) : [])
        .filter(
          (c) =>
            c &&
            typeof c.numero === 'string' &&
            RE_NUMERO_COLIS.test(c.numero) &&
            typeof c.nom === 'string' &&
            c.nom.length <= 60 &&
            TRANSPORTEURS.some((t) => t.id === c.transporteur)
        )
        .slice(0, 20)
        .map((c) => ({
          numero: c.numero as string,
          nom: c.nom as string,
          transporteur: c.transporteur as string
        }))
    if (w.type === 'traducteur') w.langue = LANGUES.some((x) => x.code === o.langue) ? (o.langue as string) : 'fr'
    if (typeof o.zoom === 'number' && Number.isFinite(o.zoom) && o.zoom !== 1) w.zoom = Math.round(borne(o.zoom, ZOOM_MIN, ZOOM_MAX) * 100) / 100
    if (Array.isArray(o.ref) && o.ref.length === 2 && o.ref.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 200 && n <= 10000))
      w.ref = [Math.round(o.ref[0]), Math.round(o.ref[1])]
    res.push(w)
  }
  return res
}

/** Un nouveau widget du type donné, posé un peu en décalé des précédents. */
export function nouveauWidget(type: TypeWidget, existants: WidgetPlace[], id: string): WidgetPlace {
  const info = CATALOGUE_WIDGETS.find((w) => w.type === type)!
  const n = existants.length % 6
  const w: WidgetPlace = {
    id,
    type,
    x: 0.05 + n * 0.03,
    y: 0.08 + n * 0.04,
    l: info.l,
    h: info.h
  }
  if (type === 'actualites') w.source = SOURCES_ACTUALITES[0].id
  if (type === 'sport') w.equipes = []
  if (type === 'colis') w.colis = []
  if (type === 'traducteur') w.langue = 'fr'
  return w
}

export const ZOOM_MIN = 0.6
export const ZOOM_MAX = 3

/** Grossit (pas > 0) ou rapetisse (pas < 0) tout le widget d'un cran : son contenu et son cadre, ensemble. */
export function grossir(w: WidgetPlace, pas: 1 | -1): WidgetPlace {
  const avant = w.zoom ?? 1
  const zoom = Math.round(borne(avant * (pas > 0 ? 1.15 : 1 / 1.15), ZOOM_MIN, ZOOM_MAX) * 100) / 100
  const r = zoom / avant
  const res: WidgetPlace = {
    ...w,
    l: Math.round(borne(w.l * r, TAILLE_MIN.l, TAILLE_MAX.l)),
    h: Math.round(borne(w.h * r, TAILLE_MIN.h, TAILLE_MAX.h))
  }
  if (Math.abs(zoom - 1) < 0.02) delete res.zoom
  else res.zoom = zoom
  return res
}

/** Où dessiner le widget dans une page de `largeur` × `hauteur` : toujours entièrement visible. */
/** Donne au widget sa taille de page de référence (s'il n'en a pas), sans changer son apparence actuelle. */
export function fixerRef(w: WidgetPlace, largeur: number, hauteur: number): WidgetPlace {
  if (w.ref || !largeur || !hauteur) return w
  const f = facteurPage(w, largeur, hauteur)
  const res: WidgetPlace = { ...w, l: Math.round(w.l * f), h: Math.round(w.h * f), ref: [Math.round(largeur), Math.round(hauteur)] }
  const zoom = Math.round((w.zoom ?? 1) * f * 100) / 100
  if (Math.abs(zoom - 1) < 0.02) delete res.zoom
  else res.zoom = borne(zoom, ZOOM_MIN, ZOOM_MAX)
  return res
}

/** Combien le widget suit la taille de la page : < 1 quand la fenêtre est plus petite qu'à la pose, > 1 plus grande. */
export function facteurPage(w: WidgetPlace, largeur: number, hauteur: number): number {
  if (!largeur || !hauteur) return 1
  // widget jamais déplacé (disposition par défaut) : pensé pour une page d'environ 1500 × 850, il ne fait que rapetisser
  if (!w.ref) return Math.round(borne(Math.min(largeur / 1500, hauteur / 850, 1), 0.4, 1) * 1000) / 1000
  return Math.round(borne(Math.min(largeur / w.ref[0], hauteur / w.ref[1]), 0.4, 1.6) * 1000) / 1000
}

/** Où dessiner le widget dans une page de `largeur` × `hauteur` : en proportion de la page, toujours entièrement visible.
 * `echelle` est le grossissement total du contenu (choisi avec − / +, et suivant la taille de la fenêtre). */
export function placement(w: WidgetPlace, largeur: number, hauteur: number): { left: number; top: number; width: number; height: number; echelle: number } {
  const f = facteurPage(w, largeur, hauteur)
  const width = Math.round(Math.min(w.l * f, Math.max(TAILLE_MIN.l * Math.min(f, 1), largeur - 16)))
  const height = Math.round(Math.min(w.h * f, Math.max(TAILLE_MIN.h * Math.min(f, 1), hauteur - 16)))
  return {
    left: Math.round(borne(w.x * largeur, 0, Math.max(0, largeur - width))),
    top: Math.round(borne(w.y * hauteur, 0, Math.max(0, hauteur - height))),
    width,
    height,
    echelle: Math.round((w.zoom ?? 1) * f * 1000) / 1000
  }
}

/** Codes météo WMO (Open-Meteo) → description et emoji. */
export function descriptionMeteo(code: number, jour = true): { texte: string; emoji: string } {
  if (code === 0) return { texte: 'Ciel dégagé', emoji: jour ? '☀️' : '🌙' }
  if (code <= 2) return { texte: 'Éclaircies', emoji: jour ? '⛅' : '☁️' }
  if (code === 3) return { texte: 'Couvert', emoji: '☁️' }
  if (code <= 48) return { texte: 'Brouillard', emoji: '🌫️' }
  if (code <= 57) return { texte: 'Bruine', emoji: '🌦️' }
  if (code <= 67) return { texte: 'Pluie', emoji: '🌧️' }
  if (code <= 77) return { texte: 'Neige', emoji: '❄️' }
  if (code <= 82) return { texte: 'Averses', emoji: '🌦️' }
  if (code <= 86) return { texte: 'Averses de neige', emoji: '🌨️' }
  return { texte: 'Orage', emoji: '⛈️' }
}

/** Lit les articles d'un flux RSS (ou Atom) : titre, lien, date. Rien d'autre du flux n'est gardé. */
export function lireFlux(xml: string, max = 20): Actualite[] {
  const res: Actualite[] = []
  const blocs = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/g) ?? []
  for (const b of blocs) {
    const titre = texteBalise(b, 'title')
    let lien = texteBalise(b, 'link')
    if (!lien) lien = /<link[^>]*href="([^"]+)"/.exec(b)?.[1] ?? ''
    lien = decoder(lien).trim()
    if (!titre || !/^https?:\/\//.test(lien)) continue
    const d = Date.parse(texteBalise(b, 'pubDate') || texteBalise(b, 'published') || texteBalise(b, 'updated') || texteBalise(b, 'dc:date'))
    res.push({
      titre: titre.slice(0, 300),
      lien: lien.slice(0, 2000),
      date: Number.isFinite(d) ? d : 0
    })
    if (res.length >= max) break
  }
  return res
}

function texteBalise(bloc: string, nom: string): string {
  const m = new RegExp(`<${nom}(?:\\s[^>]*)?>([\\s\\S]*?)</${nom}>`).exec(bloc)
  if (!m) return ''
  const brut = m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1')
  return decoder(brut.replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .trim()
}

function decoder(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}
