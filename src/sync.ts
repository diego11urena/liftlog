// Two-way sync with the Mac's server (server/index.ts, POST /api/sync). Last write wins per row by updatedAt.
// Local data stays the source of truth: if the server can't be reached, nothing changes and the next try catches up.
import { db, quiet, quietly } from './db'

const TABLES = ['exercises', 'workouts', 'plans', 'workoutLogs', 'workoutExercises', 'sets'] as const
type Change = { tbl: string; id: string; updatedAt: number; deleted?: boolean; data?: Record<string, unknown> }
type Meta = { pushedAt: number; seq: number }

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

let running = false, again = false

export async function sync() {
  if (running) { again = true; return }
  running = true
  try {
    const meta = ((await db.settings.get('sync'))?.value as Meta | undefined) ?? { pushedAt: 0, seq: 0 }
    const started = Date.now()
    let changes: Change[] = []
    for (const t of TABLES) {
      const rows = await db.table(t).filter((r) => (r.updatedAt ?? 0) > meta.pushedAt).toArray()
      changes.push(...rows.map((r) => ({ tbl: t, id: r.id, updatedAt: r.updatedAt ?? 0, data: r })))
    }
    const deletes = await db.tombstones.where('deletedAt').above(meta.pushedAt).toArray()
    changes.push(...deletes.map((d) => ({ tbl: d.tbl, id: d.id, updatedAt: d.deletedAt, deleted: true })))

    let seq = meta.seq, more = true
    while (more) {
      const res = await fetch('/api/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ since: seq, changes }) })
      if (!res.ok) throw new Error(`sync ${res.status}`)
      const body = (await res.json()) as { seq: number; more: boolean; changes: Change[] }
      await apply(body.changes)
      seq = body.seq; more = body.more; changes = []
    }
    await db.settings.put({ key: 'sync', value: { pushedAt: started, seq } satisfies Meta })
    await db.tombstones.where('deletedAt').belowOrEqual(started).delete()
  } catch {
    // offline or no server (e.g. `npm run dev`): try again later
  } finally {
    running = false
    if (again) { again = false; soon() }
  }
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
  setInterval(() => void sync(), 30_000)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void sync() })
  window.addEventListener('online', () => void sync())
}
