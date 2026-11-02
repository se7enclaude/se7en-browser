/* Remplir le PDF d'un onglet avec le coffre : analyse → aperçu (dans l'interface) → remplissage après confirmation. */
import { copyFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { dialog, app, type BrowserWindow } from 'electron'
import { associationPlausible, associerParLibelle, clesDisponibles, valeurPour } from '../../shared/coffre'
import type { AnalyseFormulaire, Proposition, ResultatRemplissage, ValeurARemplir } from '../../shared/formulaire'
import { modelePresent } from '../../shared/ia'
import type { Reglages } from '../../shared/reglages'
import type { CoffreChiffre } from '../coffre/coffre'
import { associerAvecIA } from '../ia/remplissage'
import type { Ollama } from '../ia/ollama'
import type { GestionnaireOnglets } from '../navigateur/onglets'
import type { DocumentsPdf, DocumentPdf } from './documents'
import { analyserChamps, remplirChamps } from './formulaire'

export class ServiceFormulaire {
  constructor(
    private readonly documents: DocumentsPdf,
    private readonly coffre: CoffreChiffre,
    private readonly ollama: Ollama,
    private readonly reglages: () => Reglages
  ) {}

  private documentDe(g: GestionnaireOnglets, idOnglet: number): DocumentPdf {
    const o = g.etat().onglets.find((x) => x.id === idOnglet)
    const doc = o?.pdf ? this.documents.lire(o.pdf) : undefined
    if (!doc) throw new Error("Cet onglet n'affiche pas de PDF.")
    return doc
  }

  /** Nombre de champs à remplir (pour proposer le bouton « Remplir »), sans IA. */
  async compter(g: GestionnaireOnglets, idOnglet: number): Promise<number> {
    try {
      return (await analyserChamps(this.documentDe(g, idOnglet).chemin)).champs.length
    } catch {
      return 0
    }
  }

  async analyser(g: GestionnaireOnglets, idOnglet: number): Promise<AnalyseFormulaire> {
    const doc = this.documentDe(g, idOnglet)
    const { champs, autres } = await analyserChamps(doc.chemin)
    const coffre = this.coffre.lire()
    const cles = clesDisponibles(coffre)

    // l'IA, si elle est activée ; sinon (ou si elle échoue) le repérage par libellé
    let parIA: Map<string, string[]> | null = null
    const r = this.reglages()
    const ia = this.ollama.etat()
    if (cles.length && ia.phase === 'pret' && modelePresent(r.modeleTexte, ia.modeles)) {
      parIA = await associerAvecIA(champs, cles, r.modeleTexte).catch(() => null)
    }
    const clesOk = new Set(cles.map((c) => c.cle))
    const propositions: Proposition[] = champs.map((c) => {
      // garde-fou : on écarte les associations de l'IA qui n'ont pas de sens pour ce libellé
      const ia = parIA?.get(c.nom)?.filter((k) => associationPlausible(k, c.libelle))
      const libelle = associerParLibelle(c.libelle).filter((k) => clesOk.has(k))
      const [lesCles, source]: [string[], Proposition['source']] = ia?.length
        ? [ia, 'ia']
        : !parIA && libelle.length
          ? [libelle, 'libelle']
          : [[], 'aucune']
      return { nom: c.nom, libelle: c.libelle, page: c.page, cles: lesCles, source, valeur: valeurPour(lesCles, coffre), maxLongueur: c.maxLongueur }
    })
    return { nomDocument: doc.nom, propositions, autres, iaUtilisee: !!parIA, coffreVide: cles.length === 0 }
  }

  /** Remplit dans un NOUVEAU fichier (l'original ne bouge pas), puis l'affiche dans le même onglet. */
  async remplir(g: GestionnaireOnglets, idOnglet: number, valeurs: ValeurARemplir[]): Promise<ResultatRemplissage> {
    const doc = this.documentDe(g, idOnglet)
    const sortie = this.documents.cheminTemporaire()
    const rempli = await remplirChamps(doc.chemin, valeurs, sortie)
    const nom = doc.nom.replace(/\.pdf$/i, '') + ' (rempli).pdf'
    const nouveau = this.documents.ajouter(sortie, doc.url, nom, true)
    g.afficherPdf(idOnglet, nouveau.id)
    return { rempli, nomDocument: nom }
  }

  /** « Enregistrer sous… » : copie le PDF affiché où l'utilisateur le choisit. */
  async enregistrerSous(fenetre: BrowserWindow, g: GestionnaireOnglets, idOnglet: number): Promise<string | null> {
    const doc = this.documentDe(g, idOnglet)
    const r = await dialog.showSaveDialog(fenetre, {
      title: 'Enregistrer le PDF',
      defaultPath: `${app.getPath('documents')}\\${basename(doc.nom)}`,
      filters: [{ name: 'Document PDF', extensions: ['pdf'] }]
    })
    if (r.canceled || !r.filePath) return null
    await copyFile(doc.chemin, r.filePath)
    return r.filePath
  }
}
