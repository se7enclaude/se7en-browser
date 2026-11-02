/* Coffre personnel : les informations de l'utilisateur pour remplir les formulaires.
 * Les VALEURS restent dans le main et l'interface ; l'IA ne reçoit jamais que les CLÉS et leurs libellés. */

export interface DefinitionChamp {
  cle: string
  libelle: string
  /** Exemple affiché dans le champ vide. */
  exemple?: string
  /** Valeur sensible : masquée par défaut dans les paramètres. */
  sensible?: boolean
}

export const CHAMPS_COFFRE: DefinitionChamp[] = [
  { cle: 'civilite', libelle: 'Civilité', exemple: 'Madame / Monsieur' },
  { cle: 'prenom', libelle: 'Prénom', exemple: 'Claire' },
  { cle: 'nom', libelle: "Nom d'usage", exemple: 'Martin' },
  { cle: 'nomNaissance', libelle: 'Nom de naissance', exemple: 'Dupont' },
  { cle: 'dateNaissance', libelle: 'Date de naissance', exemple: 'JJ/MM/AAAA' },
  { cle: 'lieuNaissance', libelle: 'Lieu de naissance', exemple: 'Lyon (69)' },
  { cle: 'nationalite', libelle: 'Nationalité', exemple: 'Française' },
  { cle: 'adresse', libelle: 'Adresse (numéro et rue)', exemple: '12 rue de la République' },
  { cle: 'complementAdresse', libelle: "Complément d'adresse", exemple: 'Bât. B, 3e étage' },
  { cle: 'codePostal', libelle: 'Code postal', exemple: '69002' },
  { cle: 'ville', libelle: 'Ville', exemple: 'Lyon' },
  { cle: 'pays', libelle: 'Pays', exemple: 'France' },
  { cle: 'email', libelle: 'E-mail', exemple: 'claire@exemple.fr' },
  { cle: 'telephone', libelle: 'Téléphone', exemple: '06 12 34 56 78' },
  { cle: 'profession', libelle: 'Profession' },
  { cle: 'numeroSecu', libelle: 'N° de sécurité sociale', sensible: true }
]

/** Informations calculées à partir d'une autre (une date de naissance découpée en jour / mois / année). */
export const CHAMPS_DERIVES: DefinitionChamp[] = [
  { cle: 'dateNaissance_jour', libelle: 'Jour de naissance (2 chiffres)' },
  { cle: 'dateNaissance_mois', libelle: 'Mois de naissance (2 chiffres)' },
  { cle: 'dateNaissance_annee', libelle: 'Année de naissance (4 chiffres)' },
  { cle: 'adresseComplete', libelle: 'Adresse complète sur une ligne (rue, code postal, ville)' }
]

export interface ChampPerso {
  id: string
  libelle: string
  valeur: string
}

export interface Coffre {
  /** Valeurs des champs prédéfinis, par clé. */
  valeurs: Record<string, string>
  /** Champs ajoutés par l'utilisateur. */
  perso: ChampPerso[]
}

export interface EtatCoffre {
  /** Faux si Windows ne permet pas de chiffrer (le coffre ne peut alors pas être enregistré). */
  disponible: boolean
  coffre: Coffre
}

export const COFFRE_VIDE: Coffre = { valeurs: {}, perso: [] }

/** Toutes les clés connues (prédéfinies, dérivées, personnelles) avec leur libellé : c'est tout ce que voit l'IA. */
export function clesDisponibles(c: Coffre): { cle: string; libelle: string }[] {
  const rempli = (cle: string): boolean => !!valeurDe(cle, c)
  // seulement la clé et le libellé : ni la valeur, ni l'exemple
  return [
    ...[...CHAMPS_COFFRE, ...CHAMPS_DERIVES].filter((d) => rempli(d.cle)).map(({ cle, libelle }) => ({ cle, libelle })),
    ...c.perso.filter((p) => p.valeur.trim()).map((p) => ({ cle: `perso_${p.id}`, libelle: p.libelle.slice(0, 80) }))
  ]
}

/** « 05/03/1990 », « 5-3-1990 » ou « 1990-03-05 » → jour, mois, année. */
export function decouperDate(date: string): { jour: string; mois: string; annee: string } | null {
  const t = date.trim()
  let m = /^(\d{1,2})[/.\- ](\d{1,2})[/.\- ](\d{4})$/.exec(t)
  if (m) return { jour: m[1].padStart(2, '0'), mois: m[2].padStart(2, '0'), annee: m[3] }
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t)
  if (m) return { jour: m[3].padStart(2, '0'), mois: m[2].padStart(2, '0'), annee: m[1] }
  return null
}

export function valeurDe(cle: string, c: Coffre): string {
  if (cle.startsWith('perso_')) return c.perso.find((p) => `perso_${p.id}` === cle)?.valeur.trim() ?? ''
  if (cle.startsWith('dateNaissance_')) {
    const d = decouperDate(c.valeurs.dateNaissance ?? '')
    return d ? d[cle.slice('dateNaissance_'.length) as 'jour' | 'mois' | 'annee'] : ''
  }
  if (cle === 'adresseComplete') {
    const v = c.valeurs
    const rue = [v.adresse, v.complementAdresse].filter((x) => x?.trim()).join(', ')
    const villeCp = [v.codePostal, v.ville].filter((x) => x?.trim()).join(' ')
    return [rue, villeCp].filter(Boolean).join(', ')
  }
  return c.valeurs[cle]?.trim() ?? ''
}

/** Valeur à écrire pour un champ associé à une ou plusieurs clés (« Nom et prénom » → « Claire Martin »). */
export function valeurPour(cles: string[], c: Coffre): string {
  return cles
    .map((k) => valeurDe(k, c))
    .filter(Boolean)
    .join(' ')
}

/** Minuscules, sans accents, espaces simples : pour comparer des libellés. */
export function normaliser(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9@]+/g, ' ')
    .trim()
}

/** Repérage simple par le libellé du champ, sans IA. L'ordre compte : du plus précis au plus général. */
const REGLES: [RegExp, string[]][] = [
  [/\b(nom et prenom|prenom et nom|nom prenom|prenom nom|full name|nom complet)\b/, ['prenom', 'nom']],
  [/\b(nom de naissance|nom de jeune fille|maiden name|birth name)\b/, ['nomNaissance']],
  [/\b(prenoms?|first name|given name)\b/, ['prenom']],
  [/\b(jour de naissance)\b/, ['dateNaissance_jour']],
  [/\b(mois de naissance)\b/, ['dateNaissance_mois']],
  [/\b(annee de naissance)\b/, ['dateNaissance_annee']],
  [/\b(date de naissance|ne e? le|nee le|birth ?date|date of birth)\b/, ['dateNaissance']],
  [/\b(lieu de naissance|ne e? a|nee a|place of birth|birth ?place)\b/, ['lieuNaissance']],
  [/\b(securite sociale|n ?ss|nir|social security)\b/, ['numeroSecu']],
  [/\b(e ?mail|courriel|adresse electronique|mel)\b/, ['email']],
  [/\b(telephone|tel|portable|mobile|phone)\b/, ['telephone']],
  [/\b(code postal|cp|zip|postcode|postal code)\b/, ['codePostal']],
  [/\b(complement d adresse|complement)\b/, ['complementAdresse']],
  [/\b(ville|commune|localite|city|town)\b/, ['ville']],
  [/\b(pays|country)\b/, ['pays']],
  [/\b(nationalite|nationality)\b/, ['nationalite']],
  [/\b(profession|metier|occupation|emploi)\b/, ['profession']],
  [/\b(civilite|titre|title)\b/, ['civilite']],
  [/\b(adresse|address|rue|domicile|voie)\b/, ['adresse']],
  [/\b(nom d usage|nom|last name|surname|family name)\b/, ['nom']]
]

/**
 * Garde-fou sur les associations de l'IA : certaines informations ne vont que dans un champ dont le libellé
 * en parle vraiment (une date de naissance n'est pas « la date du jour », un n° de sécu ne va pas n'importe où).
 */
const EXIGENCES: [RegExp, RegExp][] = [
  [/^dateNaissance/, /\b(naissance|naiss|ne e?|nee|birth|born|jour|mois|annee)\b/],
  [/^lieuNaissance$/, /\b(naissance|ne e?|nee|birth|born)\b/],
  [/^numeroSecu$/, /\b(securite sociale|secu|nir|ss|social security|assure)\b/]
]

export function associationPlausible(cle: string, libelle: string): boolean {
  const t = normaliser(libelle)
  return EXIGENCES.every(([cles, libelleRequis]) => !cles.test(cle) || libelleRequis.test(t))
}

export function associerParLibelle(libelle: string): string[] {
  const t = normaliser(libelle)
  if (!t) return []
  for (const [re, cles] of REGLES) if (re.test(t)) return cles
  return []
}
