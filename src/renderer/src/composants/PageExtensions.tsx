/* Page interne se7en://extensions : extensions vérifiées, installation depuis le Chrome Web Store, import depuis un autre navigateur. */
import { useEffect, useState } from 'react'
import { EXTENSIONS_VERIFIEES, type ExtensionInstallee, type ExtensionTrouvee } from '../../../shared/extensions'
import { texteExtension, type EtatComposants } from '../../../shared/composants'
import { BoutonVerifierComposants, EtatMaj, useComposants } from './EtatComposants'

function useExtensions(): ExtensionInstallee[] {
  const [l, setL] = useState<ExtensionInstallee[]>([])
  useEffect(() => {
    void window.se7en.extensions.lister().then(setL)
    return window.se7en.extensions.surChangement(setL)
  }, [])
  return l
}

function LigneInstallee({ e, composants }: { e: ExtensionInstallee; composants: EtatComposants | null }): React.JSX.Element {
  const api = window.se7en.extensions
  const maj = texteExtension(e.version, composants?.extensions[e.id])
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const mettreAJour = async (): Promise<void> => {
    setEnCours(true)
    setErreur(null)
    const r = await window.se7en.composants.mettreAJourExtension(e.id)
    setEnCours(false)
    if ('erreur' in r) setErreur(r.erreur)
  }
  return (
    <div className={`ligne-extension${e.activee ? '' : ' desactivee'}`}>
      {e.icone ? <img className="icone-extension" src={e.icone} alt="" /> : <span className="icone-extension vide" />}
      <div className="infos-extension">
        <strong>
          {e.nom} <span className="discret petit">{e.version}</span>
        </strong>
        <span className="discret petit">{e.description}</span>
        <span className={`badge-extension${e.verifiee ? ' verifiee' : ''}`}>{e.verifiee ? '✓ Vérifiée' : 'Non vérifiée : peut ne pas marcher entièrement'}</span>
        <EtatMaj t={maj} className="petit" />
        {erreur && <span className="message-erreur petit">{erreur}</span>}
      </div>
      <div className="actions-extension">
        {maj.etat === 'mise-a-jour' && (
          <button className="bouton-principal petit" disabled={enCours} onClick={() => void mettreAJour()}>
            {enCours ? 'Mise à jour…' : 'Mettre à jour'}
          </button>
        )}
        <button
          role="switch"
          aria-checked={e.activee}
          aria-label={e.activee ? 'Désactiver' : 'Activer'}
          className={`interrupteur${e.activee ? ' actif' : ''}`}
          onClick={() => api.activer(e.id, !e.activee)}
        />
        <button className="bouton-verre petit" onClick={() => api.supprimer(e.id)}>
          Supprimer
        </button>
      </div>
    </div>
  )
}

export function PageExtensions(): React.JSX.Element {
  const installees = useExtensions()
  const composants = useComposants()
  const [lien, setLien] = useState('')
  const [enCours, setEnCours] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)
  const [trouvees, setTrouvees] = useState<ExtensionTrouvee[] | null>(null)
  const installer = async (lienOuId: string, nom?: string): Promise<void> => {
    setEnCours(lienOuId)
    setMessage(null)
    const r = await window.se7en.extensions.installer(lienOuId)
    setEnCours(null)
    setMessage('erreur' in r ? { ok: false, texte: r.erreur } : { ok: true, texte: `${r.nom} est installée. Recharge les pages ouvertes pour qu'elle y agisse.` })
    if (!('erreur' in r) && nom === undefined) setLien('')
    if (trouvees) setTrouvees(await window.se7en.extensions.trouver())
  }
  const ids = new Set(installees.map((e) => e.id))

  return (
    <div className="page-interne">
      <div className="entete-page">
        <h1>Extensions</h1>
      </div>
      <p className="discret">
        Les extensions du Chrome Web Store marchent dans les pages web. Elles n'ont jamais accès à l'interface du navigateur, au panneau IA, aux pages internes ni à l'agent
        de recherche : une extension ne peut ni lire tes conversations avec l'IA, ni la piloter. se7en Browser ne gère qu'une partie des fonctions des extensions de Chrome :
        celles de la liste vérifiée ont été testées. Les extensions agissent avec leurs réglages par défaut : leur fenêtre de réglages n'est pas encore disponible.
      </p>

      {message && <p className={message.ok ? 'message-ok' : 'message-erreur'}>{message.texte}</p>}

      <section className="bloc verre-fort">
        <h2>Extensions vérifiées</h2>
        <div className="liste-extensions">
          {EXTENSIONS_VERIFIEES.map((v) => (
            <div key={v.id} className="ligne-extension">
              <div className="infos-extension">
                <strong>{v.nom}</strong>
                <span className="discret petit">
                  {v.description} {v.note}
                </span>
              </div>
              <div className="actions-extension">
                {ids.has(v.id) ? (
                  <span className="message-ok petit">✓ Installée</span>
                ) : (
                  <button className="bouton-principal petit" disabled={!!enCours} onClick={() => void installer(v.id, v.nom)}>
                    {enCours === v.id ? 'Installation…' : 'Installer'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bloc verre-fort">
        <h2>Installer depuis le Chrome Web Store</h2>
        <form
          className="ligne-reglage"
          onSubmit={(ev) => {
            ev.preventDefault()
            if (lien.trim()) void installer(lien.trim())
          }}
        >
          <input
            className="champ"
            id="lien-extension"
            placeholder="https://chromewebstore.google.com/detail/…"
            value={lien}
            onChange={(ev) => setLien(ev.target.value)}
          />
          <button className="bouton-verre" type="submit" disabled={!lien.trim() || !!enCours}>
            {enCours === lien.trim() ? 'Installation…' : 'Installer'}
          </button>
        </form>
        <button className="lien-discret" onClick={() => window.se7en.onglets.nouveau('https://chromewebstore.google.com/')}>
          Ouvrir le Chrome Web Store
        </button>
      </section>

      <section className="bloc verre-fort">
        <h2>Importer depuis un autre navigateur</h2>
        <p className="discret petit">
          se7en Browser regarde quelles extensions sont installées dans Chrome, Edge, Brave ou Opera sur ce PC (leur nom seulement, rien d'autre), puis les réinstalle depuis
          le Chrome Web Store.
        </p>
        {trouvees === null ? (
          <button className="bouton-verre" onClick={async () => setTrouvees(await window.se7en.extensions.trouver())}>
            Chercher mes extensions
          </button>
        ) : trouvees.length === 0 ? (
          <p className="discret">Aucune extension trouvée dans les autres navigateurs.</p>
        ) : (
          <div className="liste-extensions">
            {trouvees.map((t) => (
              <div key={`${t.navigateur}-${t.id}`} className="ligne-extension">
                <div className="infos-extension">
                  <strong>{t.nom}</strong>
                  <span className="discret petit">
                    {t.navigateur}
                    {t.verifiee ? ' · ✓ vérifiée' : ''}
                  </span>
                </div>
                <div className="actions-extension">
                  {t.dejaInstallee || ids.has(t.id) ? (
                    <span className="message-ok petit">✓ Installée</span>
                  ) : (
                    <button className="bouton-verre petit" disabled={!!enCours} onClick={() => void installer(t.id, t.nom)}>
                      {enCours === t.id ? 'Installation…' : 'Importer'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {installees.length > 0 && (
        <section className="bloc verre-fort">
          <h2>Installées</h2>
          <div className="liste-extensions">
            {installees.map((e) => (
              <LigneInstallee key={e.id} e={e} composants={composants} />
            ))}
          </div>
          <BoutonVerifierComposants composants={composants} />
        </section>
      )}
    </div>
  )
}
