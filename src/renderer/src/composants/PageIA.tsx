/* Page interne se7en://ia : installe et prépare l'IA locale (Ollama + modèles Qwen), étape par étape. */
import { useEffect, useState } from 'react'
import { modelePresent, TAILLES_CONNUES, type EtatOllama } from '../../../shared/ia'
import type { Reglages } from '../../../shared/reglages'
import { taille } from '../useDonnees'

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

const tailleModele = (nom: string): string => (TAILLES_CONNUES[nom] ? `≈ ${taille(TAILLES_CONNUES[nom])}` : 'taille inconnue')

export function PageIA({ reglages }: { reglages: Reglages }): React.JSX.Element {
  const etat = useOllama()
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
        <button className="bouton-verre" disabled={!!t} onClick={() => ia.verifier()}>
          Vérifier à nouveau
        </button>
      </div>
      <p className="discret">
        L'IA de se7en Browser tourne entièrement sur ton PC grâce à Ollama : tes pages, tes PDF et tes questions ne partent jamais sur Internet.
      </p>

      {etat.erreur && <div className="message-erreur">{etat.erreur}</div>}

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
                </div>
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
