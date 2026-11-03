/* Paramètres › Sauvegarde : réglages, coffre, favoris et Skills dans un fichier chiffré par un mot de passe. */
import { useState } from 'react'

export function SauvegardeChiffree(): React.JSX.Element {
  const [mode, setMode] = useState<'exporter' | 'importer' | null>(null)
  const [mdp, setMdp] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [info, setInfo] = useState<{ texte: string; erreur: boolean } | null>(null)
  const [occupe, setOccupe] = useState(false)

  const valide = mode === 'importer' ? mdp.length > 0 : mdp.length >= 8 && mdp === confirmation
  const lancer = async (): Promise<void> => {
    setOccupe(true)
    setInfo(null)
    const r = mode === 'exporter' ? await window.se7en.sauvegarde.exporter(mdp) : await window.se7en.sauvegarde.importer(mdp)
    setOccupe(false)
    if (!r) return
    if ('erreur' in r) return setInfo({ texte: r.erreur, erreur: true })
    setInfo({
      texte: 'fichier' in r ? 'Sauvegarde enregistrée. Garde bien le mot de passe : sans lui, le fichier est illisible.' : `Sauvegarde restaurée (${r.favoris} favori${r.favoris > 1 ? 's' : ''} ajouté${r.favoris > 1 ? 's' : ''}).`,
      erreur: false
    })
    setMode(null)
    setMdp('')
    setConfirmation('')
  }

  return (
    <section className="bloc verre-fort">
      <h2>Sauvegarde</h2>
      <p className="discret petit">
        Tes réglages, ton coffre, tes favoris et tes Skills dans un seul fichier chiffré par un mot de passe. Pour les garder en lieu sûr ou les retrouver
        sur un autre PC. L’historique et le profil social n’y sont pas (le profil a son propre code de secours, page Amis).
      </p>
      {!mode && (
        <div className="actions-profil">
          <button className="bouton-verre" onClick={() => setMode('exporter')}>
            Créer une sauvegarde…
          </button>
          <button className="bouton-verre" onClick={() => setMode('importer')}>
            Restaurer une sauvegarde…
          </button>
        </div>
      )}
      {mode && (
        <form
          className="formulaire-sauvegarde"
          onSubmit={(e) => {
            e.preventDefault()
            if (valide && !occupe) void lancer()
          }}
        >
          <input
            className="champ"
            type="password"
            autoFocus
            value={mdp}
            onChange={(e) => setMdp(e.target.value)}
            placeholder={mode === 'exporter' ? 'Mot de passe de la sauvegarde (8 caractères au moins)' : 'Mot de passe de la sauvegarde'}
            autoComplete="new-password"
          />
          {mode === 'exporter' && (
            <input
              className="champ"
              type="password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="Le même mot de passe, encore une fois"
              autoComplete="new-password"
            />
          )}
          {mode === 'importer' && <p className="discret petit">Tes réglages et ton coffre actuels seront remplacés par ceux de la sauvegarde ; les favoris s’ajoutent aux tiens.</p>}
          <div className="actions-profil">
            <button className="bouton-principal petit" disabled={!valide || occupe}>
              {occupe ? 'Un instant…' : mode === 'exporter' ? 'Choisir où l’enregistrer' : 'Choisir le fichier'}
            </button>
            <button
              type="button"
              className="bouton-verre"
              onClick={() => {
                setMode(null)
                setMdp('')
                setConfirmation('')
              }}
            >
              Annuler
            </button>
          </div>
          {mode === 'exporter' && mdp.length >= 8 && confirmation && mdp !== confirmation && <p className="message-erreur">Les deux mots de passe ne sont pas identiques.</p>}
        </form>
      )}
      {info && <p className={info.erreur ? 'message-erreur' : 'message-ok'}>{info.texte}</p>}
    </section>
  )
}
