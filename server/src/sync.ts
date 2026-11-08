/* Synchronisation chiffrée de bout en bout entre les PC d'un même utilisateur.
 * Le serveur garde un seul paquet chiffré par espace ; il ne connaît ni la clé (restée sur les PC),
 * ni le contenu, ni le profil social. Écrire demande un jeton dérivé de la clé ; deux écritures
 * concurrentes sont départagées par le numéro de version (la seconde reçoit 409 et fusionne). */

const RE_ID = /^[A-Za-z0-9_-]{43}$/
const MAX_PAQUET = 1_500_000

const json = (donnees: unknown, statut = 200): Response => new Response(JSON.stringify(donnees), { status: statut, headers: { 'content-type': 'application/json' } })

async function empreinte(texte: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte))
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function egal(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

interface Ligne {
  auth: string
  donnees: string
  version: number
  maj: number
}

export async function routeSync(req: Request, env: { DB: D1Database }, url: URL): Promise<Response | null> {
  const m = /^\/sync\/([^/]+)$/.exec(url.pathname)
  if (!m) return null
  const id = m[1]
  const jeton = req.headers.get('X-Sync-Auth') ?? ''
  if (!RE_ID.test(id) || !RE_ID.test(jeton)) return json({ erreur: 'Requête invalide.' }, 400)
  const auth = await empreinte(jeton)
  const ligne = await env.DB.prepare('SELECT auth, donnees, version, maj FROM sync WHERE id = ?').bind(id).first<Ligne>()
  if (ligne && !egal(ligne.auth, auth)) return json({ erreur: 'Jeton refusé.' }, 403)

  if (req.method === 'GET') return ligne ? json({ version: ligne.version, donnees: ligne.donnees, maj: ligne.maj }) : json({ version: 0, donnees: null, maj: 0 })
  if (req.method === 'DELETE') {
    if (ligne) await env.DB.prepare('DELETE FROM sync WHERE id = ?').bind(id).run()
    return json({ ok: true })
  }
  if (req.method === 'PUT') {
    const brut = await req.text()
    if (brut.length > MAX_PAQUET) return json({ erreur: 'Paquet trop gros.' }, 413)
    let d: { version?: unknown; donnees?: unknown }
    try {
      d = JSON.parse(brut)
    } catch {
      return json({ erreur: 'JSON invalide.' }, 400)
    }
    if (typeof d.version !== 'number' || typeof d.donnees !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(d.donnees)) return json({ erreur: 'Paquet invalide.' }, 400)
    const actuelle = ligne?.version ?? 0
    if (d.version !== actuelle) return json({ erreur: 'Version dépassée.', version: actuelle, donnees: ligne?.donnees ?? null }, 409)
    const maj = Date.now()
    if (ligne) {
      const r = await env.DB.prepare('UPDATE sync SET donnees = ?, version = version + 1, maj = ? WHERE id = ? AND version = ?').bind(d.donnees, maj, id, actuelle).run()
      if (!r.meta.changes) return json({ erreur: 'Version dépassée.' }, 409)
    } else {
      await env.DB.prepare('INSERT INTO sync (id, auth, donnees, version, maj) VALUES (?, ?, ?, 1, ?)').bind(id, auth, d.donnees, maj).run()
    }
    return json({ version: actuelle + 1, maj })
  }
  return json({ erreur: 'Méthode non permise.' }, 405)
}
