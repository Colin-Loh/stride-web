import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import { createLocalStorageRepositories } from './storage/localStorage'
import './index.css'

registerSW({ immediate: true })

// The one place that picks the storage implementation.
const repositories = createLocalStorageRepositories()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App repositories={repositories} />
  </StrictMode>,
)
