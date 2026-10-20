import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import DevMuscles from './DevMuscles.tsx'
import { seed } from './db.ts'

registerSW({ immediate: true })
navigator.storage?.persist?.() // ask the browser not to evict workout data

seed().finally(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {location.pathname === '/dev/muscles' ? <DevMuscles /> : <App />}
    </StrictMode>,
  ),
)
