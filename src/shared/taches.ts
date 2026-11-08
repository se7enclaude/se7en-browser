/* Tâches en arrière-plan : le navigateur surveille une page pour toi (prix, changement, résumé quotidien) et te prévient.
 * Les pages sont lues par un lecteur cloisonné (session à part : ni tes cookies ni tes connexions), sur ton PC.
 * Logique pure ici (règles d'alerte, échéances, compréhension des demandes), testée. */

export type TypeTache = 'prix' | 'changement' | 'resume'

export interface PointTache {
  date: number
  /** Prix relevé (tâche « prix »). */
  valeur?: number
  /** Empreinte du texte de la page (tâche « changement »). */
  empreinte?: string
  /** Le texte cherché est-il présent ? (tâche « changement » avec un texte à guetter) */
  present?: boolean
  /** Résumé écrit par l'IA (tâche « resume »). */
  resume?: string
  erreur?: string
}

export interface Tache {
  id: string
  type: TypeTache
  url: string
  titre: string
  creee: number
  active: boolean
  /** Toutes les combien de minutes on vérifie (prix, changement). */
  intervalleMin: number
  /** Prix : prévenir quand il passe sous ce seuil (sinon : à chaque baisse). */
  seuil: number | null
  devise: string | null
  /** Changement : prévenir quand ce texte apparaît (« disponible », « en stock »…) ; vide : à chaque changement. */
  texteGuette: string
  /** Résumé : heure de la journée, « 08:00 ». */
  heure: string
  derniere: number | null
  prochaine: number
  historique: PointTache[]
  /** Dernière alerte envoyée (affichée dans le tableau). */
  alerte: { date: number; texte: string } | null
}

export const MAX_TACHES = 30
export const MAX_HISTORIQUE = 60
export const INTERVALLES_MIN = [15, 30, 60, 180, 360, 720, 1440] as const

export function libelleIntervalle(min: number): string {
  if (min < 60) return `toutes les ${min} min`
  if (min === 60) return 'toutes les heures'
  if (min < 1440) return `toutes les ${min / 60} h`
  return 'une fois par jour'
}

/** Prochaine vérification : à l'heure dite pour un résumé quotidien, sinon après l'intervalle. */
export function prochaineEcheance(t: Pick<Tache, 'type' | 'intervalleMin' | 'heure'>, maintenant: number): number {
  if (t.type === 'resume') {
    const [h, m] = (/^(\d{1,2}):(\d{2})$/.exec(t.heure) ?? [, '8', '00']).slice(1).map(Number)
    const d = new Date(maintenant)
    d.setHours(h, m, 0, 0)
    if (d.getTime() <= maintenant) d.setDate(d.getDate() + 1)
    return d.getTime()
  }
  return maintenant + Math.max(15, t.intervalleMin) * 60_000
}

export function formatPrix(v: number, devise: string | null): string {
  const n = v.toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })
  return devise === 'USD' ? `${n} $` : devise === 'GBP' ? `${n} £` : `${n} €`
}

/** Faut-il prévenir, après ce nouveau relevé ? Renvoie le texte de l'alerte, ou null. */
export function alerteApres(t: Tache, point: PointTache): string | null {
  if (point.erreur) return null
  const precedents = t.historique.filter((p) => !p.erreur)
  const avant = precedents.at(-1)
  if (t.type === 'prix' && point.valeur !== undefined) {
    const prix = formatPrix(point.valeur, t.devise)
    if (t.seuil !== null) {
      const etaitAuDessus = avant?.valeur === undefined || avant.valeur > t.seuil
      return point.valeur <= t.seuil && etaitAuDessus ? `Prix sous ${formatPrix(t.seuil, t.devise)} : ${prix}` : null
    }
    if (avant?.valeur !== undefined && point.valeur < avant.valeur) return `Le prix a baissé : ${formatPrix(avant.valeur, t.devise)} → ${prix}`
    return null
  }
  if (t.type === 'changement') {
    if (t.texteGuette) return point.present && avant?.present === false ? `« ${t.texteGuette} » est apparu sur la page` : null
    return avant?.empreinte && point.empreinte && point.empreinte !== avant.empreinte ? 'La page a changé' : null
  }
  if (t.type === 'resume' && point.resume) return point.resume
  return null
}

/** Ajoute un relevé à l'historique, en ne gardant que les plus récents. */
export function ajouterPoint(t: Tache, point: PointTache): PointTache[] {
  return [...t.historique, point].slice(-MAX_HISTORIQUE)
}

/** Texte de page ramené à l'essentiel pour comparer deux versions (chiffres d'horloge et espaces ignorés). */
export function texteComparable(texte: string): string {
  return texte
    .replace(/\b\d{1,2}[:h]\d{2}(:\d{2})?\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Lit un nombre écrit à la française ou à l'anglaise (« 1 299,99 », « 1,299.99 », « 300 »). */
export function lireNombre(brut: string): number | null {
  let s = brut.replace(/[\s  ']/g, '')
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) s = s.replace(/,/g, '')
  else s = s.replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Prix trouvé dans les données structurées d'une page (JSON-LD, balises meta), ou null. */
export function prixStructure(jsonld: string[], metas: Record<string, string>): { valeur: number; devise: string | null } | null {
  const offres: Record<string, unknown>[] = []
  const parcourir = (o: unknown, profondeur = 0): void => {
    if (!o || typeof o !== 'object' || profondeur > 6) return
    if (Array.isArray(o)) return o.forEach((x) => parcourir(x, profondeur + 1))
    const r = o as Record<string, unknown>
    const type = String(r['@type'] ?? '')
    if (/Offer/i.test(type)) offres.push(r)
    for (const v of Object.values(r)) if (typeof v === 'object') parcourir(v, profondeur + 1)
  }
  for (const bloc of jsonld) {
    try {
      parcourir(JSON.parse(bloc))
    } catch {
      /* JSON mal formé : on ignore ce bloc */
    }
  }
  for (const o of offres) {
    const v = lireNombre(String(o.price ?? o.lowPrice ?? ''))
    if (v) return { valeur: v, devise: typeof o.priceCurrency === 'string' ? o.priceCurrency : null }
  }
  const m = metas['product:price:amount'] ?? metas['og:price:amount'] ?? metas['itemprop:price']
  const v = m ? lireNombre(m) : null
  return v ? { valeur: v, devise: metas['product:price:currency'] ?? metas['og:price:currency'] ?? metas['itemprop:priceCurrency'] ?? null } : null
}

/** Premier prix écrit en clair dans le texte (« 249,99 € », « €249.99 »), en dernier recours. */
export function prixDansTexte(texte: string): { valeur: number; devise: string | null } | null {
  const m = /(\d[\d\s  .,]{0,12}\d|\d)\s?(€|EUR)|(€|\$|£)\s?(\d[\d\s .,]{0,12}\d|\d)|(\d[\d\s.,]{0,12}\d|\d)\s?(\$|£)/.exec(texte)
  if (!m) return null
  const brut = m[1] ?? m[4] ?? m[5]
  const symbole = m[2] ?? m[3] ?? m[6]
  const valeur = lireNombre(brut)
  return valeur ? { valeur, devise: symbole === '$' ? 'USD' : symbole === '£' ? 'GBP' : 'EUR' } : null
}

export interface DemandeTache {
  type: TypeTache
  seuil: number | null
  texteGuette: string
  heure: string
  intervalleMin: number
}

/** Comprend « préviens-moi quand ce prix baisse sous 300 € », « surveille cette page », « préviens-moi quand
 * "en stock" apparaît », « chaque matin résume cette page ». Renvoie null si ce n'est pas une demande de surveillance. */
export function comprendreDemandeTache(texte: string): DemandeTache | null {
  const t = texte.trim().toLowerCase().replace(/[’`]/g, "'")
  const surveiller = /\b(pr[ée]viens[- ]moi|alerte[- ]moi|avertis[- ]moi|surveille|notifie[- ]moi|dis[- ]moi quand)\b/.test(t)
  const quotidien = /\b(chaque|tous les) (matin|jour|soir)s?\b/.exec(t)
  if (quotidien && /\br[ée]sum/.test(t)) {
    const h = /\b(\d{1,2})\s?h(\d{2})?\b/.exec(t)
    const heure = h ? `${h[1].padStart(2, '0')}:${h[2] ?? '00'}` : quotidien[2] === 'soir' ? '19:00' : '08:00'
    return { type: 'resume', seuil: null, texteGuette: '', heure, intervalleMin: 1440 }
  }
  if (!surveiller) return null
  const intervalle = /\btoutes les (\d+)\s?(min|minutes|h|heures?)\b/.exec(t)
  const intervalleMin = intervalle ? Math.min(1440, Math.max(15, Number(intervalle[1]) * (intervalle[2].startsWith('h') ? 60 : 1))) : 60
  if (/\bprix\b|\bbaisse|\bmoins cher|€|\$|\beuros?\b/.test(t)) {
    const s = /(?:sous|en dessous de|moins de|inf[ée]rieur [àa]|à|a)\s+(\d[\d\s.,]*)\s?(€|euros?|\$)?/.exec(t)
    const seuil = s ? lireNombre(s[1].trim()) : null
    return { type: 'prix', seuil, texteGuette: '', heure: '08:00', intervalleMin }
  }
  const guette = /[«"']\s*([^«»"']{2,40}?)\s*[»"']/.exec(texte)
  if (guette && /appara[iî]t|affich|[ée]crit|dispo|stock|ouvre|sort/.test(t)) return { type: 'changement', seuil: null, texteGuette: guette[1].trim(), heure: '08:00', intervalleMin }
  if (/\ben stock\b|\bdisponible\b/.test(t)) return { type: 'changement', seuil: null, texteGuette: /en stock/.test(t) ? 'en stock' : 'disponible', heure: '08:00', intervalleMin }
  if (/\bchange|\bmodifi|\bnouveau|\bnouvelle|\bmise? [àa] jour|\bsurveille\b/.test(t)) return { type: 'changement', seuil: null, texteGuette: '', heure: '08:00', intervalleMin }
  return null
}

/** Phrase de confirmation après la création d'une tâche. */
export function confirmationTache(t: Pick<Tache, 'type' | 'seuil' | 'devise' | 'texteGuette' | 'heure' | 'intervalleMin' | 'titre'>): string {
  const quand =
    t.type === 'prix'
      ? t.seuil !== null
        ? `quand le prix passera sous ${formatPrix(t.seuil, t.devise)}`
        : 'dès que le prix baissera'
      : t.type === 'changement'
        ? t.texteGuette
          ? `quand « ${t.texteGuette} » apparaîtra`
          : 'quand la page changera'
        : `chaque jour à ${t.heure.replace(':', 'h')} avec un résumé`
  const rythme = t.type === 'resume' ? '' : ` Je vérifie ${libelleIntervalle(t.intervalleMin)}.`
  return `C'est noté : je surveille « ${t.titre} » et je te préviens ${quand}.${rythme}\n\nLa page est lue sur ton PC, sans tes cookies ni tes connexions, tant que le navigateur est ouvert. Tes tâches sont dans menu › Tâches.`
}
