import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import { createLocalStorageRepositories } from './storage/localStorage'
import './index.css'
import '@fontsource/press-start-2p/latin-400.css'
import './retro/tokens.css'
import './retro/retro.css'
import './retro/shop.css'
import './retro/status.css'
import './retro/run.css'

registerSW({ immediate: true })

// The one place that picks the storage implementation.
const repositories = createLocalStorageRepositories()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App repositories={repositories} />
  </StrictMode>,
)
