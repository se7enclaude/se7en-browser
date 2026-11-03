/* Tor pour le VPN du navigateur : le « Tor Expert Bundle » officiel de torproject.org, téléchargé une fois
 * dans dist/cache/tor et vérifié par son empreinte SHA-256 (épinglée ici après vérification de la signature
 * GPG des développeurs de Tor Browser, clé EF6E 286D DA85 EA2A 4BA7 DE68 4E2C 6E87 9329 8290).
 *
 *   node tools/tor.js   -> prépare dist/cache/tor (sert aussi au lancement en développement)
 *
 * Pour passer à une nouvelle version : changer VERSION et SHA256 après avoir vérifié la signature (.asc). */
'use strict'
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const cp = require('child_process')

const VERSION = '16.0'
const FICHIER = `tor-expert-bundle-windows-x86_64-${VERSION}.tar.gz`
const URL_TOR = `https://dist.torproject.org/torbrowser/${VERSION}/${FICHIER}`
const SHA256 = '2ee123e9167318a3742778ff704e75f01d4780f05a14522d451fe011011077c4'

const CACHE = path.resolve(__dirname, '..', 'dist', 'cache')
const DOSSIER = path.join(CACHE, 'tor')

/** Les seuls fichiers gardés : Tor, la base pays des adresses IPv4 (choix du pays), la licence. */
const UTILES = ['tor/tor.exe', 'data/geoip', 'docs/tor.txt']

function empreinte(f) {
  return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
}

/** Prépare dist/cache/tor et renvoie son chemin. */
async function preparerTor() {
  if (UTILES.every((f) => fs.existsSync(path.join(DOSSIER, f)))) return DOSSIER
  fs.mkdirSync(CACHE, { recursive: true })
  const archive = path.join(CACHE, FICHIER)
  if (!fs.existsSync(archive) || empreinte(archive) !== SHA256) {
    console.log('Téléchargement de Tor ' + VERSION + '…')
    const r = await fetch(URL_TOR)
    if (!r.ok) throw new Error('Téléchargement de Tor : HTTP ' + r.status)
    fs.writeFileSync(archive, Buffer.from(await r.arrayBuffer()))
  }
  if (empreinte(archive) !== SHA256) {
    fs.rmSync(archive, { force: true })
    throw new Error('Empreinte de Tor inattendue : fichier refusé.')
  }
  const tmp = path.join(CACHE, 'tor-extrait')
  fs.rmSync(tmp, { recursive: true, force: true })
  fs.mkdirSync(tmp, { recursive: true })
  // le tar de Windows (celui de Git Bash prend « C: » pour un serveur distant)
  const tarWindows = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe')
  const t = cp.spawnSync(fs.existsSync(tarWindows) ? tarWindows : 'tar', ['-xzf', archive, '-C', tmp], { stdio: 'inherit' })
  if (t.status !== 0) throw new Error('Extraction de Tor : échec (tar)')
  fs.rmSync(DOSSIER, { recursive: true, force: true })
  for (const f of UTILES) {
    fs.mkdirSync(path.dirname(path.join(DOSSIER, f)), { recursive: true })
    fs.copyFileSync(path.join(tmp, f), path.join(DOSSIER, f))
  }
  fs.rmSync(tmp, { recursive: true, force: true })
  return DOSSIER
}

module.exports = { preparerTor, UTILES, VERSION }

if (require.main === module)
  preparerTor().then(
    (d) => console.log('Tor prêt : ' + d),
    (e) => {
      console.error(e.message)
      process.exit(1)
    }
  )
