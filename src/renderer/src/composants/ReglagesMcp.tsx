/* Paramètres › Agents IA extérieurs : le serveur MCP local, pour qu'un agent de ton PC (Claude Desktop, Claude Code…)
 * puisse utiliser se7en Browser. Désactivé par défaut. */
import { useEffect, useState } from 'react'
import { configClient } from '../../../shared/mcp'
import type { Reglages } from '../../../shared/reglages'

function Interrupteur({ actif, changer, label }: { actif: boolean; changer: (v: boolean) => void; label: string }): React.JSX.Element {
  return <button role="switch" aria-checked={actif} aria-label={label} className={`interrupteur${actif ? ' actif' : ''}`} onClick={() => changer(!actif)} />
}

export function ReglagesMcp({ reglages, modifier }: { reglages: Reglages; modifier: (p: Partial<Reglages>) => void }): React.JSX.Element {
  const [jeton, setJeton] = useState('')
  const [copie, setCopie] = useState(false)
  useEffect(() => {
    if (reglages.mcpActif) void window.se7en.mcp.jeton().then(setJeton)
  }, [reglages.mcpActif])
  const config = jeton ? configClient(reglages.mcpPort, jeton) : ''
  return (
    <section className="bloc verre-fort">
      <h2>Agents IA extérieurs (MCP)</h2>
      <p className="discret">
        Permet à un agent IA de ton PC (Claude Desktop, Claude Code ou tout client MCP) d'utiliser se7en Browser : lire tes onglets, et si tu le permets, ouvrir des pages et
        utiliser les outils que les sites proposent aux agents (WebMCP). Le serveur n'écoute que sur ce PC, avec un jeton secret ; chaque nouvel agent doit être autorisé, et
        chaque action d'un site aussi. Les onglets privés et les pages avec un mot de passe ne sont jamais partagés.
      </p>
      <div className="ligne-reglage">
        <span>Activer le serveur MCP local</span>
        <Interrupteur actif={reglages.mcpActif} changer={(v) => modifier({ mcpActif: v })} label="Serveur MCP local" />
      </div>
      {reglages.mcpActif && (
        <>
          <div className="ligne-reglage">
            <span>
              Autoriser aussi la navigation
              <span className="discret petit"> (ouvrir des pages, utiliser les outils des sites avec ta confirmation)</span>
            </span>
            <Interrupteur actif={reglages.mcpNavigation} changer={(v) => modifier({ mcpNavigation: v })} label="Navigation par les agents" />
          </div>
          <p className="discret petit">À coller dans la configuration de ton client MCP (pour Claude Desktop : claude_desktop_config.json) :</p>
          <pre className="config-mcp">{config}</pre>
          <div className="ligne-reglage">
            <button
              className="bouton-verre"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(config)
                  setCopie(true)
                  setTimeout(() => setCopie(false), 2000)
                } catch {
                  setCopie(false)
                }
              }}
            >
              {copie ? 'Copié ✓' : 'Copier la configuration'}
            </button>
            <button className="bouton-verre" onClick={async () => setJeton(await window.se7en.mcp.nouveauJeton())}>
              Changer le jeton
            </button>
          </div>
        </>
      )}
    </section>
  )
}
