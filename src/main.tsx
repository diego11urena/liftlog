import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import DevMuscles from './DevMuscles.tsx'
import { seed } from './db.ts'
import { toast } from './App.tsx'
import { importFromLink, startSync } from './sync.ts'

registerSW({ immediate: true })
navigator.storage?.persist?.() // ask the browser not to evict workout data

seed().finally(() => {
  startSync() // after the seed: its writes are local-only
  importFromLink().then((n) => n && setTimeout(() => toast(`Imported ${n} items`), 500)).catch((e) => setTimeout(() => toast(`Import failed: ${e.message}`), 500))
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {location.pathname === '/dev/muscles' ? <DevMuscles /> : <App />}
    </StrictMode>,
  )
})
