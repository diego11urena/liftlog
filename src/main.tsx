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

// Home Screen app is always full screen (portrait-locked), so the frame is exactly the screen's height
if (matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone) {
  const fit = () => document.documentElement.style.setProperty('--app-h', `${Math.max(screen.height, innerHeight)}px`)
  fit()
  addEventListener('resize', fit)
}

seed().finally(() => {
  startSync() // after the seed: its writes are local-only
  importFromLink().then((n) => n && setTimeout(() => toast(`Imported ${n} items`), 500)).catch((e) => setTimeout(() => toast(`Import failed: ${e.message}`), 500))
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {location.pathname === '/dev/muscles' ? <DevMuscles /> : <App />}
    </StrictMode>,
  )
})
