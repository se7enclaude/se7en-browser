#!/usr/bin/env node
/* se7en Browser — construit l'installeur Windows.
 *
 *   npm run dist        -> dist/release/se7en-Browser-Setup-<version>.exe
 *
 * 1. electron-vite build (out/) ;
 * 2. dist/build/app : Electron (node_modules/electron/dist) renommé « se7en Browser.exe », avec l'icône,
 *    + resources/app (out/, package.json réduit, icône, et les seuls modules utiles au navigateur) ;
 * 3. Inno Setup (installer.iss) -> l'installeur. Le même .exe sert de mise à jour (lancé en silencieux).
 * Version : package.json. */
'use strict'
const fs = require('fs')
const path = require('path')
const cp = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'dist')
const B = path.join(OUT, 'build')
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const VERSION = PKG.version
const EXE = 'se7en Browser.exe'
const ISCC = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Inno Setup 6', 'ISCC.exe')
const mb = (n) => (n / 1e6).toFixed(1) + ' Mo'
const stop = (msg) => {
  console.error(msg)
  process.exit(1)
}

/** Copie récursive ; `garder(chemin)` peut écarter des fichiers (cartes de sources…). Renvoie la taille copiée. */
function copy(src, dst, garder = () => true) {
  const st = fs.statSync(src)
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true })
    return fs.readdirSync(src).reduce((n, f) => n + copy(path.join(src, f), path.join(dst, f), garder), 0)
  }
  if (!garder(src)) return 0
  fs.mkdirSync(path.dirname(dst), { recursive: true })
  fs.copyFileSync(src, dst)
  return st.size
}
function run(cmd) {
  const r = cp.spawnSync(cmd, { cwd: ROOT, stdio: 'inherit', shell: true })
  if (r.status !== 0) stop('Échec : ' + cmd)
}

// 1. compilation
run('npm run build')

// 2. Electron renommé, avec l'icône de se7en Browser
fs.rmSync(B, { recursive: true, force: true })
fs.mkdirSync(path.join(OUT, 'release'), { recursive: true })
const APP = path.join(B, 'app')
const ELECTRON = path.join(ROOT, 'node_modules', 'electron', 'dist')
if (!fs.existsSync(path.join(ELECTRON, 'electron.exe'))) stop('Electron absent : node node_modules/electron/install.js')
copy(ELECTRON, APP)
fs.renameSync(path.join(APP, 'electron.exe'), path.join(APP, EXE))
fs.rmSync(path.join(APP, 'resources', 'default_app.asar'), { force: true })
const ico = cp.spawnSync('python', [path.join(__dirname, 'set_exe_icon.py'), path.join(APP, EXE), path.join(ROOT, 'build', 'icon.ico')], { stdio: 'inherit' })
if (ico.status !== 0) stop('Icône du .exe : échec (python + tools/set_exe_icon.py)')

// le navigateur : code compilé + modules de production (pdf.js, pdf-lib, bloqueur et leurs dépendances)
const RES = path.join(APP, 'resources', 'app')
const sansCartes = (f) => !/\.(map|d\.ts|d\.mts|d\.cts)$/i.test(f)
let taille = copy(path.join(ROOT, 'out'), path.join(RES, 'out'), sansCartes)
taille += copy(path.join(ROOT, 'build', 'icon.ico'), path.join(RES, 'build', 'icon.ico'))
taille += copy(path.join(ROOT, 'build', 'icon.png'), path.join(RES, 'build', 'icon.png'))
const pkg = { name: PKG.name, productName: PKG.productName, version: VERSION, description: PKG.description, main: PKG.main, author: PKG.author, dependencies: PKG.dependencies }
fs.writeFileSync(path.join(RES, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')
const ls = cp.spawnSync('npm ls --omit=dev --all --parseable', { cwd: ROOT, encoding: 'utf8', shell: true })
const modules = ls.stdout.split(/\r?\n/).filter((l) => l.includes('node_modules'))
if (!modules.length) stop('Liste des modules de production vide (npm ls).')
for (const m of modules) {
  // les modules imbriqués sont copiés avec leur parent : on ne copie que le niveau le plus haut
  if (modules.some((p) => p !== m && m.startsWith(p + path.sep))) continue
  taille += copy(m, path.join(RES, m.slice(m.indexOf('node_modules'))), sansCartes)
}
const attendus = ['out/main/index.js', 'out/preload/ui.js', 'out/renderer/index.html', 'out/renderer/pdf.html', 'out/preload/notif.js', 'out/renderer/notif.html', 'node_modules/pdfjs-dist/legacy/build/pdf.mjs', 'node_modules/@ghostery/adblocker/package.json', 'node_modules/pdf-lib/package.json']
for (const f of attendus) if (!fs.existsSync(path.join(RES, f))) stop('absent du paquet : ' + f)
console.log('Navigateur : ' + mb(taille) + ' (' + modules.length + ' modules) + Electron')

// 3. installeur
if (!fs.existsSync(ISCC)) stop('Inno Setup absent : ' + ISCC)
const iss = cp.spawnSync(ISCC, ['/Q', '/DAppVersion=' + VERSION, '/DStage=' + B, '/O' + path.join(OUT, 'release'), path.join(ROOT, 'installer.iss')], { stdio: 'inherit' })
if (iss.status !== 0) stop("Échec d'Inno Setup")
const exe = path.join(OUT, 'release', 'se7en-Browser-Setup-' + VERSION + '.exe')
console.log('Installeur : ' + exe + ' (' + mb(fs.statSync(exe).size) + ')')
