// Sync store: every synced row from every device, in one SQLite file. Last write wins per row (by updatedAt).
// Each accepted write gets an increasing `seq`, so a device asks for "everything after the seq I last saw".
import { DatabaseSync } from 'node:sqlite'

export const TABLES = new Set(['exercises', 'workouts', 'plans', 'workoutLogs', 'workoutExercises', 'sets'])
export type Change = { tbl: string; id: string; updatedAt: number; deleted?: boolean; data?: unknown }
const PAGE = 2000

export function openStore(path: string) {
  const db = new DatabaseSync(path)
  db.exec(`
    create table if not exists rows (
      tbl text not null, id text not null, updatedAt integer not null, deleted integer not null default 0,
      data text, seq integer not null, primary key (tbl, id));
    create index if not exists rows_seq on rows (seq);`)
  const current = db.prepare('select updatedAt from rows where tbl = ? and id = ?')
  const upsert = db.prepare(`insert into rows (tbl, id, updatedAt, deleted, data, seq) values (?, ?, ?, ?, ?, ?)
    on conflict (tbl, id) do update set updatedAt = excluded.updatedAt, deleted = excluded.deleted, data = excluded.data, seq = excluded.seq`)
  const after = db.prepare('select tbl, id, updatedAt, deleted, data, seq from rows where seq > ? order by seq limit ?')
  let seq = Number((db.prepare('select coalesce(max(seq), 0) as s from rows').get() as { s: number }).s)

  /** Store newer changes; ignore ones older than what's already there. */
  function push(changes: Change[]) {
    db.exec('begin')
    try {
      for (const c of changes) {
        const cur = current.get(c.tbl, c.id) as { updatedAt: number } | undefined
        if (cur && cur.updatedAt >= c.updatedAt) continue
        upsert.run(c.tbl, c.id, c.updatedAt, c.deleted ? 1 : 0, c.deleted ? null : JSON.stringify(c.data), ++seq)
      }
      db.exec('commit')
    } catch (e) {
      db.exec('rollback')
      throw e
    }
  }

  /** Changes after `since`, a page at a time. */
  function pull(since: number) {
    const rows = after.all(since, PAGE) as { tbl: string; id: string; updatedAt: number; deleted: number; data: string | null; seq: number }[]
    return {
      seq: rows.length === PAGE ? rows[rows.length - 1].seq : seq,
      more: rows.length === PAGE,
      changes: rows.map((r): Change => ({ tbl: r.tbl, id: r.id, updatedAt: r.updatedAt, ...(r.deleted ? { deleted: true } : { data: JSON.parse(r.data!) }) })),
    }
  }

  /** Trust boundary: only well-formed rows for known tables. */
  const valid = (c: Change) =>
    !!c && TABLES.has(c.tbl) && typeof c.id === 'string' && c.id.length > 0 && c.id.length <= 200 &&
    Number.isFinite(c.updatedAt) && (c.deleted === true || (typeof c.data === 'object' && c.data !== null))

  return { push, pull, valid, close: () => db.close() }
}
