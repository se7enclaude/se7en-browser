/* se7en social : profils, amis, messages et liens entre utilisateurs de se7en Browser.
 * Toutes les routes /api/* demandent une requête signée (voir auth.ts) ; aucun mot de passe n'est stocké.
 * Ce serveur ne voit que : le pseudo, la photo, la liste d'amis, les groupes et les messages (et images) échangés. */
import { routeSync } from './sync'
import { Boite } from './boite'
import { FENETRE, verifier, type Signature } from './auth'

export { Boite }

export interface Env {
  DB: D1Database
  BOITES: DurableObjectNamespace<Boite>
}

interface Utilisateur {
  id: string
  cle: string
  pseudo: string
  code: string
  photo: string | null
  statut?: string | null
}

const RE_PSEUDO = /^[\p{L}\p{N}_ .-]{2,24}$/u
const MAX_MESSAGE = 2000
const MAX_PHOTO = 256 * 1024
const MAX_IMAGE = 1536 * 1024
const MAX_MEMBRES = 20
const RE_NOM_GROUPE = /^[^\u0000-\u001f]{1,40}$/u
const MESSAGES_PAR_MINUTE = 30
const TYPES_PHOTO = ['image/jpeg', 'image/png', 'image/webp']
const COLONNES_MESSAGE = 'id, de, a, groupe, type, texte, url, titre, image, vocal, date, lu'
const TYPES_SON = ['audio/webm', 'audio/ogg']
const MAX_SON = 1024 * 1024
const TYPES_STATUT = ['dispo', 'occupe', 'jeu', 'absent']

const json = (donnees: unknown, statut = 200): Response =>
  new Response(JSON.stringify(donnees), { status: statut, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })
const erreur = (message: string, statut = 400): Response => json({ erreur: message }, statut)

const paire = (x: string, y: string): [string, string] => (x < y ? [x, y] : [y, x])
const boite = (env: Env, id: string) => env.BOITES.get(env.BOITES.idFromName(id))

function lireStatut(brut: string | null | undefined): { type: string; texte: string } | null {
  try {
    const o = JSON.parse(brut ?? 'null') as { type?: unknown; texte?: unknown } | null
    return o && typeof o.type === 'string' && TYPES_STATUT.includes(o.type) ? { type: o.type, texte: typeof o.texte === 'string' ? o.texte.slice(0, 60) : '' } : null
  } catch {
    return null
  }
}

function profilPublic(u: Utilisateur): { id: string; pseudo: string; code: string; photo: boolean; humeur: { type: string; texte: string } | null } {
  return { id: u.id, pseudo: u.pseudo, code: u.code, photo: !!u.photo, humeur: lireStatut(u.statut) }
}

/** Lit la signature (en-têtes, ou paramètres d'adresse pour le direct), la vérifie et retrouve l'utilisateur. */
async function authentifier(req: Request, env: Env, url: URL, corps: ArrayBuffer): Promise<{ cle: string; moi: Utilisateur | null } | Response> {
  const lire = (nom: string): string => req.headers.get(`X-Se7en-${nom}`) ?? url.searchParams.get(nom.toLowerCase()) ?? ''
  const s: Signature = { cle: lire('Cle'), heure: lire('Heure'), nonce: lire('Nonce'), signature: lire('Signature') }
  if (Math.abs(Date.now() - Number(s.heure)) > FENETRE) return erreur('Heure de la requête invalide (vérifie l’horloge du PC).', 401)
  if (!(await verifier(s, req.method, url.pathname, corps))) return erreur('Signature invalide.', 401)
  // un nonce ne sert qu'une fois : une requête interceptée ne peut pas être rejouée
  const deja = await env.DB.prepare('INSERT OR IGNORE INTO nonces (nonce, expire) VALUES (?, ?)').bind(s.nonce, Date.now() + FENETRE * 2).run()
  if (!deja.meta.changes) return erreur('Requête déjà utilisée.', 401)
  const moi = await env.DB.prepare('SELECT id, cle, pseudo, code, photo, statut FROM utilisateurs WHERE cle = ?').bind(s.cle).first<Utilisateur>()
  return { cle: s.cle, moi }
}

async function amis(env: Env, moi: string): Promise<{ id: string; statut: string; demandeur: string }[]> {
  const r = await env.DB.prepare(
    "SELECT CASE WHEN a = ?1 THEN b ELSE a END AS id, statut, demandeur FROM amities WHERE a = ?1 OR b = ?1"
  )
    .bind(moi)
    .all<{ id: string; statut: string; demandeur: string }>()
  return r.results
}

async function sontAmis(env: Env, x: string, y: string): Promise<boolean> {
  const [a, b] = paire(x, y)
  return !!(await env.DB.prepare("SELECT 1 FROM amities WHERE a = ? AND b = ? AND statut = 'acceptee'").bind(a, b).first())
}

/** Membres d'un groupe (vide si le groupe n'existe pas). */
async function membresDe(env: Env, groupe: string): Promise<string[]> {
  return (await env.DB.prepare('SELECT id FROM membres WHERE groupe = ?').bind(groupe).all<{ id: string }>()).results.map((x) => x.id)
}

async function profils(env: Env, ids: string[]): Promise<Utilisateur[]> {
  if (!ids.length) return []
  return (await env.DB.prepare(`SELECT id, cle, pseudo, code, photo, statut FROM utilisateurs WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<Utilisateur>())
    .results
}

/** Les deux utilisateurs sont dans un même groupe. */
async function groupeCommun(env: Env, x: string, y: string): Promise<boolean> {
  return !!(await env.DB.prepare('SELECT 1 FROM membres m1 JOIN membres m2 ON m1.groupe = m2.groupe WHERE m1.id = ? AND m2.id = ? LIMIT 1').bind(x, y).first())
}

/** Supprime un groupe vide : ses messages et ses images avec. */
async function supprimerGroupeSiVide(env: Env, groupe: string): Promise<void> {
  if ((await membresDe(env, groupe)).length) return
  await env.DB.batch([
    env.DB.prepare('DELETE FROM messages WHERE groupe = ?').bind(groupe),
    env.DB.prepare('DELETE FROM images WHERE groupe = ?').bind(groupe),
    env.DB.prepare('DELETE FROM groupes WHERE id = ?').bind(groupe)
  ])
}

/** Limite d'envoi : messages et images confondus. */
async function tropDeMessages(env: Env, moi: string): Promise<boolean> {
  const recents = await env.DB.prepare('SELECT COUNT(*) AS n FROM messages WHERE de = ? AND date > ?').bind(moi, Date.now() - 60_000).first<{ n: number }>()
  return (recents?.n ?? 0) >= MESSAGES_PAR_MINUTE
}

/** Contenu d'un message texte ou lien, vérifié ; une Response en cas d'erreur. */
function contenuMessage(d: Record<string, unknown>): { texte: string; url: string | null; titre: string | null } | Response {
  const texte = String(d.texte ?? '').trim().slice(0, MAX_MESSAGE)
  let lien: string | null = null
  if (d.url !== undefined) {
    try {
      const u = new URL(String(d.url))
      if (u.protocol === 'http:' || u.protocol === 'https:') lien = u.href.slice(0, 2000)
    } catch {
      /* adresse invalide */
    }
    if (!lien) return erreur('Lien invalide.')
  }
  if (!texte && !lien) return erreur('Message vide.')
  return { texte, url: lien, titre: lien ? String(d.titre ?? '').slice(0, 200) : null }
}

/** Image envoyée (corps brut) : vérifiée puis rangée ; renvoie son identifiant ou une Response d'erreur. */
async function rangerImage(env: Env, req: Request, corps: ArrayBuffer, de: string, cible: { a?: string; groupe?: string }, son = false): Promise<string | Response> {
  const type = (req.headers.get('Content-Type') ?? '').split(';')[0]
  if (son) {
    if (!TYPES_SON.includes(type) || corps.byteLength > MAX_SON || corps.byteLength < 100) return erreur('Message vocal invalide (1 Mo au plus).')
  } else if (!TYPES_PHOTO.includes(type) || corps.byteLength > MAX_IMAGE || corps.byteLength < 100) return erreur('Image invalide (JPEG, PNG ou WebP, 1,5 Mo au plus).')
  const id = crypto.randomUUID()
  await env.DB.prepare('INSERT INTO images (id, de, a, groupe, type, donnees, date) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, de, cible.a ?? null, cible.groupe ?? null, type, corps, Date.now())
    .run()
  return id
}

/** Enregistre un message (entre amis ou dans un groupe) et le pousse aux destinataires. */
async function publierMessage(
  env: Env,
  moi: Utilisateur,
  cible: { a?: string; groupe?: string },
  contenu: { texte: string; url: string | null; titre: string | null; image?: string | null; vocal?: string | null }
): Promise<Response> {
  const message = {
    id: crypto.randomUUID(),
    de: moi.id,
    a: cible.a ?? '',
    groupe: cible.groupe ?? null,
    type: contenu.url ? 'lien' : 'texte',
    texte: contenu.texte,
    url: contenu.url,
    titre: contenu.titre,
    image: contenu.image ?? null,
    vocal: contenu.vocal ?? null,
    date: Date.now(),
    lu: 0
  }
  await env.DB.prepare(`INSERT INTO messages (${COLONNES_MESSAGE}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`)
    .bind(message.id, message.de, message.a, message.groupe, message.type, message.texte, message.url, message.titre, message.image, message.vocal, message.date)
    .run()
  const destinataires = cible.groupe ? (await membresDe(env, cible.groupe)).filter((x) => x !== moi.id) : [cible.a!]
  await Promise.allSettled(destinataires.map((id) => boite(env, id).pousser({ type: 'message', message, pseudo: moi.pseudo })))
  return json({ message }, 201)
}

async function nouveauCode(env: Env, pseudo: string): Promise<string | null> {
  for (let i = 0; i < 20; i++) {
    const code = String(crypto.getRandomValues(new Uint16Array(1))[0] % 10000).padStart(4, '0')
    const pris = await env.DB.prepare('SELECT 1 FROM utilisateurs WHERE pseudo = ? COLLATE NOCASE AND code = ?').bind(pseudo, code).first()
    if (!pris) return code
  }
  return null
}

async function routeur(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url)
  // synchronisation chiffrée : sa propre protection (jeton dérivé de la clé), sans profil social
  const sync = await routeSync(req, env, url)
  if (sync) return sync
  if (!url.pathname.startsWith('/api/')) return erreur('introuvable', 404)
  const corps = req.method === 'GET' || req.method === 'HEAD' ? new ArrayBuffer(0) : await req.arrayBuffer()
  if (corps.byteLength > MAX_IMAGE + 1024) return erreur('Requête trop grande.', 413)
  const auth = await authentifier(req, env, url, corps)
  if (auth instanceof Response) return auth
  const { cle, moi } = auth
  const chemin = url.pathname.split('/').filter(Boolean).slice(1) // sans « api »
  const lireJson = (): Record<string, unknown> => {
    try {
      return JSON.parse(new TextDecoder().decode(corps)) as Record<string, unknown>
    } catch {
      return {}
    }
  }

  // ---------- profil ----------
  if (chemin[0] === 'profil') {
    if (req.method === 'GET') return moi ? json(profilPublic(moi)) : erreur('Pas encore de profil.', 404)
    if (req.method === 'POST') {
      const pseudo = String(lireJson().pseudo ?? '').trim()
      if (!RE_PSEUDO.test(pseudo)) return erreur('Pseudo invalide : 2 à 24 lettres, chiffres, espaces, « . », « - » ou « _ ».')
      if (moi && moi.pseudo === pseudo) return json(profilPublic(moi))
      const code = await nouveauCode(env, pseudo)
      if (!code) return erreur('Ce pseudo est très demandé : essaie une variante.', 409)
      if (moi) {
        await env.DB.prepare('UPDATE utilisateurs SET pseudo = ?, code = ? WHERE id = ?').bind(pseudo, code, moi.id).run()
        return json(profilPublic({ ...moi, pseudo, code }))
      }
      const id = crypto.randomUUID()
      await env.DB.prepare('INSERT INTO utilisateurs (id, cle, pseudo, code, photo, cree) VALUES (?, ?, ?, ?, NULL, ?)').bind(id, cle, pseudo, code, Date.now()).run()
      return json(profilPublic({ id, cle, pseudo, code, photo: null }), 201)
    }
    if (req.method === 'DELETE' && moi) {
      // suppression complète du compte : profil, photo, amitiés, messages
      const sesGroupes = (await env.DB.prepare('SELECT groupe FROM membres WHERE id = ?').bind(moi.id).all<{ groupe: string }>()).results.map((x) => x.groupe)
      await env.DB.batch([
        env.DB.prepare('DELETE FROM messages WHERE de = ?1 OR a = ?1').bind(moi.id),
        env.DB.prepare('DELETE FROM images WHERE de = ?1 OR a = ?1').bind(moi.id),
        env.DB.prepare('DELETE FROM membres WHERE id = ?').bind(moi.id),
        env.DB.prepare('DELETE FROM amities WHERE a = ?1 OR b = ?1').bind(moi.id),
        env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(moi.id),
        env.DB.prepare('DELETE FROM utilisateurs WHERE id = ?').bind(moi.id)
      ])
      for (const g of sesGroupes) {
        await supprimerGroupeSiVide(env, g)
        await Promise.allSettled((await membresDe(env, g)).map((id) => boite(env, id).pousser({ type: 'groupes' })))
      }
      return json({ ok: true })
    }
  }

  if (!moi) return erreur('Crée d’abord ton profil.', 403)

  // ---------- photo ----------
  if (chemin[0] === 'photo') {
    if (req.method === 'PUT' && !chemin[1]) {
      const type = (req.headers.get('Content-Type') ?? '').split(';')[0]
      if (!TYPES_PHOTO.includes(type) || corps.byteLength > MAX_PHOTO || corps.byteLength < 100) return erreur('Photo invalide (JPEG, PNG ou WebP, 256 Ko au plus).')
      await env.DB.batch([
        env.DB.prepare('INSERT OR REPLACE INTO photos (id, type, donnees) VALUES (?, ?, ?)').bind(moi.id, type, corps),
        env.DB.prepare('UPDATE utilisateurs SET photo = ? WHERE id = ?').bind(type, moi.id)
      ])
      return json({ ok: true })
    }
    if (req.method === 'GET' && chemin[1]) {
      // sa propre photo, ou celle d'un ami (ou de quelqu'un qui nous a envoyé une demande)
      const cible = chemin[1]
      const lien = cible === moi.id || (await amis(env, moi.id)).some((x) => x.id === cible) || (await groupeCommun(env, moi.id, cible))
      if (!lien) return erreur('introuvable', 404)
      const ph = await env.DB.prepare('SELECT type, donnees FROM photos WHERE id = ?').bind(cible).first<{ type: string; donnees: ArrayBuffer | number[] }>()
      if (!ph) return erreur('introuvable', 404)
      const octets = ph.donnees instanceof ArrayBuffer ? new Uint8Array(ph.donnees) : Uint8Array.from(ph.donnees)
      return new Response(octets, { headers: { 'Content-Type': ph.type, 'Cache-Control': 'private, max-age=300' } })
    }
  }

  // ---------- amis ----------
  if (chemin[0] === 'amis') {
    if (req.method === 'GET' && !chemin[1]) {
      const liste = await amis(env, moi.id)
      const ids = liste.map((x) => x.id)
      const profils = ids.length
        ? (await env.DB.prepare(`SELECT id, cle, pseudo, code, photo, statut FROM utilisateurs WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<Utilisateur>()).results
        : []
      const nonLus = (
        await env.DB.prepare('SELECT de, COUNT(*) AS n FROM messages WHERE a = ? AND lu = 0 GROUP BY de').bind(moi.id).all<{ de: string; n: number }>()
      ).results
      const enLigne = await Promise.all(
        liste.map(async (x) => (x.statut === 'acceptee' ? await boite(env, x.id).enLigne().catch(() => false) : false))
      )
      return json({
        amis: liste.map((x, i) => ({
          ...profilPublic(profils.find((p) => p.id === x.id) ?? { id: x.id, cle: '', pseudo: '?', code: '0000', photo: null }),
          statut: x.statut === 'acceptee' ? 'ami' : x.demandeur === moi.id ? 'envoyee' : 'recue',
          enLigne: enLigne[i],
          nonLus: nonLus.find((n) => n.de === x.id)?.n ?? 0
        }))
      })
    }
    if (req.method === 'POST' && !chemin[1]) {
      // demande d'ami par « pseudo#1234 »
      const m = /^(.{2,24})#(\d{4})$/u.exec(String(lireJson().code ?? '').trim())
      if (!m) return erreur('Code invalide : il ressemble à « Claire#4821 ».')
      const cible = await env.DB.prepare('SELECT id, cle, pseudo, code, photo, statut FROM utilisateurs WHERE pseudo = ? COLLATE NOCASE AND code = ?')
        .bind(m[1].trim(), m[2])
        .first<Utilisateur>()
      if (!cible) return erreur('Personne avec ce code.', 404)
      if (cible.id === moi.id) return erreur('C’est ton propre code.')
      const [a, b] = paire(moi.id, cible.id)
      const existe = await env.DB.prepare('SELECT statut, demandeur FROM amities WHERE a = ? AND b = ?').bind(a, b).first<{ statut: string; demandeur: string }>()
      if (existe?.statut === 'acceptee') return json({ statut: 'ami' })
      if (existe && existe.demandeur !== moi.id) {
        // l'autre nous avait déjà demandé : c'est accepté des deux côtés
        await env.DB.prepare("UPDATE amities SET statut = 'acceptee', date = ? WHERE a = ? AND b = ?").bind(Date.now(), a, b).run()
        await boite(env, cible.id).pousser({ type: 'amis' })
        return json({ statut: 'ami' })
      }
      if (!existe) await env.DB.prepare("INSERT INTO amities (a, b, demandeur, statut, date) VALUES (?, ?, ?, 'attente', ?)").bind(a, b, moi.id, Date.now()).run()
      await boite(env, cible.id).pousser({ type: 'amis' })
      return json({ statut: 'envoyee' })
    }
    if (req.method === 'POST' && chemin[1] && (chemin[2] === 'accepter' || chemin[2] === 'retirer')) {
      const [a, b] = paire(moi.id, chemin[1])
      if (chemin[2] === 'accepter') {
        const r = await env.DB.prepare("UPDATE amities SET statut = 'acceptee', date = ? WHERE a = ? AND b = ? AND statut = 'attente' AND demandeur != ?")
          .bind(Date.now(), a, b, moi.id)
          .run()
        if (!r.meta.changes) return erreur('Demande introuvable.', 404)
      } else {
        // refuser une demande, l'annuler, ou retirer un ami (les messages échangés sont supprimés aussi)
        await env.DB.batch([
          env.DB.prepare('DELETE FROM amities WHERE a = ? AND b = ?').bind(a, b),
          env.DB.prepare('DELETE FROM messages WHERE (de = ?1 AND a = ?2) OR (de = ?2 AND a = ?1)').bind(moi.id, chemin[1]),
          env.DB.prepare('DELETE FROM images WHERE (de = ?1 AND a = ?2) OR (de = ?2 AND a = ?1)').bind(moi.id, chemin[1])
        ])
      }
      await boite(env, chemin[1]).pousser({ type: 'amis' })
      return json({ ok: true })
    }
  }

  // ---------- messages ----------
  if (chemin[0] === 'messages' && chemin[1]) {
    const ami = chemin[1]
    if (!(await sontAmis(env, moi.id, ami))) return erreur('Vous n’êtes pas amis.', 403)
    if (req.method === 'GET' && !chemin[2]) {
      const avant = Number(url.searchParams.get('avant')) || Date.now() + 1
      const r = await env.DB.prepare(
        `SELECT ${COLONNES_MESSAGE} FROM messages WHERE ((de = ?1 AND a = ?2) OR (de = ?2 AND a = ?1)) AND date < ?3 ORDER BY date DESC LIMIT 50`
      )
        .bind(moi.id, ami, avant)
        .all()
      return json({ messages: r.results.reverse() })
    }
    if (req.method === 'POST' && !chemin[2]) {
      if (await tropDeMessages(env, moi.id)) return erreur('Trop de messages d’un coup : attends une minute.', 429)
      const contenu = contenuMessage(lireJson())
      if (contenu instanceof Response) return contenu
      return publierMessage(env, moi, { a: ami }, contenu)
    }
    if (req.method === 'PUT' && (chemin[2] === 'image' || chemin[2] === 'vocal')) {
      if (await tropDeMessages(env, moi.id)) return erreur('Trop de messages d’un coup : attends une minute.', 429)
      const son = chemin[2] === 'vocal'
      const media = await rangerImage(env, req, corps, moi.id, { a: ami }, son)
      if (media instanceof Response) return media
      return publierMessage(env, moi, { a: ami }, { texte: '', url: null, titre: null, ...(son ? { vocal: media } : { image: media }) })
    }
    if (req.method === 'POST' && chemin[2] === 'lu') {
      const r = await env.DB.prepare('UPDATE messages SET lu = 1 WHERE de = ? AND a = ? AND lu = 0').bind(ami, moi.id).run()
      // l'ami voit « Vu » sous ses messages
      if (r.meta.changes) await boite(env, ami).pousser({ type: 'lu', id: moi.id })
      return json({ ok: true })
    }
  }

  // ---------- statut (« en train de jouer à… », « ne pas déranger ») ----------
  if (chemin[0] === 'statut' && req.method === 'POST') {
    const d = lireJson()
    const type = String(d.type ?? '')
    if (!TYPES_STATUT.includes(type)) return erreur('Statut invalide.')
    const statut = type === 'dispo' ? null : { type, texte: String(d.texte ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 60) }
    await env.DB.prepare('UPDATE utilisateurs SET statut = ? WHERE id = ?').bind(statut ? JSON.stringify(statut) : null, moi.id).run()
    const liste = (await amis(env, moi.id)).filter((x) => x.statut === 'acceptee')
    await Promise.allSettled(liste.map((x) => boite(env, x.id).pousser({ type: 'statut', id: moi.id, statut })))
    return json({ statut })
  }

  // ---------- images ----------
  if (chemin[0] === 'image' && chemin[1] && req.method === 'GET') {
    const im = await env.DB.prepare('SELECT de, a, groupe, type, donnees FROM images WHERE id = ?')
      .bind(chemin[1])
      .first<{ de: string; a: string | null; groupe: string | null; type: string; donnees: ArrayBuffer | number[] }>()
    const autorise = !!im && (im.de === moi.id || im.a === moi.id || (!!im.groupe && (await membresDe(env, im.groupe)).includes(moi.id)))
    if (!im || !autorise) return erreur('introuvable', 404)
    const octets = im.donnees instanceof ArrayBuffer ? new Uint8Array(im.donnees) : Uint8Array.from(im.donnees)
    return new Response(octets, { headers: { 'Content-Type': im.type, 'Cache-Control': 'private, max-age=86400' } })
  }

  // ---------- groupes ----------
  if (chemin[0] === 'groupes') {
    if (req.method === 'GET' && !chemin[1]) {
      const r = await env.DB.prepare('SELECT g.id, g.nom, g.createur, m.lu FROM groupes g JOIN membres m ON m.groupe = g.id WHERE m.id = ? ORDER BY g.date')
        .bind(moi.id)
        .all<{ id: string; nom: string; createur: string; lu: number }>()
      const groupes = await Promise.all(
        r.results.map(async (g) => {
          const ids = await membresDe(env, g.id)
          const nonLus = await env.DB.prepare('SELECT COUNT(*) AS n FROM messages WHERE groupe = ? AND de != ? AND date > ?').bind(g.id, moi.id, g.lu).first<{ n: number }>()
          return { id: g.id, nom: g.nom, createur: g.createur, membres: (await profils(env, ids)).map(profilPublic), nonLus: nonLus?.n ?? 0 }
        })
      )
      return json({ groupes })
    }
    if (req.method === 'POST' && !chemin[1]) {
      const d = lireJson()
      const nom = String(d.nom ?? '').trim()
      if (!RE_NOM_GROUPE.test(nom)) return erreur('Donne un nom au groupe (40 caractères au plus).')
      const invites = [...new Set(Array.isArray(d.membres) ? d.membres.map(String) : [])].filter((x) => x !== moi.id)
      if (!invites.length) return erreur('Choisis au moins un ami.')
      if (invites.length + 1 > MAX_MEMBRES) return erreur(`${MAX_MEMBRES} personnes au plus dans un groupe.`)
      for (const id of invites) if (!(await sontAmis(env, moi.id, id))) return erreur('On ne peut ajouter que ses amis.', 403)
      const id = crypto.randomUUID()
      const maintenant = Date.now()
      await env.DB.batch([
        env.DB.prepare('INSERT INTO groupes (id, nom, createur, date) VALUES (?, ?, ?, ?)').bind(id, nom, moi.id, maintenant),
        ...[moi.id, ...invites].map((m) => env.DB.prepare('INSERT INTO membres (groupe, id, lu, date) VALUES (?, ?, ?, ?)').bind(id, m, maintenant, maintenant))
      ])
      await Promise.allSettled(invites.map((m) => boite(env, m).pousser({ type: 'groupes' })))
      return json({ id }, 201)
    }
    const g = chemin[1]
    if (g) {
      const membres = await membresDe(env, g)
      if (!membres.includes(moi.id)) return erreur('Tu ne fais pas partie de ce groupe.', 403)
      const prevenir = (ids: string[]): Promise<unknown> => Promise.allSettled(ids.filter((x) => x !== moi.id).map((x) => boite(env, x).pousser({ type: 'groupes' })))
      if (req.method === 'POST' && chemin[2] === 'membres') {
        const id = String(lireJson().id ?? '')
        if (membres.includes(id)) return json({ ok: true })
        if (membres.length >= MAX_MEMBRES) return erreur(`${MAX_MEMBRES} personnes au plus dans un groupe.`)
        if (!(await sontAmis(env, moi.id, id))) return erreur('On ne peut ajouter que ses amis.', 403)
        await env.DB.prepare('INSERT INTO membres (groupe, id, lu, date) VALUES (?, ?, ?, ?)').bind(g, id, Date.now(), Date.now()).run()
        await prevenir([...membres, id])
        return json({ ok: true })
      }
      if (req.method === 'POST' && chemin[2] === 'quitter') {
        await env.DB.prepare('DELETE FROM membres WHERE groupe = ? AND id = ?').bind(g, moi.id).run()
        await supprimerGroupeSiVide(env, g)
        await prevenir(membres)
        return json({ ok: true })
      }
      if (req.method === 'POST' && chemin[2] === 'nom') {
        const nom = String(lireJson().nom ?? '').trim()
        if (!RE_NOM_GROUPE.test(nom)) return erreur('Nom invalide (40 caractères au plus).')
        await env.DB.prepare('UPDATE groupes SET nom = ? WHERE id = ?').bind(nom, g).run()
        await prevenir(membres)
        return json({ ok: true })
      }
      if (req.method === 'POST' && chemin[2] === 'lu') {
        await env.DB.prepare('UPDATE membres SET lu = ? WHERE groupe = ? AND id = ?').bind(Date.now(), g, moi.id).run()
        return json({ ok: true })
      }
      if (chemin[2] === 'messages' && req.method === 'GET') {
        const avant = Number(url.searchParams.get('avant')) || Date.now() + 1
        const r = await env.DB.prepare(`SELECT ${COLONNES_MESSAGE} FROM messages WHERE groupe = ? AND date < ? ORDER BY date DESC LIMIT 50`).bind(g, avant).all()
        return json({ messages: r.results.reverse() })
      }
      if (chemin[2] === 'messages' && req.method === 'POST') {
        if (await tropDeMessages(env, moi.id)) return erreur('Trop de messages d’un coup : attends une minute.', 429)
        const contenu = contenuMessage(lireJson())
        if (contenu instanceof Response) return contenu
        return publierMessage(env, moi, { groupe: g }, contenu)
      }
      if ((chemin[2] === 'image' || chemin[2] === 'vocal') && req.method === 'PUT') {
        if (await tropDeMessages(env, moi.id)) return erreur('Trop de messages d’un coup : attends une minute.', 429)
        const son = chemin[2] === 'vocal'
        const media = await rangerImage(env, req, corps, moi.id, { groupe: g }, son)
        if (media instanceof Response) return media
        return publierMessage(env, moi, { groupe: g }, { texte: '', url: null, titre: null, ...(son ? { vocal: media } : { image: media }) })
      }
    }
  }

  // ---------- direct (WebSocket) ----------
  if (chemin[0] === 'direct' && req.headers.get('Upgrade') === 'websocket') {
    const liste = (await amis(env, moi.id)).filter((x) => x.statut === 'acceptee').map((x) => x.id)
    // les amis voient que l'utilisateur vient de se connecter
    await Promise.allSettled(liste.map((id) => boite(env, id).pousser({ type: 'presence', id: moi.id, enLigne: true })))
    return boite(env, moi.id).fetch(new Request('https://boite/connecter', { headers: { Upgrade: 'websocket', 'X-Amis': liste.join(','), 'X-Moi': moi.id } }))
  }

  return erreur('introuvable', 404)
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      return await routeur(req, env)
    } catch (e) {
      console.error(e)
      return erreur('Erreur du serveur.', 500)
    }
  },

  /** Ménage quotidien : messages et images de plus de 90 jours, nonces expirés. */
  async scheduled(_e: ScheduledController, env: Env): Promise<void> {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM messages WHERE date < ?').bind(Date.now() - 90 * 24 * 3600 * 1000),
      env.DB.prepare('DELETE FROM images WHERE date < ?').bind(Date.now() - 90 * 24 * 3600 * 1000),
      env.DB.prepare('DELETE FROM nonces WHERE expire < ?').bind(Date.now()),
      // espaces de synchronisation abandonnés depuis plus d'un an
      env.DB.prepare('DELETE FROM sync WHERE maj < ?').bind(Date.now() - 365 * 24 * 3600 * 1000)
    ])
  }
} satisfies ExportedHandler<Env>
