/* Interface du navigateur : barre de titre (onglets du haut), barre latérale (prioritaires), barre d'outils, zone de page. */
import { useEffect, useState } from 'react'
import type { CommandeUi, EtatOnglet } from '../../shared/onglets'
import { MenuVerre } from './composants/MenuVerre'
import { RemplissageWeb } from './composants/RemplissageWeb'
import { Accueil } from './composants/Accueil'
import { BarreLaterale } from './composants/BarreLaterale'
import { BarreOutils } from './composants/BarreOutils'
import { BarreTitre } from './composants/BarreTitre'
import { NouvelOnglet } from './composants/NouvelOnglet'
import { OngletsHaut } from './composants/OngletsHaut'
import { PageFavoris, PageHistorique, PageTelechargements } from './composants/PagesDonnees'
import { PageIA, useOllama } from './composants/PageIA'
import { ouvrirConversation, PageAmis } from './composants/PageAmis'
import { SelecteurZone } from './composants/SelecteurZone'
import { BandeauEcriture } from './composants/BandeauEcriture'
import { BandeauPlantage } from './composants/Plantages'
import { BandeauEnsemble } from './composants/BandeauEnsemble'
import { RechercheOnglets } from './composants/RechercheOnglets'
import type { ZoneCapture } from '../../shared/chat'
import { PanneauIA, type DemandeExterne } from './composants/PanneauIA'
import { QuestionIA } from './composants/QuestionIA'
import { Parametres } from './composants/Parametres'
import { PageTaches } from './composants/PageTaches'
import { PageRecherche } from './composants/PageRecherche'
import { PageExtensions } from './composants/PageExtensions'
import { ZonePage } from './composants/ZonePage'
import { useGlisser } from './useGlisser'
import { useApresFigeage } from './pagesFigees'
import { useOnglets } from './useOnglets'
import { useAttributsTheme, useInfosApp, useReglages } from './useReglages'

export function App(): React.JSX.Element {
  const [reglages, modifier] = useReglages()
  const infos = useInfosApp()
  useAttributsTheme(reglages, infos)
  const { etat, actif } = useOnglets()
  const glisser = useGlisser()
  const ia = useOllama()
  const [iaOuverte, setIaOuverte] = useState(false)
  const [demande, setDemande] = useState<DemandeExterne | null>(null)
  const [zone, setZone] = useState<{ idCapture: string; image: string } | null>(null)
  const [rechercheOnglets, setRechercheOnglets] = useState(false)
  const [remplissage, setRemplissage] = useState<number | null>(null)
  /** Menu en verre préparé par le main (clic droit dans une page, sur un onglet…). */
  const [menu, setMenu] = useState<Extract<CommandeUi, { type: 'menu' }> | null>(null)
  /** « Demande ou cherche », clic droit › IA, zone de l'écran : la question part dans le panneau IA. */
  const demanderIA = (texte: string, avecPage: boolean, z?: ZoneCapture): void => {
    setIaOuverte(true)
    if (texte) setDemande((d) => ({ texte, avecPage, zone: z, n: (d?.n ?? 0) + 1 }))
  }
  // commandes venues du main : Ctrl+Espace (même quand le clavier est dans une page), menu clic droit, zone capturée
  useEffect(
    () =>
      window.se7en.app.surCommande((c) => {
        if (c.type === 'basculer-ia') setIaOuverte((v) => !v)
        else if (c.type === 'demander-ia') demanderIA(c.texte, c.avecPage)
        else if (c.type === 'zone') setZone({ idCapture: c.idCapture, image: c.image })
        else if (c.type === 'rechercher-onglets') setRechercheOnglets((v) => !v)
        else if (c.type === 'remplir-formulaire') setRemplissage(c.idOnglet)
        else if (c.type === 'menu')
          setMenu((ancien) => {
            // un nouveau menu remplace l'ancien (fermé sans choix)
            if (ancien) window.se7en.app.choixMenu(ancien.id, null)
            return c
          })
        else if (c.type === 'ouvrir-conversation') ouvrirConversation(c.cible)
      }),
    []
  )

  const disposition = reglages?.disposition ?? 'les-deux'
  const barreDispo = disposition !== 'haut'
  const barreDemandee = barreDispo && !!reglages?.barreLaterale
  // la barre latérale et le panneau IA s'animent sur l'image figée des pages (sinon la page saccade à chaque image)
  const barreOuverte = useApresFigeage(barreDemandee, 320)
  const panneauOuvert = useApresFigeage(iaOuverte, 340)
  // Barre latérale cachée en disposition « à gauche » : les onglets remontent en haut pour rester accessibles.
  const normauxEnHaut = disposition !== 'gauche' || !barreOuverte
  const enSplit = !!etat.split && !!actif && (etat.split.gauche === actif.id || etat.split.droite === actif.id)

  /** Ce que l'interface dessine à la place d'une page web. */
  const contenu = (o: EtatOnglet): React.ReactNode => {
    switch (o.url) {
      case '':
        return <NouvelOnglet key={o.id} onglet={o} demanderIA={(t) => demanderIA(t, false)} />
      case 'se7en://parametres':
        return reglages && <Parametres reglages={reglages} modifier={modifier} infos={infos} />
      case 'se7en://historique':
        return <PageHistorique idOnglet={o.id} />
      case 'se7en://favoris':
        return <PageFavoris idOnglet={o.id} />
      case 'se7en://telechargements':
        return <PageTelechargements />
      case 'se7en://ia':
        return reglages && <PageIA reglages={reglages} />
      case 'se7en://amis':
        return <PageAmis onglets={etat} />
      case 'se7en://extensions':
        return <PageExtensions />
      case 'se7en://recherche':
        return <PageRecherche />
      case 'se7en://taches':
        return <PageTaches onglets={etat} />
      default:
        return null
    }
  }

  return (
    <div className="coque">
      <BarreTitre>
        <OngletsHaut etat={etat} glisser={glisser} avecNormaux={normauxEnHaut} avecPrioritaires={!barreOuverte} />
      </BarreTitre>
      <div className="corps">
        <BarreLaterale etat={etat} glisser={glisser} ouverte={barreOuverte} avecNormaux={disposition === 'gauche'} />
        <div className="colonne">
          <BarreOutils
            actif={actif}
            etat={etat}
            enSplit={enSplit}
            bloqueurActif={reglages?.bloqueur ?? true}
            ia={{ ouverte: iaOuverte, basculer: () => setIaOuverte((v) => !v), demander: (t) => demanderIA(t, true) }}
            barre={barreDispo ? { ouverte: barreDemandee, basculer: () => modifier({ barreLaterale: !barreDemandee }) } : null}
          />
          {reglages && <QuestionIA reglages={reglages} modifier={modifier} ia={ia} />}
          <BandeauEcriture />
          <BandeauPlantage />
          <BandeauEnsemble />
          {actif?.traduction && actif.traduction.etat !== 'traduite' && !(actif.traduction.etat === 'en-cours' && actif.traduction.fond) && (
            <div className={`bandeau-traduction${actif.traduction.etat === 'erreur' ? ' erreur' : ''}`} role="status">
              {actif.traduction.etat === 'en-cours' ? (
                <>
                  <span>Traduction en français… {Math.round(actif.traduction.progression * 100)} %</span>
                  <div className="jauge-traduction">
                    <div style={{ width: `${Math.max(4, actif.traduction.progression * 100)}%` }} />
                  </div>
                </>
              ) : (
                <span>{actif.traduction.message}</span>
              )}
              <span className="espace" />
              <button className="bouton-verre petit" onClick={() => window.se7en.traduction.original(actif.id)}>
                {actif.traduction.etat === 'en-cours' ? 'Arrêter et revenir à l’original' : 'Fermer'}
              </button>
            </div>
          )}
          {actif?.phishing && (
            <div className="bandeau-phishing" role="alert">
              <strong>⚠ Attention : page peut-être frauduleuse</strong>
              <span>{actif.phishing}</span>
              <span className="espace" />
              <button className="bouton-principal" onClick={() => (actif.peutReculer ? window.se7en.onglets.precedent(actif.id) : window.se7en.onglets.fermer(actif.id))}>
                {actif.peutReculer ? 'Revenir en arrière' : 'Fermer la page'}
              </button>
              <button className="bouton-verre" onClick={() => window.se7en.phishing.ignorer(actif.id)}>
                Je fais confiance à ce site
              </button>
            </div>
          )}
          <ZonePage etat={etat} contenu={contenu} glisser={glisser} />
        </div>
        {reglages && (
          <PanneauIA etat={etat} actif={actif} ia={ia} reglages={reglages} ouvert={panneauOuvert} fermer={() => setIaOuverte(false)} demande={demande} />
        )}
      </div>
      {menu && (
        <MenuVerre
          key={menu.id}
          elements={menu.entrees}
          position={{ type: 'point', x: menu.x, y: menu.y }}
          fermer={(choix) => {
            setMenu(null)
            window.se7en.app.choixMenu(menu.id, choix?.id ?? null)
          }}
        />
      )}
      {remplissage !== null && <RemplissageWeb idOnglet={remplissage} fermer={() => setRemplissage(null)} />}
      {rechercheOnglets && <RechercheOnglets etat={etat} fermer={() => setRechercheOnglets(false)} />}
      {zone && (
        <SelecteurZone
          key={zone.idCapture}
          idCapture={zone.idCapture}
          image={zone.image}
          fermer={() => setZone(null)}
          valider={(z, question) => {
            setZone(null)
            demanderIA(question, false, z)
          }}
        />
      )}
      {reglages && !reglages.accueilTermine && <Accueil reglages={reglages} modifier={modifier} />}
    </div>
  )
}
