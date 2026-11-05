// Online backup: the same /api/sync contract as the Mac server (server/index.ts), one private space per recovery code.
// The code is a long random secret made on the phone; only its SHA-256 is stored, so the database can't reveal it.
import { neon } from '@neondatabase/serverless'
import { createHash } from 'node:crypto'

export type Query = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>
type Change = { tbl: string; id: string; updatedAt: number; deleted?: boolean; data?: unknown }

const TABLES = new Set(['exercises', 'workouts', 'plans', 'workoutLogs', 'workoutExercises', 'sets'])
const CODE = /^[0-9A-HJKMNP-TV-Z]{24}$/
const PAGE = 2000

export async function migrate(q: Query) {
  await q('create sequence if not exists sync_seq')
  await q(`create table if not exists sync_rows (
    owner text not null, tbl text not null, id text not null, updated_at bigint not null,
    deleted boolean not null default false, data jsonb, seq bigint not null default nextval('sync_seq'),
    primary key (owner, tbl, id))`)
  await q('create index if not exists sync_rows_owner_seq on sync_rows (owner, seq)')
}

/** Trust boundary: only well-formed rows for known tables. */
const valid = (c: Change) =>
  !!c && TABLES.has(c.tbl) && typeof c.id === 'string' && c.id.length > 0 && c.id.length <= 200 &&
  Number.isSafeInteger(c.updatedAt) && c.updatedAt >= 0 && (c.deleted === true || (typeof c.data === 'object' && c.data !== null))

// ponytail: anyone can open a new space by inventing a code, so a stranger could fill the free database. Add a per-IP limit if that happens.
export async function handle(q: Query, authorization: string | null, body: unknown) {
  const code = authorization?.replace(/^Bearer /, '') ?? ''
  if (!CODE.test(code)) return { status: 401, json: { error: 'bad recovery code' } }
  const { since = 0, changes = [] } = (body ?? {}) as { since?: number; changes?: Change[] }
  if (!Number.isSafeInteger(since) || since < 0 || !Array.isArray(changes) || changes.length > PAGE || !changes.every(valid))
    return { status: 400, json: { error: 'bad sync payload' } }
  const owner = createHash('sha256').update(code).digest('hex')

  // a row and its delete can travel together; Postgres can't upsert the same key twice in one statement
  const newest = new Map<string, Change>()
  for (const c of changes) {
    const k = `${c.tbl}:${c.id}`, cur = newest.get(k)
    if (!cur || c.updatedAt >= cur.updatedAt) newest.set(k, c)
  }
  if (newest.size) await q(`
    insert into sync_rows (owner, tbl, id, updated_at, deleted, data)
    select $1, c.tbl, c.id, c."updatedAt", coalesce(c.deleted, false), c.data
    from jsonb_to_recordset($2::jsonb) as c(tbl text, id text, "updatedAt" bigint, deleted boolean, data jsonb)
    on conflict (owner, tbl, id) do update
      set updated_at = excluded.updated_at, deleted = excluded.deleted, data = excluded.data, seq = nextval('sync_seq')
      where sync_rows.updated_at < excluded.updated_at`, [owner, JSON.stringify([...newest.values()])])

  const rows = await q(`select tbl, id, updated_at::float8 as "updatedAt", deleted, data, seq::float8 as seq
    from sync_rows where owner = $1 and seq > $2::bigint order by seq limit ${PAGE}`, [owner, since])
  return {
    status: 200,
    json: {
      seq: rows.length ? (rows[rows.length - 1].seq as number) : since,
      more: rows.length === PAGE,
      changes: rows.map((r) => ({ tbl: r.tbl, id: r.id, updatedAt: r.updatedAt, ...(r.deleted ? { deleted: true } : { data: r.data }) })),
    },
  }
}

let ready: Promise<void> | undefined

export async function POST(req: Request) {
  const sql = neon(process.env.DATABASE_URL!)
  const q: Query = (text, params) => sql.query(text, params) as Promise<Record<string, unknown>[]>
  ready ??= migrate(q).catch((e) => { ready = undefined; throw e })
  await ready
  const r = await handle(q, req.headers.get('authorization'), await req.json().catch(() => null))
  return Response.json(r.json, { status: r.status })
}
