import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './theme/glass.css'

createRoot(document.getElementById('racine')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
