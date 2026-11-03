/* Données des widgets du Nouvel onglet, récupérées par le main auprès de services publics sans compte :
 * Open-Meteo (météo, recherche de ville), les flux RSS des journaux proposés, Epic Games et GamerPower (jeux offerts),
 * Steam (sorties), TheSportsDB (résultats sportifs). Les images sont téléchargées ici et renvoyées en data:.
 * Seules ces adresses fixes sont appelées ; rien de l'utilisateur n'est envoyé, sauf la ville ou l'équipe cherchée.
 * Les réponses sont gardées un moment en mémoire pour ne pas rappeler les services à chaque onglet. */
import { net } from 'electron'
import {
  lireFlux,
  SOURCES_ACTUALITES,
  type Actualite,
  type Equipe,
  type JeuGratuit,
  type Match,
  type MeteoActuelle,
  type ResultatsEquipe,
  type SortieJeu,
  type Ville
} from '../shared/widgets'

const cache = new Map<string, { quand: number; valeur: unknown }>()

async function json(url: string): Promise<unknown> {
  const r = await net.fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

async function memoriser<T>(cle: string, duree: number, charger: () => Promise<T>): Promise<T> {
  const c = cache.get(cle)
  if (c && Date.now() - c.quand < duree) return c.valeur as T
  const valeur = await charger()
  cache.set(cle, { quand: Date.now(), valeur })
  return valeur
}

export async function chercherVilles(nom: string): Promise<Ville[]> {
  const q = nom.trim().slice(0, 80)
  if (q.length < 2) return []
  return memoriser(`ville:${q.toLowerCase()}`, 86_400_000, async () => {
    const d = (await json(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=fr&format=json`)) as {
      results?: {
        name: string
        admin1?: string
        country?: string
        latitude: number
        longitude: number
      }[]
    }
    return (d.results ?? []).map((v) => ({
      nom: v.name,
      detail: [v.admin1, v.country].filter(Boolean).join(', '),
      lat: Math.round(v.latitude * 1e4) / 1e4,
      lon: Math.round(v.longitude * 1e4) / 1e4
    }))
  })
}

export async function meteo(lat: number, lon: number): Promise<MeteoActuelle> {
  return memoriser(`meteo:${lat},${lon}`, 10 * 60_000, async () => {
    const d = (await json(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day' +
        '&hourly=temperature_2m,weather_code,precipitation_probability' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
        '&timezone=auto&forecast_days=5'
    )) as {
      current: {
        time: string
        temperature_2m: number
        apparent_temperature: number
        weather_code: number
        wind_speed_10m: number
        is_day: number
      }
      hourly: {
        time: string[]
        temperature_2m: number[]
        weather_code: number[]
        precipitation_probability: number[]
      }
      daily: {
        time: string[]
        weather_code: number[]
        temperature_2m_max: number[]
        temperature_2m_min: number[]
        precipitation_probability_max: number[]
      }
    }
    // les heures qui viennent, à partir de l'heure actuelle du lieu
    const debut = Math.max(
      0,
      d.hourly.time.findIndex((t) => t >= d.current.time.slice(0, 13))
    )
    return {
      temperature: d.current.temperature_2m,
      ressentie: d.current.apparent_temperature,
      code: d.current.weather_code,
      vent: d.current.wind_speed_10m,
      jour: d.current.is_day === 1,
      heures: d.hourly.time.slice(debut + 1, debut + 9).map((t, i) => ({
        heure: t.slice(11, 13) + ' h',
        temperature: d.hourly.temperature_2m[debut + 1 + i],
        code: d.hourly.weather_code[debut + 1 + i],
        pluie: d.hourly.precipitation_probability[debut + 1 + i] ?? 0
      })),
      jours: d.daily.time.map((t, i) => ({
        date: t,
        code: d.daily.weather_code[i],
        min: d.daily.temperature_2m_min[i],
        max: d.daily.temperature_2m_max[i],
        pluie: d.daily.precipitation_probability_max[i] ?? 0
      }))
    }
  })
}

export async function actualites(source: string): Promise<Actualite[]> {
  const s = SOURCES_ACTUALITES.find((x) => x.id === source)
  if (!s) return []
  return memoriser(`actu:${s.id}`, 10 * 60_000, async () => {
    const r = await net.fetch(s.url, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return lireFlux((await r.text()).slice(0, 3_000_000))
  })
}

/** Hôtes d'où les images peuvent venir (jaquettes, écussons). */
const HOTES_IMAGES = /(^|\.)(epicgames\.com|epicgames\.net|gamerpower\.com|steamstatic\.com|akamaihd\.net|thesportsdb\.com)$/

/** Télécharge une petite image et la rend en data: (l'interface n'a pas le droit de charger des images du web). */
async function image(url: string): Promise<string> {
  if (!url) return ''
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' || !HOTES_IMAGES.test(u.hostname)) return ''
    return await memoriser(`img:${url}`, 86_400_000, async () => {
      const r = await net.fetch(url, { signal: AbortSignal.timeout(8000) })
      const type = r.headers.get('content-type') ?? ''
      if (!r.ok || !/^image\/(png|jpeg|webp|gif)/.test(type)) return ''
      const octets = Buffer.from(await r.arrayBuffer())
      return octets.length > 600_000 ? '' : `data:${type.split(';')[0]};base64,${octets.toString('base64')}`
    })
  } catch {
    return ''
  }
}

export async function jeuxGratuits(): Promise<JeuGratuit[]> {
  return memoriser('jeux-gratuits', 30 * 60_000, async () => {
    const [epic, autres] = await Promise.all([jeuxEpic().catch(() => []), jeuxGamerPower().catch(() => [])])
    // gratuits maintenant d'abord, puis ceux qui le seront bientôt
    const liste = [...epic.filter((j) => !j.bientot), ...autres, ...epic.filter((j) => j.bientot)].slice(0, 14)
    return Promise.all(liste.map(async (j) => ({ ...j, image: await image(j.image) })))
  })
}

interface OffreEpic {
  startDate: string
  endDate: string
  discountSetting?: { discountPercentage?: number }
}

async function jeuxEpic(): Promise<JeuGratuit[]> {
  const d = (await json('https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=fr&country=FR&allowCountries=FR')) as {
    data: {
      Catalog: {
        searchStore: {
          elements: {
            title: string
            productSlug?: string | null
            catalogNs?: { mappings?: { pageSlug: string }[] | null }
            offerMappings?: { pageSlug: string }[] | null
            keyImages?: { type: string; url: string }[]
            promotions?: {
              promotionalOffers?: { promotionalOffers: OffreEpic[] }[]
              upcomingPromotionalOffers?: { promotionalOffers: OffreEpic[] }[]
            } | null
          }[]
        }
      }
    }
  }
  // une offre à 0 % du prix = gratuit
  const gratuite = (groupes?: { promotionalOffers: OffreEpic[] }[]): OffreEpic | undefined =>
    groupes?.flatMap((g) => g.promotionalOffers).find((o) => o.discountSetting?.discountPercentage === 0)
  const res: JeuGratuit[] = []
  for (const e of d.data.Catalog.searchStore.elements) {
    const maintenant = gratuite(e.promotions?.promotionalOffers)
    const bientot = maintenant ? undefined : gratuite(e.promotions?.upcomingPromotionalOffers)
    const offre = maintenant ?? bientot
    if (!offre) continue
    const slug = e.catalogNs?.mappings?.[0]?.pageSlug ?? e.offerMappings?.[0]?.pageSlug ?? e.productSlug?.replace(/\/home$/, '')
    const img = e.keyImages?.find((k) => k.type === 'OfferImageWide') ?? e.keyImages?.find((k) => k.type === 'Thumbnail')
    res.push({
      titre: e.title,
      lien: slug ? `https://store.epicgames.com/fr/p/${slug}` : 'https://store.epicgames.com/fr/free-games',
      // le CDN d'Epic sert des images de 2560 px : on demande une petite version
      image: img ? `${img.url}?w=240&h=135&resize=1&quality=medium` : '',
      plateforme: 'Epic Games',
      fin: Date.parse(offre.endDate) || 0,
      bientot: !!bientot,
      debut: Date.parse(offre.startDate) || 0
    })
  }
  return res
}

interface DonGamerPower {
  title: string
  image: string
  open_giveaway_url: string
  platforms: string
  end_date: string
}

async function jeuxGamerPower(): Promise<JeuGratuit[]> {
  const listes = await Promise.all(
    ['steam', 'gog'].map((p) => (json(`https://www.gamerpower.com/api/giveaways?type=game&platform=${p}&sort-by=date`) as Promise<DonGamerPower[]>).catch(() => []))
  )
  return (
    listes
      .flatMap((l) => (Array.isArray(l) ? l : []))
      // jeux à garder pour de bon, pas des clés sous condition ni des bêtas
      .filter((g) => !/key giveaway|beta|alpha|playtest/i.test(g.title) && /^https:\/\//.test(g.open_giveaway_url))
      .slice(0, 6)
      .map((g) => ({
        titre: g.title.replace(/\s*\((Steam|GOG)\)\s*Giveaway$/i, '').replace(/\s*Giveaway$/i, ''),
        lien: g.open_giveaway_url,
        image: g.image,
        plateforme: /gog/i.test(g.platforms) ? 'GOG' : 'Steam',
        fin: g.end_date && g.end_date !== 'N/A' ? Date.parse(g.end_date.replace(' ', 'T')) || 0 : 0,
        bientot: false,
        debut: 0
      }))
  )
}

export async function sortiesJeux(): Promise<SortieJeu[]> {
  return memoriser('sorties', 6 * 3_600_000, async () => {
    const d = (await json('https://store.steampowered.com/search/results/?filter=popularcomingsoon&json=1&cc=fr&l=french&count=14')) as {
      items: { name: string; logo: string }[]
    }
    const jeux = d.items
      .map((i) => ({
        titre: i.name,
        appid: /\/apps\/(\d+)\//.exec(i.logo)?.[1]
      }))
      .filter((i): i is { titre: string; appid: string } => !!i.appid)
      .slice(0, 12)
    return Promise.all(
      jeux.map(async (j) => {
        const det = (await json(`https://store.steampowered.com/api/appdetails?appids=${j.appid}&cc=fr&l=french&filters=release_date,basic`).catch(() => null)) as Record<
          string,
          {
            success: boolean
            data?: { header_image?: string; release_date?: { date?: string } }
          }
        > | null
        const info = det?.[j.appid]?.data
        return {
          titre: j.titre,
          lien: `https://store.steampowered.com/app/${j.appid}`,
          image: await image(info?.header_image ?? ''),
          date: info?.release_date?.date || 'Bientôt'
        }
      })
    )
  })
}

/** TheSportsDB, avec sa clé publique de test (gratuite, sans compte). */
const SPORTSDB = 'https://www.thesportsdb.com/api/v1/json/123'

/** Surnoms courants → nom exact chez TheSportsDB (sa clé gratuite ne trouve que les noms complets). */
const SURNOMS: Record<string, string> = {
  psg: 'Paris SG',
  'paris saint-germain': 'Paris SG',
  'paris saint germain': 'Paris SG',
  om: 'Marseille',
  'olympique de marseille': 'Marseille',
  ol: 'Lyon',
  'olympique lyonnais': 'Lyon',
  losc: 'Lille',
  asse: 'Saint-Etienne',
  'saint-étienne': 'Saint-Etienne',
  'as monaco': 'Monaco',
  'rc lens': 'Lens',
  'stade rennais': 'Rennes',
  'ogc nice': 'Nice',
  barca: 'Barcelona',
  barça: 'Barcelona',
  'fc barcelone': 'Barcelona',
  barcelone: 'Barcelona',
  real: 'Real Madrid',
  atletico: 'Atletico Madrid',
  'atlético madrid': 'Atletico Madrid',
  bayern: 'Bayern Munich',
  'bayern munich': 'Bayern Munich',
  'bayern münchen': 'Bayern Munich',
  dortmund: 'Borussia Dortmund',
  juve: 'Juventus',
  inter: 'Inter Milan',
  'inter milan': 'Inter Milan',
  milan: 'AC Milan',
  'man united': 'Manchester United',
  'man utd': 'Manchester United',
  'man city': 'Manchester City',
  liverpool: 'Liverpool',
  chelsea: 'Chelsea',
  spurs: 'Tottenham',
  lakers: 'Los Angeles Lakers',
  clippers: 'Los Angeles Clippers',
  celtics: 'Boston Celtics',
  warriors: 'Golden State Warriors',
  bulls: 'Chicago Bulls',
  knicks: 'New York Knicks',
  heat: 'Miami Heat',
  'spurs nba': 'San Antonio Spurs',
  'san antonio': 'San Antonio Spurs',
  nets: 'Brooklyn Nets',
  bucks: 'Milwaukee Bucks',
  'equipe de france': 'France',
  'équipe de france': 'France',
  bleus: 'France',
  'les bleus': 'France',
  'xv de france': 'France Rugby',
  'stade toulousain': 'Toulouse',
  rct: 'Toulon'
}

export async function chercherEquipes(nom: string): Promise<(Equipe & { sport: string })[]> {
  const saisie = nom.trim().slice(0, 60)
  const q = SURNOMS[saisie.toLowerCase()] ?? saisie
  if (q.length < 2) return []
  return memoriser(`equipes:${q.toLowerCase()}`, 86_400_000, async () => {
    const d = (await json(`${SPORTSDB}/searchteams.php?t=${encodeURIComponent(q)}`)) as {
      teams?:
        | {
            idTeam: string
            strTeam: string
            strLeague?: string
            strSport?: string
          }[]
        | null
    }
    return (d.teams ?? []).slice(0, 8).map((t) => ({
      id: t.idTeam,
      nom: t.strTeam,
      ligue: t.strLeague ?? '',
      sport: t.strSport ?? ''
    }))
  })
}

interface EvenementSportsDB {
  idEvent: string
  strLeague?: string
  strHomeTeam: string
  strAwayTeam: string
  intHomeScore: string | null
  intAwayScore: string | null
  strTimestamp?: string | null
  dateEvent?: string
  strTime?: string
}

function versMatch(e: EvenementSportsDB | undefined): Match | null {
  if (!e) return null
  const score = (s: string | null): number | null => (s === null || s === '' || isNaN(Number(s)) ? null : Number(s))
  // les heures de TheSportsDB sont en UTC
  const date = Date.parse(e.strTimestamp ? `${e.strTimestamp.replace(/Z?$/, '')}Z` : `${e.dateEvent}T${e.strTime ?? '00:00:00'}Z`)
  return {
    id: e.idEvent,
    ligue: e.strLeague ?? '',
    domicile: e.strHomeTeam,
    exterieur: e.strAwayTeam,
    scoreDomicile: score(e.intHomeScore),
    scoreExterieur: score(e.intAwayScore),
    date: Number.isFinite(date) ? date : 0
  }
}

/** Écusson de l'équipe, gardé une semaine (il ne change pas). */
async function ecusson(id: string): Promise<string> {
  try {
    return await memoriser(`ecusson:${id}`, 7 * 86_400_000, async () => {
      const infos = (await json(`${SPORTSDB}/lookupteam.php?id=${id}`)) as {
        teams?: { strBadge?: string }[] | null
      }
      const badge = infos.teams?.[0]?.strBadge
      return badge ? image(`${badge}/tiny`) : ''
    })
  } catch {
    return ''
  }
}

export async function resultatsEquipe(equipe: Equipe): Promise<ResultatsEquipe> {
  return memoriser(`resultats:${equipe.id}`, 10 * 60_000, async () => {
    // le service limite le nombre d'appels : une erreur n'est pas gardée en mémoire comme « aucun match »
    const [derniers, prochains] = await Promise.all([
      json(`${SPORTSDB}/eventslast.php?id=${equipe.id}`) as Promise<{
        results?: EvenementSportsDB[] | null
      }>,
      json(`${SPORTSDB}/eventsnext.php?id=${equipe.id}`) as Promise<{
        events?: EvenementSportsDB[] | null
      }>
    ])
    return {
      equipe,
      ecusson: await ecusson(equipe.id),
      dernier: versMatch(derniers?.results?.[0]),
      prochain: versMatch(prochains?.events?.[0])
    }
  })
}
