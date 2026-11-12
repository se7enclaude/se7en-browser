/* Mémoire de navigation : le texte des pages visitées, gardé sur ce PC pendant 30 jours, pour que l'IA retrouve
 * « l'article sur les SSD que j'ai lu mardi ». Un fichier par jour (navigation/AAAA-MM-JJ.jsonl) : les jours de plus
 * de 30 jours sont simplement supprimés. Jamais envoyé sur Internet. Les pages avec un mot de passe ne sont pas gardées. */
import { promises as fs, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { normaliser } from '../../shared/coffre'

export const DUREE_JOURS = 30
const MAX_TEXTE = 8000
/** Une même adresse n'est pas réenregistrée plus d'une fois toutes les 30 minutes. */
const DELAI_MEME_PAGE = 30 * 60 * 1000

export interface PageMemorisee {
  url: string
  titre: string
  date: number
  texte: string
}

export interface Trouvaille {
  page: PageMemorisee
  score: number
  extrait: string
}

const MOTS_VIDES = new Set(
  (
    'les des une est pas que qui dans pour sur par avec son ses aux du de la le un et ou en au ce cette ces plus mais ' +
    'comme tout tous elle ils elles nous vous leur leurs sont été etre être avoir fait faire peut aussi bien très ' +
    'quoi quel quelle quels quelles dont ont sans sous chez entre vers lui moi toi mon ton tes mes nos vos ' +
    'the and for are with that this from was were have has had not but you your all any can its into than then them ' +
    'retrouve retrouver lu vu lue vue page pages article site regarde regardé consulté hier semaine dernier dernière jour'
  ).split(' ')
)

/** Mots utiles d'un texte : minuscules, sans accents, sans mots vides, pluriels simples ramenés au singulier. */
export function motsCles(texte: string): string[] {
  return normaliser(texte)
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length > 2 && !MOTS_VIDES.has(m))
    .map((m) => (m.length > 4 && /[sx]$/.test(m) ? m.slice(0, -1) : m))
}

const jourDe = (date: number): string => new Date(date).toISOString().slice(0, 10)

export class MemoireNavigation {
  private readonly dossier: string
  /** Index en mémoire : dernière version de chaque page (par adresse). */
  private pages: Map<string, PageMemorisee & { mots: Map<string, number>; longueur: number }> | null = null
  /** Lecture asynchrone de l'index en cours (une seule à la fois). */
  private chargement: Promise<string[]> | null = null
  /** Change à chaque ménage ou effacement : une lecture commencée avant est jetée. */
  private generation = 0

  constructor(dossierUtilisateur: string) {
    this.dossier = join(dossierUtilisateur, 'navigation')
  }

  /** Supprime les jours de plus de 30 jours. */
  purger(maintenant = Date.now()): number {
    const limite = jourDe(maintenant - DUREE_JOURS * 24 * 3600 * 1000)
    let n = 0
    for (const f of this.fichiers()) {
      if (f.slice(0, 10) < limite) {
        rmSync(join(this.dossier, f), { force: true })
        n++
      }
    }
    if (n) this.oublierIndex()
    return n
  }

  /** Vrai si cette adresse a déjà été enregistrée il y a moins de 30 minutes (inutile de relire la page). */
  async estRecente(url: string, maintenant = Date.now()): Promise<boolean> {
    const deja = (await this.indexAsync()).get(url)
    return !!deja && maintenant - deja.date < DELAI_MEME_PAGE
  }

  async enregistrer(p: PageMemorisee): Promise<boolean> {
    const texte = p.texte.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXTE)
    if (texte.length < 200) return false
    const index = await this.indexAsync()
    const deja = index.get(p.url)
    if (deja && p.date - deja.date < DELAI_MEME_PAGE) return false
    const page = { url: p.url.slice(0, 2000), titre: p.titre.slice(0, 300), date: p.date, texte }
    await fs.mkdir(this.dossier, { recursive: true })
    await fs.appendFile(join(this.dossier, `${jourDe(p.date)}.jsonl`), JSON.stringify(page) + '\n', 'utf8')
    this.indexer(index, page)
    return true
  }

  /** Les pages qui répondent le mieux à la question (classement BM25 sur les mots-clés), avec un extrait. */
  chercher(question: string, n = 5): Trouvaille[] {
    const index = this.index()
    const termes = [...new Set(motsCles(question))]
    if (!termes.length || !index.size) return []
    const total = index.size
    const longueurMoyenne = [...index.values()].reduce((s, p) => s + p.longueur, 0) / total
    const idf = new Map(
      termes.map((t) => {
        let df = 0
        for (const p of index.values()) if (p.mots.has(t)) df++
        return [t, Math.log(1 + (total - df + 0.5) / (df + 0.5))]
      })
    )
    const res: Trouvaille[] = []
    for (const p of index.values()) {
      let score = 0
      for (const t of termes) {
        const tf = p.mots.get(t) ?? 0
        if (!tf) continue
        score += idf.get(t)! * ((tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (p.longueur / longueurMoyenne))))
        // un mot du titre compte double
        if (motsCles(p.titre).includes(t)) score += idf.get(t)!
      }
      if (score > 0) res.push({ page: { url: p.url, titre: p.titre, date: p.date, texte: p.texte }, score, extrait: extrait(p.texte, termes) })
    }
    return res.sort((a, b) => b.score - a.score).slice(0, n)
  }

  nombre(): number {
    return this.index().size
  }

  effacer(): void {
    rmSync(this.dossier, { recursive: true, force: true })
    this.oublierIndex()
    this.pages = new Map()
  }

  // ---------- interne ----------

  private fichiers(): string[] {
    try {
      return readdirSync(this.dossier).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort()
    } catch {
      return []
    }
  }

  /** L'index devient périmé (ménage, effacement) : une lecture en cours ne doit pas le remettre. */
  private oublierIndex(): void {
    this.pages = null
    this.chargement = null
    this.generation++
  }

  /** Index lu sans bloquer le processus (chemin des pages chargées). */
  private async indexAsync(): Promise<NonNullable<MemoireNavigation['pages']>> {
    for (;;) {
      if (this.pages) return this.pages
      const generation = this.generation
      if (!this.chargement) {
        const lecture: Promise<string[]> = Promise.all(this.fichiers().map((f) => fs.readFile(join(this.dossier, f), 'utf8').catch(() => ''))).finally(() => {
          if (this.chargement === lecture) this.chargement = null
        })
        this.chargement = lecture
      }
      const contenus = await this.chargement
      if (this.pages) return this.pages
      if (generation !== this.generation) continue
      this.pages = this.construire(contenus)
      return this.pages
    }
  }

  /** Index lu d'un coup (recherche de l'IA, nombre de pages) : déjà en mémoire la plupart du temps. */
  private index(): NonNullable<MemoireNavigation['pages']> {
    if (this.pages) return this.pages
    const contenus: string[] = []
    for (const f of this.fichiers()) {
      try {
        contenus.push(readFileSync(join(this.dossier, f), 'utf8'))
      } catch {
        /* fichier illisible : ignoré */
      }
    }
    this.pages = this.construire(contenus)
    return this.pages
  }

  private construire(contenus: string[]): NonNullable<MemoireNavigation['pages']> {
    const index: NonNullable<MemoireNavigation['pages']> = new Map()
    for (const contenu of contenus) {
      for (const ligne of contenu.split('\n')) {
        if (!ligne.trim()) continue
        try {
          const p = JSON.parse(ligne) as PageMemorisee
          if (typeof p.url === 'string' && typeof p.texte === 'string' && typeof p.date === 'number') this.indexer(index, { url: p.url, titre: String(p.titre ?? ''), date: p.date, texte: p.texte })
        } catch {
          /* ligne abîmée : ignorée */
        }
      }
    }
    return index
  }

  private indexer(index: NonNullable<MemoireNavigation['pages']>, p: PageMemorisee): void {
    const mots = new Map<string, number>()
    const liste = motsCles(`${p.titre} ${p.texte}`)
    for (const m of liste) mots.set(m, (mots.get(m) ?? 0) + 1)
    index.delete(p.url) // la version la plus récente passe en dernier (ordre chronologique)
    index.set(p.url, { ...p, mots, longueur: liste.length })
  }
}

/** Le passage de ~1 500 caractères qui contient le plus de mots de la question. */
export function extrait(texte: string, termes: string[], taille = 1500): string {
  if (texte.length <= taille) return texte
  const pas = 250
  let meilleur = 0
  let meilleurScore = -1
  for (let debut = 0; debut < texte.length; debut += pas) {
    const mots = motsCles(texte.slice(debut, debut + taille))
    const score = termes.reduce((s, t) => s + mots.filter((m) => m === t).length, 0)
    if (score > meilleurScore) {
      meilleurScore = score
      meilleur = debut
    }
  }
  return (meilleur > 0 ? '… ' : '') + texte.slice(meilleur, meilleur + taille) + (meilleur + taille < texte.length ? ' …' : '')
}
