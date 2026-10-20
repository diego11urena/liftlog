// Phase 2 server: serves the built app (dist/) and the /api/sync endpoint. Run: npm run serve
import fastifyStatic from '@fastify/static'
import Fastify from 'fastify'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { openStore, type Change } from './store.ts'

const root = join(import.meta.dirname, '..')
mkdirSync(join(root, 'server/data'), { recursive: true })
const store = openStore(join(root, 'server/data/liftlog.sqlite'))

const app = Fastify({ bodyLimit: 20 * 1024 * 1024 })

app.post<{ Body: { since?: number; changes?: Change[] } }>('/api/sync', async (req, reply) => {
  const { since = 0, changes = [] } = req.body ?? {}
  if (!Number.isFinite(since) || !Array.isArray(changes) || !changes.every(store.valid)) return reply.code(400).send({ error: 'bad sync payload' })
  store.push(changes)
  return store.pull(since)
})

app.register(fastifyStatic, {
  root: join(root, 'dist'),
  // the app shell and service worker must be re-checked so updates arrive; hashed assets can cache forever
  setHeaders: (res, path) => res.header('Cache-Control', /\/assets\//.test(path) ? 'public, max-age=31536000, immutable' : 'no-cache'),
})
// single-page app: unknown GET paths (e.g. /dev/muscles) get index.html
app.setNotFoundHandler((req, reply) =>
  req.method === 'GET' && !req.url.startsWith('/api/') ? reply.sendFile('index.html') : reply.code(404).send({ error: 'not found' }))

const port = Number(process.env.PORT ?? 4173)
await app.listen({ port, host: '0.0.0.0' })
console.log(`Liftlog on http://localhost:${port} (and your LAN IP, port ${port})`)
