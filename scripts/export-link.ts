// One-time move of your data to a new address. Reads the sync server's SQLite copy and prints
// <base-url>/#import=<gzip+base64url rows>. Open that link on the phone; the app merges the rows in.
// Run: node --experimental-strip-types scripts/export-link.ts https://your-app.vercel.app
import { DatabaseSync } from 'node:sqlite'
import { gzipSync } from 'node:zlib'

const base = process.argv[2]?.replace(/\/$/, '')
if (!base) throw new Error('usage: export-link.ts <base-url>')

const db = new DatabaseSync('server/data/liftlog.sqlite', { readOnly: true })
const rows = db.prepare('select tbl, id, updatedAt, data from rows where deleted = 0').all() as { tbl: string; id: string; updatedAt: number; data: string }[]
const changes = rows
  .map((r) => ({ tbl: r.tbl, id: r.id, updatedAt: r.updatedAt, data: JSON.parse(r.data) }))
  // built-in exercises come with the app; only carry the ones you changed (unit, notes) and your custom ones
  .filter((c) => c.tbl !== 'exercises' || c.data.isCustom || c.data.unit || c.data.notes)

const payload = gzipSync(JSON.stringify(changes)).toString('base64url')
const count = (t: string) => changes.filter((c) => c.tbl === t).length
console.error(`${changes.length} rows: ${count('workouts')} saved workouts, ${count('plans')} plans, ${count('workoutLogs')} logged sessions, ${count('sets')} sets, ${count('exercises')} exercises`)
console.log(`${base}/#import=${payload}`)
