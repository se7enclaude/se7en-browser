/* Page interne se7en://ia : installe et prépare l'IA locale (Ollama + modèles Qwen), étape par étape. */
import { useEffect, useState } from 'react'
import { modelePresent, TAILLES_CONNUES, type EtatOllama } from '../../../shared/ia'
import { recommander, TAILLES_RECOMMANDES, verdictVitesse, type Materiel } from '../../../shared/materiel'
import type { Reglages } from '../../../shared/reglages'
import { taille } from '../useDonnees'
import { texteModele } from '../../../shared/composants'
import { BoutonVerifierComposants, EtatMaj, LigneMajOllama, useComposants } from './EtatComposants'

export function useOllama(): EtatOllama | null {
  const [etat, setEtat] = useState<EtatOllama | null>(null)
  useEffect(() => {
    window.se7en.ia.verifier().then(setEtat)
    return window.se7en.ia.surChangement(setEtat)
  }, [])
  return etat
}

function Progression({ recus, total, texte }: { recus: number; total: number; texte: string }): React.JSX.Element {
  const pourcent = total > 0 ? Math.min(100, Math.round((recus / total) * 100)) : null
  return (
    <div className="progression-ia">
      <div className="ligne-reglage">
        <span>{texte}</span>
        <span className="discret">{pourcent === null ? '' : `${taille(recus)} sur ${taille(total)} · ${pourcent} %`}</span>
      </div>
      <div className="barre-progres grande">
        <div className={pourcent === null ? 'indetermine' : ''} style={{ width: `${pourcent ?? 30}%` }} />
      </div>
    </div>
  )
}

function Etape({ numero, titre, fait, actif, children }: { numero: number; titre: string; fait: boolean; actif: boolean; children?: React.ReactNode }) {
  return (
    <section className={`bloc verre-fort etape-ia${fait ? ' faite' : ''}${actif ? ' active' : ''}`}>
      <div className="entete-etape">
        <span className="numero-etape">{fait ? '✓' : numero}</span>
        <h2>{titre}</h2>
      </div>
      {actif && children}
    </section>
  )
}

const tailleConnue = (nom: string): number | undefined => TAILLES_CONNUES[nom] ?? TAILLES_RECOMMANDES[nom]
const tailleModele = (nom: string): string => (tailleConnue(nom) ? `≈ ${taille(tailleConnue(nom)!)}` : 'taille inconnue')

/** Carte « Recommandé pour ton PC » : matériel détecté, trio de modèles conseillé, et bouton pour l'adopter. */
function Recommandation({ reglages, etat }: { reglages: Reglages; etat: EtatOllama }): React.JSX.Element | null {
  const [materiel, setMateriel] = useState<Materiel | null>(null)
  useEffect(() => {
    void window.se7en.ia.materiel().then(setMateriel)
  }, [])
  if (!materiel) return null
  const r = recommander(materiel)
  const conseilles = [r.texte, r.vision, r.rapide].filter((m): m is string => !!m)
  const dejaChoisi = reglages.modeleTexte === r.texte && reglages.modeleRapide === r.rapide && (!r.vision || reglages.modeleVision === r.vision)
  const aTelecharger = conseilles.filter((m) => !modelePresent(m, etat.modeles))
  const poids = aTelecharger.reduce((t, m) => t + (tailleConnue(m) ?? 0), 0)
  const adopter = (): void => {
    void window.se7en.reglages.modifier({ modeleTexte: r.texte, modeleRapide: r.rapide, ...(r.vision ? { modeleVision: r.vision } : {}) })
  }
  return (
    <section className="bloc verre-fort recommandation-ia">
      <div className="entete-etape">
        <span className="numero-etape">✦</span>
        <h2>Recommandé pour ton PC · {r.titre}</h2>
      </div>
      <p className="discret">
        {Math.round(materiel.ramGo)} Go de mémoire · {materiel.coeurs} cœurs
        {materiel.gpu ? ` · ${materiel.gpu}${materiel.vramGo ? ` (${Math.round(materiel.vramGo)} Go)` : ''}` : ' · pas de carte graphique dédiée'}
      </p>
      <p>{r.raison}</p>
      <div className="liste-chips">
        <span className="chip">Texte · {r.texte}</span>
        {r.vision ? <span className="chip">Vision · {r.vision}</span> : <span className="chip">Vision déconseillée</span>}
        <span className="chip">Rapide · {r.rapide}</span>
      </div>
      {dejaChoisi ? (
        <p className="discret petit">✓ Ce sont déjà tes modèles.{aTelecharger.length ? ' Il reste à les télécharger ci-dessous.' : ''}</p>
      ) : (
        <div className="actions-recommandation">
          <button className="bouton-principal" onClick={adopter}>
            Utiliser ces modèles
          </button>
          <span className="discret petit">{poids ? `${taille(poids)} à télécharger ensuite` : 'Déjà téléchargés'}</span>
        </div>
      )}
    </section>
  )
}

/** Bouton « Tester la vitesse » d'un modèle téléchargé. */
function TestVitesse({ modele }: { modele: string }): React.JSX.Element {
  const [etat, setEtat] = useState<'repos' | 'test' | number | 'erreur'>('repos')
  const lancer = async (): Promise<void> => {
    setEtat('test')
    const v = await window.se7en.ia.vitesse(modele)
    setEtat(v === null ? 'erreur' : v)
  }
  if (typeof etat === 'number') {
    const v = verdictVitesse(etat)
    return <span className={`vitesse-modele ${v.niveau}`}>{v.texte}</span>
  }
  return (
    <button className="lien-discret" disabled={etat === 'test'} onClick={lancer}>
      {etat === 'test' ? 'Test en cours (10 s environ)…' : etat === 'erreur' ? 'Test impossible, réessayer' : 'Tester la vitesse'}
    </button>
  )
}

export function PageIA({ reglages }: { reglages: Reglages }): React.JSX.Element {
  const etat = useOllama()
  const composants = useComposants()
  const ia = window.se7en.ia
  if (!etat) return <div className="page-interne" />

  const t = etat.tache
  const installe = etat.phase === 'arrete' || etat.phase === 'pret'
  const pret = etat.phase === 'pret'
  const modeles = [
    { nom: reglages.modeleTexte, role: 'Texte', detail: 'Chat, résumés, questions sur la page', obligatoire: true },
    { nom: reglages.modeleVision, role: 'Vision', detail: 'Comprendre les images et les pages peu lisibles', obligatoire: false },
    { nom: reglages.modeleRapide, role: 'Rapide', detail: 'Petit modèle pour les tâches éclair (rangement, résumés envoyés, anti-phishing)', obligatoire: false }
  ]
  const manquants = modeles.filter((m) => !modelePresent(m.nom, etat.modeles))
  const toutPret = pret && modelePresent(reglages.modeleTexte, etat.modeles)

  return (
    <div className="page-interne">
      <div className="entete-page">
        <h1>IA locale</h1>
        <button
          className="bouton-verre"
          disabled={!!t}
          onClick={() => {
            void ia.verifier()
            void window.se7en.composants.verifier()
          }}
        >
          Vérifier à nouveau
        </button>
      </div>
      <p className="discret">
        L'IA de se7en Browser tourne entièrement sur ton PC grâce à Ollama : tes pages, tes PDF et tes questions ne partent jamais sur Internet.
      </p>

      {etat.erreur && <div className="message-erreur">{etat.erreur}</div>}

      <Recommandation reglages={reglages} etat={etat} />

      <Etape numero={1} titre="Installer Ollama" fait={installe} actif={!installe}>
        {etat.phase === 'verification' && <p className="discret">Recherche d'Ollama…</p>}
        {t?.type === 'installeur' && (
          <>
            <Progression recus={t.recus} total={t.total} texte="Téléchargement d'Ollama" />
            <button className="bouton-verre" onClick={() => ia.annuler()}>
              Annuler
            </button>
          </>
        )}
        {t?.type === 'installation' && <Progression recus={0} total={0} texte="Installation d'Ollama (vérification de la signature, puis installation)…" />}
        {etat.phase === 'absent' && !t && (
          <>
            <p className="discret">
              Ollama est le moteur qui fait tourner l'IA. Il est gratuit. se7en Browser télécharge l'installeur officiel depuis ollama.com, vérifie qu'il est bien signé par
              Ollama, puis l'installe pour toi.
            </p>
            <button className="bouton-principal" onClick={() => ia.installer()}>
              Installer Ollama (≈ 1,7 Go)
            </button>
          </>
        )}
      </Etape>

      <Etape numero={2} titre="Activer l'IA" fait={pret} actif={etat.phase === 'arrete' || t?.type === 'demarrage'}>
        {t?.type === 'demarrage' ? (
          <Progression recus={0} total={0} texte="Activation de l'IA…" />
        ) : (
          <>
            <p className="discret">Ollama est installé mais pas activé. Il ne démarre jamais avec Windows : seulement quand tu l'actives ici, et il s'arrête quand tu fermes le navigateur.</p>
            <button className="bouton-principal" onClick={() => ia.demarrer()}>
              Activer l'IA
            </button>
          </>
        )}
      </Etape>

      <Etape numero={3} titre="Télécharger les modèles Qwen" fait={toutPret && manquants.length === 0} actif={pret}>
        <div className="liste-modeles">
          {modeles.map((m) => {
            const present = modelePresent(m.nom, etat.modeles)
            const enCours = t?.type === 'modele' && t.nom === m.nom
            return (
              <div key={m.role} className="ligne-modele">
                <span className={`pastille-etat${present ? ' ok' : ''}`}>{present ? '✓' : ''}</span>
                <div className="infos-modele">
                  <strong>
                    {m.role} · <code>{m.nom}</code>
                    {!m.obligatoire && <span className="discret"> (facultatif)</span>}
                  </strong>
                  <span className="discret">
                    {m.detail} · {tailleModele(m.nom)}
                  </span>
                  {enCours && <Progression recus={t.recus} total={t.total} texte="Téléchargement" />}
                  {present && <EtatMaj t={texteModele(composants?.modeles[m.nom])} className="petit" />}
                  {present && pret && !t && <TestVitesse modele={m.nom} />}
                </div>
                {present && pret && !t && composants?.modeles[m.nom]?.etat === 'mise-a-jour' && (
                  <button className="bouton-principal petit" title="Ollama ne récupère que les morceaux qui ont changé" onClick={() => window.se7en.composants.mettreAJourModele(m.nom)}>
                    Mettre à jour
                  </button>
                )}
                {!present && !t && (
                  <button className="bouton-verre" onClick={() => ia.telecharger([m.nom])}>
                    Télécharger
                  </button>
                )}
              </div>
            )
          })}
        </div>
        {t?.type === 'modele' ? (
          <button className="bouton-verre" onClick={() => ia.annuler()}>
            Annuler
          </button>
        ) : (
          manquants.length > 1 && (
            <button className="bouton-principal" onClick={() => ia.telecharger(manquants.map((m) => m.nom))}>
              Tout télécharger
            </button>
          )
        )}
        <p className="discret petit">Les noms des modèles se changent dans les Paramètres. Un téléchargement interrompu reprend là où il s'était arrêté.</p>
      </Etape>

      {installe && (
        <section className="bloc verre-fort">
          <h2>Mises à jour</h2>
          <LigneMajOllama ia={etat} composants={composants} />
          <p className="discret petit">
            Vérifiées au plus toutes les 12 heures : la version d'Ollama est comparée à sa dernière version publiée, et chaque modèle à celui du registre d'Ollama. Rien
            n'est retéléchargé quand c'est à jour.
          </p>
          <BoutonVerifierComposants composants={composants} />
        </section>
      )}

      {toutPret && (
        <section className="bloc verre-fort tout-pret">
          <h2>✓ L'IA locale est prête</h2>
          <p className="discret">Ollama {etat.version} tourne sur ton PC. Ouvre le panneau IA avec Ctrl+Espace, ou pose une question dans la barre d'adresse.</p>
          {etat.lanceParNavigateur && (
            <button className="bouton-verre" onClick={() => ia.arreter()}>
              Désactiver l'IA
            </button>
          )}
        </section>
      )}
    </div>
  )
}
