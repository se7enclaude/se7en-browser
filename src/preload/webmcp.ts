/* Pages web : prise en charge de WebMCP (proposition de standard, essai dans Chrome 149). Un site peut déclarer des
 * « outils » pour les agents IA avec navigator.modelContext. On ne fait que les ranger dans la page : rien n'est
 * exécuté sans que le navigateur le demande, et le navigateur ne le demande qu'après ton accord, outil par outil.
 * Aucun pont vers le navigateur n'est exposé à la page. */
import { contextBridge } from 'electron'

contextBridge.executeInMainWorld({
  func: () => {
    const nav = navigator as Navigator & { modelContext?: unknown }
    if (nav.modelContext) return
    type Outil = { name: string; description?: string; inputSchema?: unknown; execute: (entree: unknown, client?: unknown) => unknown }
    const outils = new Map<string, Outil>()
    const valide = (o: unknown): o is Outil =>
      !!o && typeof (o as Outil).name === 'string' && /^[\w.-]{1,64}$/.test((o as Outil).name) && typeof (o as Outil).execute === 'function'
    const modelContext = {
      provideContext(ctx: { tools?: unknown[] }) {
        outils.clear()
        for (const o of ctx?.tools ?? []) if (valide(o)) outils.set(o.name, o)
      },
      registerTool(o: unknown) {
        if (!valide(o)) throw new TypeError('Outil invalide')
        outils.set(o.name, o)
        return { unregister: () => outils.delete(o.name) }
      },
      unregisterTool(nom: string) {
        outils.delete(nom)
      },
      clearContext() {
        outils.clear()
      }
    }
    Object.defineProperty(nav, 'modelContext', { value: Object.freeze(modelContext), configurable: false })
    // lu par le navigateur seulement (executeJavaScript), jamais appelé par lui-même
    Object.defineProperty(globalThis, '__se7enWebMcp', {
      value: Object.freeze({
        lister: () =>
          [...outils.values()].map((o) => ({
            nom: o.name,
            description: String(o.description ?? '').slice(0, 500),
            schema: JSON.parse(JSON.stringify(o.inputSchema ?? { type: 'object' }))
          })),
        appeler: async (nom: string, entree: unknown) => {
          const o = outils.get(nom)
          if (!o) throw new Error('Outil inconnu')
          const r = await o.execute(entree, { requestUserInteraction: async (f: () => unknown) => f() })
          return JSON.parse(JSON.stringify(r ?? null))
        }
      }),
      configurable: false
    })
  }
})
