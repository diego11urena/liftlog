import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// mkcert certs for LAN-only HTTPS (see README). Absent → plain HTTP.
const https = existsSync('cert.pem') ? { cert: readFileSync('cert.pem'), key: readFileSync('key.pem') } : undefined

export default defineConfig({
  server: { host: true, https },
  preview: { host: true, https },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Liftlog',
        short_name: 'Liftlog',
        description: 'Personal offline workout log',
        theme_color: '#F6F6F3',
        background_color: '#F6F6F3',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [{
          // Exercise photos: cached the first time they're viewed.
          urlPattern: /^https:\/\/raw\.githubusercontent\.com\/yuhonas\/free-exercise-db\//,
          handler: 'CacheFirst',
          options: { cacheName: 'exercise-images', expiration: { maxEntries: 2000 }, cacheableResponse: { statuses: [0, 200] } },
        }],
      },
    }),
  ],
})
