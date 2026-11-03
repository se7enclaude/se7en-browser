/* Configuration de construction : processus principal, preload et interface React. */
import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

// En développement, Vite injecte un petit script en ligne (rechargement à chaud) et ouvre un websocket :
// on assouplit la politique de sécurité de l'interface uniquement dans ce cas.
function cspDeveloppement(): Plugin {
  return {
    name: 'se7en-csp-dev',
    apply: 'serve',
    transformIndexHtml: (html) =>
      html
        .replace("script-src 'self'", "script-src 'self' 'unsafe-inline' http://localhost:*")
        .replace("connect-src 'self'", "connect-src 'self' ws: http://localhost:*")
  }
}

export default defineConfig({
  main: {
    build: { rollupOptions: { input: { index: resolve('src/main/index.ts') } } }
  },
  preload: {
    // Preload en CommonJS d'un seul fichier : obligatoire avec sandbox: true.
    build: { rollupOptions: { input: { ui: resolve('src/preload/ui.ts'), notif: resolve('src/preload/notif.ts') } } }
  },
  renderer: {
    root: resolve('src/renderer'),
    // trois pages : l'interface du navigateur, la visionneuse PDF (servie à part, dans un onglet isolé)
    // et la notification de message (petite vue posée au-dessus des pages)
    build: { rollupOptions: { input: { index: resolve('src/renderer/index.html'), pdf: resolve('src/renderer/pdf.html'), notif: resolve('src/renderer/notif.html'), discussion: resolve('src/renderer/discussion.html') } } },
    plugins: [react(), cspDeveloppement()]
  }
})
