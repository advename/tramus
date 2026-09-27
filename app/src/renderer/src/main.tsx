import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import 'material-symbols/outlined.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app/App'

const container = document.getElementById('root')
if (!container) throw new Error('main.tsx: #root element not found')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)
