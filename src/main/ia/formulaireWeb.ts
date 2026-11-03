/* Remplir un formulaire web avec le coffre.
 * 1. Un script (monde isolé, invisible pour la page) relève les champs visibles à remplir : texte, e-mail, téléphone,
 *    date… Jamais les mots de passe, les champs cachés, les fichiers ni les cartes bancaires.
 * 2. Chaque champ est associé à des informations du coffre : d'abord par son attribut « autocomplete » (standard du web),
 *    puis par son libellé, puis par l'IA locale, qui ne reçoit que les libellés des champs et les NOMS des informations,
 *    jamais leurs valeurs.
 * 3. L'utilisateur voit chaque valeur proposée, la corrige ou la décoche, puis confirme : seulement alors le script
 *    écrit les valeurs (comme une saisie au clavier, pour que le site les prenne en compte). */
import type { WebContents } from 'electron'
import { associerParLibelle, clesDisponibles, valeurPour, type Coffre } from '../../shared/coffre'
import type { AnalyseFormulaireWeb, ChampFormulaire } from '../../shared/formulaire'
import { associerAvecIA } from './remplissage'

const MONDE = 7013
const MAX_CHAMPS = 60

const RELEVER = `(() => {
  const S = (window.__se7enForm = { champs: [] })
  const types = ['text', 'email', 'tel', 'number', 'date', 'search', 'url', '']
  const interdit = /(card|carte|cc-|cvc|cvv|iban|bic|password|passwd|mot.?de.?passe|otp|one-time)/i
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    const st = getComputedStyle(el)
    return r.width > 4 && r.height > 4 && st.visibility !== 'hidden' && st.display !== 'none'
  }
  const libelleDe = (el) => {
    const parts = []
    if (el.labels && el.labels.length) parts.push([...el.labels].map((l) => l.innerText).join(' '))
    const aria = el.getAttribute('aria-label')
    if (aria) parts.push(aria)
    const lb = el.getAttribute('aria-labelledby')
    if (lb) parts.push(lb.split(/\\s+/).map((id) => document.getElementById(id)?.innerText || '').join(' '))
    if (el.placeholder) parts.push(el.placeholder)
    if (!parts.join('').trim()) {
      // texte juste avant le champ (formulaires sans <label>)
      let p = el.previousElementSibling || el.parentElement?.previousElementSibling
      if (p && p.innerText) parts.push(p.innerText)
    }
    return parts.join(' — ').replace(/\\s+/g, ' ').trim().slice(0, 120)
  }
  const els = [...document.querySelectorAll('input, textarea')].filter((el) => {
    if (el.disabled || el.readOnly) return false
    if (el.tagName === 'INPUT' && !types.includes((el.getAttribute('type') || '').toLowerCase())) return false
    const indices = [el.name, el.id, el.getAttribute('autocomplete'), el.placeholder].join(' ')
    return !interdit.test(indices) && visible(el)
  }).slice(0, ${MAX_CHAMPS})
  return els.map((el, i) => {
    S.champs.push(el)
    return { nom: 'f' + i, libelle: libelleDe(el), technique: (el.name || el.id || '').slice(0, 60), autocomplete: (el.getAttribute('autocomplete') || '').toLowerCase().slice(0, 60), type: (el.getAttribute('type') || el.tagName).toLowerCase(), valeurActuelle: String(el.value || '').slice(0, 200) }
  })
})()`

const ecrire = (valeurs: { nom: string; valeur: string }[]): string => `(() => {
  const S = window.__se7enForm
  if (!S) return 0
  let n = 0
  for (const { nom, valeur } of ${JSON.stringify(valeurs)}) {
    const el = S.champs[Number(nom.slice(1))]
    if (!el || !el.isConnected) continue
    // comme une vraie saisie : les sites (React, Vue…) écoutent ces évènements
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, valeur)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    n++
  }
  return n
})()`

/** Attribut « autocomplete » standard → informations du coffre. */
const AUTOCOMPLETE: Record<string, string[]> = {
  'given-name': ['prenom'],
  'family-name': ['nom'],
  name: ['prenom', 'nom'],
  email: ['email'],
  tel: ['telephone'],
  'tel-national': ['telephone'],
  'street-address': ['adresse'],
  'address-line1': ['adresse'],
  'address-line2': ['complementAdresse'],
  'postal-code': ['codePostal'],
  'address-level2': ['ville'],
  'country-name': ['pays'],
  bday: ['dateNaissance'],
  'bday-day': ['dateNaissance_jour'],
  'bday-month': ['dateNaissance_mois'],
  'bday-year': ['dateNaissance_annee'],
  'organization-title': ['profession'],
  'honorific-prefix': ['civilite']
}

interface ChampWeb extends ChampFormulaire {
  autocomplete: string
  technique: string
  type: string
}

export async function analyserFormulaireWeb(wc: WebContents, coffre: Coffre, modele: string | null): Promise<AnalyseFormulaireWeb> {
  const releves = (await wc.executeJavaScriptInIsolatedWorld(MONDE, [{ code: RELEVER }])) as Omit<ChampWeb, 'page' | 'maxLongueur'>[]
  const champs: ChampWeb[] = releves.map((c) => ({ ...c, page: 1, maxLongueur: null }))
  const cles = clesDisponibles(coffre)
  const connues = new Set(cles.map((c) => c.cle))
  const associations = new Map<string, { cles: string[]; source: 'autocomplete' | 'libelle' | 'ia' }>()
  for (const c of champs) {
    const parAuto = (AUTOCOMPLETE[c.autocomplete.split(/\s+/).pop() ?? ''] ?? []).filter((k) => connues.has(k))
    if (parAuto.length) associations.set(c.nom, { cles: parAuto, source: 'autocomplete' })
    else {
      const parLibelle = associerParLibelle(`${c.libelle} ${c.technique}`).filter((k) => connues.has(k))
      if (parLibelle.length) associations.set(c.nom, { cles: parLibelle, source: 'libelle' })
    }
  }
  // l'IA pour ce qui reste : libellés des champs et noms des informations seulement
  const restants = champs.filter((c) => !associations.has(c.nom))
  let iaUtilisee = false
  if (modele && restants.length && cles.length) {
    const r = await associerAvecIA(
      restants.map((c) => ({ ...c, libelle: `${c.libelle}${c.technique ? ` (${c.technique})` : ''}` })),
      cles,
      modele
    ).catch(() => new Map<string, string[]>())
    iaUtilisee = true
    for (const [nom, k] of r) if (k.length) associations.set(nom, { cles: k, source: 'ia' })
  }
  return {
    champs: champs.map((c) => {
      const a = associations.get(c.nom)
      return {
        nom: c.nom,
        libelle: c.libelle || c.technique || 'Champ sans nom',
        cles: a?.cles ?? [],
        source: a?.source ?? 'aucune',
        valeur: a ? valeurPour(a.cles, coffre) : '',
        valeurActuelle: c.valeurActuelle
      }
    }),
    iaUtilisee,
    coffreVide: !cles.length
  }
}

/** Écrit les valeurs confirmées par l'utilisateur ; renvoie le nombre de champs remplis. */
export async function remplirFormulaireWeb(wc: WebContents, valeurs: { nom: string; valeur: string }[]): Promise<number> {
  const propres = valeurs.filter((v) => /^f\d{1,3}$/.test(v.nom) && typeof v.valeur === 'string').map((v) => ({ nom: v.nom, valeur: v.valeur.slice(0, 500) }))
  return (await wc.executeJavaScriptInIsolatedWorld(MONDE, [{ code: ecrire(propres) }])) as number
}
