#!/usr/bin/env node
/* Copie les fichiers dont pdf.js a besoin à l'exécution (tables de caractères, polices standard, décodeurs wasm,
 * profils de couleur) dans src/renderer/public/pdfjs : la visionneuse les charge depuis son propre domaine.
 * Lancé automatiquement après npm install, et avant dev / build. */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(racine, 'node_modules', 'pdfjs-dist')
const cible = join(racine, 'src', 'renderer', 'public', 'pdfjs')
if (!existsSync(source)) {
  console.error('pdfjs-dist absent : lance npm install')
  process.exit(1)
}
rmSync(cible, { recursive: true, force: true })
mkdirSync(cible, { recursive: true })
for (const dossier of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  if (existsSync(join(source, dossier))) cpSync(join(source, dossier), join(cible, dossier), { recursive: true })
}
console.log('pdf.js : fichiers copiés dans src/renderer/public/pdfjs')
