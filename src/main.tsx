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

/** Installed iOS app: the layout viewport can be shorter than the screen (about the status bar). Nothing can be drawn in
 *  that strip, so measure it: the tab bar drops its home-indicator padding and shrinks (see --gap-b / --safe-b in index.css). */
const standalone = () => matchMedia('(display-mode: standalone)').matches || !!(navigator as { standalone?: boolean }).standalone
const fit = () => {
  const gap = standalone() ? Math.max(0, Math.round(screen.height - innerHeight)) : 0
  const root = document.documentElement.style
  root.setProperty('--gap-b', `${gap}px`)
  if (gap > 20) root.setProperty('--nav-h', '56px'); else root.removeProperty('--nav-h')
}
fit()
for (const ev of ['resize', 'orientationchange', 'pageshow']) addEventListener(ev, fit)
document.addEventListener('visibilitychange', fit)

seed().finally(() => {
  startSync() // after the seed: its writes are local-only
  importFromLink().then((n) => n && setTimeout(() => toast(`Imported ${n} items`), 500)).catch((e) => setTimeout(() => toast(`Import failed: ${e.message}`), 500))
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {location.pathname === '/dev/muscles' ? <DevMuscles /> : <App />}
    </StrictMode>,
  )
})
