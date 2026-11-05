import { PGlite } from '@electric-sql/pglite'
import { beforeAll, expect, test } from 'vitest'
import { handle, migrate, type Query } from '../api/sync.ts'

const A = 'Bearer ' + 'A'.repeat(24), B = 'Bearer ' + 'B'.repeat(24)
const pg = new PGlite()
const q: Query = async (text, params) => (await pg.query(text, params)).rows as Record<string, unknown>[]
const row = (id: string, updatedAt: number, name = id) => ({ tbl: 'workouts', id, updatedAt, data: { id, name } })

beforeAll(() => migrate(q))

test('a code only ever sees its own rows; a wrong code is refused', async () => {
  await handle(q, A, { changes: [row('a1', 10)] })
  await handle(q, B, { changes: [row('b1', 10)] })
  expect((await handle(q, A, {})).json.changes?.map((c) => c.id)).toEqual(['a1'])
  expect((await handle(q, B, {})).json.changes?.map((c) => c.id)).toEqual(['b1'])
  for (const bad of [null, 'Bearer short', 'Bearer ' + 'I'.repeat(24)]) expect((await handle(q, bad, {})).status).toBe(401)
})

test('the code itself is never stored', async () => {
  const owners = (await q('select distinct owner from sync_rows')).map((r) => r.owner as string)
  expect(owners.length).toBeGreaterThan(0)
  for (const o of owners) { expect(o).toMatch(/^[0-9a-f]{64}$/); expect(o).not.toContain('AAAA') }
})

test('last write wins, deletes travel, pull is incremental, one row plus its delete in a batch works', async () => {
  const C = 'Bearer ' + 'C'.repeat(24)
  const first = await handle(q, C, { changes: [row('w', 100, 'new')] })
  await handle(q, C, { changes: [row('w', 50, 'stale')] })
  const all = await handle(q, C, {})
  expect(all.json.changes).toEqual([{ tbl: 'workouts', id: 'w', updatedAt: 100, data: { id: 'w', name: 'new' } }])
  expect((await handle(q, C, { since: first.json.seq })).json.changes).toEqual([])

  const r = await handle(q, C, { since: first.json.seq, changes: [row('w', 200), { tbl: 'workouts', id: 'w', updatedAt: 300, deleted: true }] })
  expect(r.json.changes).toEqual([{ tbl: 'workouts', id: 'w', updatedAt: 300, deleted: true }])
})

test('rejects bad payloads and unknown tables', async () => {
  for (const body of [{ since: -1 }, { changes: 'x' }, { changes: [{ tbl: 'nope', id: 'x', updatedAt: 1, data: {} }] }, { changes: [{ tbl: 'sets', id: '', updatedAt: 1, data: {} }] }, { changes: [{ tbl: 'sets', id: 'x', updatedAt: 1.5, data: {} }] }])
    expect((await handle(q, A, body)).status).toBe(400)
})

test('large histories page', async () => {
  const D = 'Bearer ' + 'D'.repeat(24)
  for (let i = 0; i < 3; i++) await handle(q, D, { changes: Array.from({ length: 1000 }, (_, k) => row(`r${i}-${k}`, 5)) })
  const p1 = await handle(q, D, {})
  expect(p1.json.changes).toHaveLength(2000); expect(p1.json.more).toBe(true)
  const p2 = await handle(q, D, { since: p1.json.seq })
  expect(p2.json.changes).toHaveLength(1000); expect(p2.json.more).toBe(false)
})
