import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './theme/glass.css'

// une erreur de l'interface est notée dans les rapports de plantage (gardés sur ce PC)
window.addEventListener('error', (e) => window.se7en.plantages.signaler(e.message, (e.error as Error | undefined)?.stack ?? ''))
window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason as unknown
  window.se7en.plantages.signaler(r instanceof Error ? r.message : String(r), r instanceof Error ? (r.stack ?? '') : '')
})

createRoot(document.getElementById('racine')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
