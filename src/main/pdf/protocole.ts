/* Protocole se7en-pdf:// de la visionneuse PDF.
 *   se7en-pdf://app/…       les fichiers de la visionneuse (page, scripts, polices de pdf.js)
 *   se7en-pdf://app/doc/<id> le PDF lui-même, seulement pour la visionneuse
 * La visionneuse tourne dans un onglet isolé, comme une page web : sans preload, sans accès au reste du navigateur.
 * Un PDF piégé qui exploiterait une faille de pdf.js resterait enfermé dans cet onglet. */
import { app, net, protocol, type Session } from 'electron'
import { promises as fs } from 'node:fs'
import { extname, join, normalize, sep } from 'node:path'
import { PROTOCOLE_PDF, RE_ID_DOC } from '../../shared/pdf'

const ORIGINE_VISIONNEUSE = `${PROTOCOLE_PDF}://app`
import type { DocumentsPdf } from './documents'

/** À appeler avant app.whenReady : le protocole se comporte comme https (origine propre, modules, fetch). */
export function declarerProtocolePdf(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: PROTOCOLE_PDF, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true } }
  ])
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.map': 'application/json',
  '.bcmap': 'application/octet-stream',
  '.pfb': 'application/octet-stream',
  '.ttf': 'font/ttf',
  '.icc': 'application/octet-stream'
}

/** Politique de sécurité de la visionneuse : rien d'extérieur, pas de script en ligne. */
const CSP =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"

const reponse = (statut: number): Response => new Response(null, { status: statut })

/**
 * Un PDF ouvert dans un onglet passerait par la visionneuse intégrée de Chromium. On le marque « à télécharger » :
 * le téléchargement est alors repris par l'intercepteur, qui l'affiche dans notre visionneuse isolée.
 */
export function redirigerPdfVersVisionneuse(session: Session): void {
  session.webRequest.onHeadersReceived({ urls: ['http://*/*', 'https://*/*'] }, (details, rappel) => {
    const entetes = details.responseHeaders ?? {}
    const type = Object.entries(entetes).find(([k]) => k.toLowerCase() === 'content-type')?.[1]?.join(',') ?? ''
    if (details.resourceType !== 'mainFrame' || !/application\/pdf/i.test(type)) return rappel({})
    // on garde le nom de fichier d'origine s'il y en a un (« inline; filename=… » → « attachment; filename=… »)
    let disposition = 'attachment'
    for (const k of Object.keys(entetes)) {
      if (k.toLowerCase() !== 'content-disposition') continue
      const nom = /filename\*?=.*/i.exec(entetes[k].join(','))?.[0]
      if (nom) disposition = `attachment; ${nom}`
      delete entetes[k]
    }
    entetes['Content-Disposition'] = [disposition]
    rappel({ responseHeaders: entetes })
  })
}

export function brancherProtocolePdf(session: Session, documents: DocumentsPdf): void {
  const dossierInterface = join(__dirname, '../renderer')
  const dev = process.env.ELECTRON_RENDERER_URL

  session.protocol.handle(PROTOCOLE_PDF, async (requete) => {
    const u = new URL(requete.url)

    if (u.hostname !== 'app') return reponse(404)

    // le fichier PDF : l'identifiant est impossible à deviner, et une requête venue d'un site web
    // (en-tête Origin d'une autre origine) est refusée
    if (u.pathname.startsWith('/doc/')) {
      const id = decodeURIComponent(u.pathname.slice(5))
      const origine = requete.headers.get('origin')
      const doc = RE_ID_DOC.test(id) ? documents.lire(id) : undefined
      if (!doc || (origine && origine !== ORIGINE_VISIONNEUSE)) return reponse(404)
      try {
        const octets = await fs.readFile(doc.chemin)
        const nom = encodeURIComponent(doc.nom.endsWith('.pdf') ? doc.nom : `${doc.nom}.pdf`)
        return new Response(octets, {
          headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store', 'Content-Disposition': `inline; filename*=UTF-8''${nom}` }
        })
      } catch {
        return reponse(404)
      }
    }

    // en développement, la visionneuse vient du serveur Vite (rechargement à chaud)
    if (dev && !app.isPackaged) return net.fetch(new URL(u.pathname + u.search, dev).href)

    // en production : fichiers compilés de l'interface, sans sortir de leur dossier
    const relatif = normalize(decodeURIComponent(u.pathname)).replace(/^[\\/]+/, '')
    const chemin = join(dossierInterface, relatif)
    if (!chemin.startsWith(dossierInterface + sep)) return reponse(403)
    try {
      const octets = await fs.readFile(chemin)
      const type = TYPES[extname(chemin).toLowerCase()] ?? 'application/octet-stream'
      const entetes: Record<string, string> = { 'Content-Type': type }
      if (type.startsWith('text/html')) entetes['Content-Security-Policy'] = CSP
      return new Response(octets, { headers: entetes })
    } catch {
      return reponse(404)
    }
  })
}
