/* Page interne se7en://parametres. */
import { useEffect, useState } from 'react'
import type { InfosApp } from '../../../shared/ipc'
import { MOTEURS, type Reglages } from '../../../shared/reglages'
import { modelePresent } from '../../../shared/ia'
import { adresseServeur, SERVEUR_SOCIAL_OFFICIEL } from '../../../shared/social'
import { SectionPlantages } from './Plantages'
import { ReglagesRaccourcis } from './ReglagesRaccourcis'
import { SauvegardeChiffree } from './SauvegardeChiffree'
import { ChoixDisposition, ChoixTeinte, ChoixTheme } from './ChoixApparence'
import { EditeurCoffre } from './EditeurCoffre'
import { ReglagesBloqueur, ReglagesMemoire, ReglagesNavigation } from './ReglagesViePrivee'
import { EditeurSkills } from './EditeurSkills'
import { ReglagesMcp } from './ReglagesMcp'
import { ReglagesSync } from './ReglagesSync'
import { useOllama } from './PageIA'
import { ReglagesMiseAJour } from './MiseAJour'
import { Migration } from './Migration'
import { BoutonVerifierComposants, LigneMajOllama, useComposants } from './EtatComposants'

interface Props {
  reglages: Reglages
  modifier: (p: Partial<Reglages>) => void
  infos: InfosApp | null
}

function Interrupteur({ actif, changer, label }: { actif: boolean; changer: (v: boolean) => void; label: string }): React.JSX.Element {
  return <button role="switch" aria-checked={actif} aria-label={label} className={`interrupteur${actif ? ' actif' : ''}`} onClick={() => changer(!actif)} />
}

function ChampModele({ valeur, changer }: { valeur: string; changer: (v: string) => void }): React.JSX.Element {
  const [brouillon, setBrouillon] = useState(valeur)
  return (
    <input
      className="champ"
      value={brouillon}
      spellCheck={false}
      onChange={(e) => setBrouillon(e.target.value)}
      onBlur={() => brouillon.trim() && brouillon !== valeur && changer(brouillon.trim())}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}

export function Parametres({ reglages, modifier, infos }: Props): React.JSX.Element {
  const ia = useOllama()
  const composants = useComposants()
  const texteEtatIA = !ia
    ? ''
    : ia.phase === 'absent'
      ? "Ollama n'est pas installé."
      : ia.phase === 'arrete'
        ? "Installée, pas activée."
        : ia.phase === 'pret'
          ? modelePresent(reglages.modeleTexte, ia.modeles)
            ? `Activée · Ollama ${ia.version}`
            : 'Ollama tourne, le modèle texte manque.'
          : 'Vérification…'
  return (
    <div className="page-interne">
      <h1>Paramètres</h1>

      <section className="bloc verre-fort">
        <h2>Apparence</h2>
        <div className="ligne-reglage">
          <span>Thème</span>
          <ChoixTheme reglages={reglages} modifier={modifier} />
        </div>
        <div className="ligne-reglage">
          <span>Couleur de l’ambiance</span>
          <ChoixTeinte reglages={reglages} modifier={modifier} />
        </div>
        <div className="ligne-reglage">
          <span>
            Effets de verre <kbd>{infos?.modeste ? 'PC modeste détecté' : 'PC à l’aise'}</kbd>
          </span>
          <select className="champ" value={reglages.effetsVerre} onChange={(e) => modifier({ effetsVerre: e.target.value as Reglages['effetsVerre'] })}>
            <option value="auto">Automatique</option>
            <option value="complets">Complets</option>
            <option value="legers">Allégés (plus fluide)</option>
          </select>
        </div>
        <div className="ligne-reglage">
          <span>
            Accélération graphique <kbd>carte graphique</kbd>
          </span>
          <Interrupteur label="Accélération graphique" actif={reglages.accelerationGraphique} changer={(v) => modifier({ accelerationGraphique: v })} />
        </div>
        <p className="discret petit">
          Désactive-la si tu streames une vidéo (Crunchyroll, Netflix…) sur Discord et qu’elle apparaît en noir chez tes amis.
        </p>
        {infos && infos.acceleration !== reglages.accelerationGraphique && (
          <div className="ligne-reglage">
            <span className="petit">Le changement s’appliquera au redémarrage du navigateur.</span>
            <button className="bouton-principal petit" onClick={() => window.se7en.app.redemarrer()}>
              Redémarrer maintenant
            </button>
          </div>
        )}
      </section>

      <section className="bloc verre-fort">
        <h2>Onglets</h2>
        <ChoixDisposition reglages={reglages} modifier={modifier} />
        <div className="ligne-reglage">
          <span>
            Afficher la barre latérale <kbd>Ctrl+B</kbd>
          </span>
          <Interrupteur
            label="Afficher la barre latérale"
            actif={reglages.barreLaterale && reglages.disposition !== 'haut'}
            changer={(v) => modifier({ barreLaterale: v, ...(v && reglages.disposition === 'haut' ? { disposition: 'les-deux' } : {}) })}
          />
        </div>
        <div className="ligne-reglage">
          <span>
            Mettre en veille les onglets inactifs <kbd>libère la mémoire</kbd>
          </span>
          <select className="champ" value={reglages.veilleOnglets} onChange={(e) => modifier({ veilleOnglets: Number(e.target.value) })}>
            <option value={10}>Après 10 minutes</option>
            <option value={30}>Après 30 minutes</option>
            <option value={60}>Après 1 heure</option>
            <option value={120}>Après 2 heures</option>
            <option value={0}>Jamais</option>
          </select>
        </div>
        <p className="discret petit">
          Chercher parmi tes onglets : <kbd>Ctrl+Maj+A</kbd>. Un onglet en veille se recharge quand tu l’ouvres (jamais celui qui joue du son).
        </p>
      </section>

      <section className="bloc verre-fort">
        <h2>Recherche</h2>
        <div className="ligne-reglage">
          <span>Moteur de recherche</span>
          <select className="champ" value={reglages.moteurRecherche} onChange={(e) => modifier({ moteurRecherche: e.target.value })}>
            {MOTEURS.map((m) => (
              <option key={m.url} value={m.url}>
                {m.nom}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="bloc verre-fort">
        <h2>IA locale (Ollama)</h2>
        <p className="discret">Tout tourne sur ton PC : rien n'est envoyé sur Internet. Ollama ne démarre jamais avec Windows, seulement avec le navigateur.</p>
        <div className="ligne-reglage">
          <span>Modèle texte</span>
          <ChampModele valeur={reglages.modeleTexte} changer={(v) => modifier({ modeleTexte: v })} />
        </div>
        <div className="ligne-reglage">
          <span>Modèle vision</span>
          <ChampModele valeur={reglages.modeleVision} changer={(v) => modifier({ modeleVision: v })} />
        </div>
        <div className="ligne-reglage">
          <span>Modèle rapide</span>
          <ChampModele valeur={reglages.modeleRapide} changer={(v) => modifier({ modeleRapide: v })} />
        </div>
        <div className="ligne-reglage">
          <span>À l'ouverture du navigateur</span>
          <select className="champ" value={reglages.iaDemarrage} onChange={(e) => modifier({ iaDemarrage: e.target.value as Reglages['iaDemarrage'] })}>
            <option value="demander">Me demander</option>
            <option value="toujours">Activer l'IA</option>
            <option value="jamais">Ne pas activer</option>
          </select>
        </div>
        <div className="ligne-reglage">
          <span className="discret">{texteEtatIA}</span>
          <button className="bouton-verre" onClick={() => window.se7en.onglets.interne('se7en://ia')}>
            Installer et gérer l'IA
          </button>
        </div>
        {ia && <LigneMajOllama ia={ia} composants={composants} />}
        <BoutonVerifierComposants composants={composants} />
      </section>

      <ReglagesBloqueur reglages={reglages} modifier={modifier} />

      <ReglagesMemoire reglages={reglages} modifier={modifier} />

      <ReglagesNavigation reglages={reglages} modifier={modifier} />

      <section className="bloc verre-fort">
        <h2>Venir d’un autre navigateur</h2>
        <Migration reglages={reglages} modifier={modifier} />
      </section>

      <ReglagesSocial reglages={reglages} modifier={modifier} />

      <EditeurCoffre />

      <EditeurSkills />

      <ReglagesSync />

      <ReglagesMcp reglages={reglages} modifier={modifier} />

      <ReglagesRaccourcis reglages={reglages} modifier={modifier} />

      <SauvegardeChiffree />

      <SectionPlantages />

      <section className="bloc verre-fort">
        <h2>À propos</h2>
        <ReglagesMiseAJour reglages={reglages} modifier={modifier} version={infos?.version} />
        <div className="ligne-reglage">
          <span className="discret">Écran du premier lancement</span>
          <button className="bouton-verre" onClick={() => modifier({ accueilTermine: false })}>
            Revoir l'écran d'accueil
          </button>
        </div>
      </section>
    </div>
  )
}

/** Profils et amis : adresse du serveur se7en social (vide = serveur officiel). */
function ReglagesSocial({ reglages, modifier }: { reglages: Reglages; modifier: (p: Partial<Reglages>) => void }): React.JSX.Element {
  const [adresse, setAdresse] = useState(reglages.serveurSocial)
  useEffect(() => setAdresse(reglages.serveurSocial), [reglages.serveurSocial])
  const valide = !adresse.trim() || adresseServeur(adresse) !== null
  const valider = (): void => {
    if (valide && adresse.trim() !== reglages.serveurSocial) modifier({ serveurSocial: adresse.trim() })
  }
  return (
    <section className="bloc verre-fort">
      <h2>Profils et amis</h2>
      <p className="discret">Seuls ton pseudo, ta photo, tes amis et vos messages passent par le serveur se7en social. Le reste ne quitte pas ce PC.</p>
      <div className="ligne-reglage">
        <span>Serveur</span>
        <input
          className="champ"
          value={adresse}
          placeholder={SERVEUR_SOCIAL_OFFICIEL || 'https://…'}
          onChange={(e) => setAdresse(e.target.value)}
          onBlur={valider}
          onKeyDown={(e) => e.key === 'Enter' && valider()}
          aria-invalid={!valide}
          spellCheck={false}
        />
      </div>
      {!valide && <p className="discret petit">Adresse en https:// (ou http:// seulement sur ce PC, pour un serveur de test).</p>}
      <div className="ligne-reglage">
        <span className="discret">Ton profil, tes amis et tes messages</span>
        <button className="bouton-verre" onClick={() => window.se7en.onglets.interne('se7en://amis')}>
          Ouvrir mes amis
        </button>
      </div>
    </section>
  )
}
