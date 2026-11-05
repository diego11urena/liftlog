// Automatic backup: two-way sync with POST /api/sync (api/sync.ts online, server/index.ts on the Mac). Last write wins
// per row by updatedAt. Local data stays the source of truth: if the server can't be reached, nothing changes and the
// next try catches up. Each phone's space online is reached with its recovery code.
import { db, quiet, quietly } from './db'

const TABLES = ['exercises', 'workouts', 'plans', 'workoutLogs', 'workoutExercises', 'sets'] as const
type Change = { tbl: string; id: string; updatedAt: number; deleted?: boolean; data?: Record<string, unknown> }
type Meta = { pushedAt: number; seq: number; backedUpAt?: number }

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // Crockford base32: no I, L, O or U to misread
/** Forgiving about typing: dashes, spaces, lower case, O for 0, I or L for 1. */
export const normalizeCode = (t: string) => t.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')
export const isCode = (c: string) => /^[0-9A-HJKMNP-TV-Z]{24}$/.test(c)
export const fmtCode = (c: string) => c.match(/.{1,4}/g)?.join('-') ?? c

/** This phone's recovery code (120 random bits), made the first time it's needed. */
export function backupCode() {
  return db.transaction('rw', db.settings, async () => {
    const cur = (await db.settings.get('backupCode'))?.value as string | undefined
    if (cur) return cur
    const code = [...crypto.getRandomValues(new Uint8Array(24))].map((b) => ALPHABET[b & 31]).join('')
    await db.settings.put({ key: 'backupCode', value: code })
    return code
  })
}

const post = (code: string, body: unknown) =>
  fetch('/api/sync', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${code}` }, body: JSON.stringify(body) })

let timer: number | undefined
/** Sync a couple of seconds after the last local change. */
const soon = () => { if (!quiet.on) { clearTimeout(timer); timer = window.setTimeout(() => void sync(), 2000) } }

/** Stamp every local write and remember deletes, so they can be sent. */
function installHooks() {
  for (const t of TABLES) {
    const table = db.table(t)
    table.hook('creating', (_pk, obj) => { if (!quiet.on) { obj.updatedAt = Date.now(); soon() } })
    table.hook('updating', () => { if (quiet.on) return undefined; soon(); return { updatedAt: Date.now() } })
    table.hook('deleting', (pk, _obj, tx) => {
      if (quiet.on) return
      tx.on('complete', () => { void db.tombstones.put({ key: `${t}:${pk}`, tbl: t, id: String(pk), deletedAt: Date.now() }); soon() })
    })
  }
}

let running = false, again = false, noServer = false
const PUSH = 1000

/** True once everything is backed up and pulled. */
export async function sync() {
  if (noServer) return false
  if (running) { again = true; return false }
  running = true
  try {
    const code = await backupCode()
    const meta = ((await db.settings.get('sync'))?.value as Meta | undefined) ?? { pushedAt: 0, seq: 0 }
    const started = Date.now()
    let changes: Change[] = []
    for (const t of TABLES) {
      // built-ins nobody edited (updatedAt 1) come with the app
      const rows = await db.table(t).filter((r) => (r.updatedAt ?? 0) > Math.max(meta.pushedAt, 1)).toArray()
      changes.push(...rows.map((r) => ({ tbl: t, id: r.id, updatedAt: r.updatedAt ?? 0, data: r })))
    }
    const deletes = await db.tombstones.where('deletedAt').above(meta.pushedAt).toArray()
    changes.push(...deletes.map((d) => ({ tbl: d.tbl, id: d.id, updatedAt: d.deletedAt, deleted: true })))

    // batches keep a first backup of a long history under the host's request size limit
    let seq = meta.seq, more = true
    for (let i = 0; more || i < changes.length; i += PUSH) {
      const res = await post(code, { since: seq, changes: changes.slice(i, i + PUSH) })
      // a static host with no sync server: stop trying; data simply lives on this device
      if (res.status === 404 || res.status === 405) { noServer = true; return false }
      if (!res.ok) throw new Error(`sync ${res.status}`)
      const body = (await res.json()) as { seq: number; more: boolean; changes: Change[] }
      await apply(body.changes)
      seq = body.seq; more = body.more
    }
    await db.settings.put({ key: 'sync', value: { pushedAt: started, seq, backedUpAt: Date.now() } satisfies Meta })
    await db.tombstones.where('deletedAt').belowOrEqual(started).delete()
    return true
  } catch {
    // offline or no server (e.g. `npm run dev`): try again later
    return false
  } finally {
    running = false
    if (again) { again = false; soon() }
  }
}

/** Switch this phone to an existing backup and bring it back. Anything already on the phone is kept and joins that backup.
 *  A code with nothing behind it is refused, so a typo can't quietly start an empty backup. */
export async function restoreBackup(input: string): Promise<'ok' | 'bad' | 'empty' | 'offline'> {
  const code = normalizeCode(input)
  if (!isCode(code)) return 'bad'
  try {
    const res = await post(code, { since: 0, changes: [] })
    if (!res.ok) return 'offline'
    if (!((await res.json()) as { changes: Change[] }).changes.length) return 'empty'
  } catch { return 'offline' }
  while (running) await new Promise((r) => setTimeout(r, 50)) // a sync in flight would save its progress over ours
  await db.settings.bulkPut([{ key: 'backupCode', value: code }, { key: 'backupCodeSaved', value: true }, { key: 'sync', value: { pushedAt: 0, seq: 0 } satisfies Meta }])
  return (await sync()) ? 'ok' : 'offline'
}

/** One-time move to a new address: `#import=<gzip+base64url JSON of rows>` (made by scripts/export-link.ts).
 *  The part after # never leaves the phone. Rows merge like sync (newer wins), so opening it twice is harmless. */
export async function importFromLink(text = location.hash) {
  const m = text.trim().match(/#import=([A-Za-z0-9_-]+)$/)
  if (!m) return 0
  if (text === location.hash) history.replaceState(null, '', location.pathname)
  const bytes = Uint8Array.from(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
  const json = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
  const changes = JSON.parse(json) as Change[]
  await apply(changes)
  return changes.length
}

/** Take the server's rows where they're newer than ours. */
function apply(changes: Change[]) {
  if (!changes.length) return
  return quietly(() => db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const c of changes) {
      if (!(TABLES as readonly string[]).includes(c.tbl)) continue
      const table = db.table(c.tbl)
      const local = await table.get(c.id)
      if (local && (local.updatedAt ?? 0) >= c.updatedAt) continue
      if (c.deleted) await table.delete(c.id)
      else await table.put(c.data)
    }
  }))
}

export function startSync() {
  installHooks()
  void sync()
  setInterval(() => void sync(), 5 * 60_000) // changes sync on their own; this just retries after a failure
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void sync() })
  window.addEventListener('online', () => void sync())
}
