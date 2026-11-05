import 'fake-indexeddb/auto'
import { beforeEach, expect, test, vi } from 'vitest'
import { db } from './db'
import { backupCode, fmtCode, isCode, normalizeCode, restoreBackup, sync } from './sync'

const CODE = 'ABCD'.repeat(6)
type Req = { since: number; changes: { tbl: string; id: string }[] }
let sent: { auth: string; body: Req }[], reply: (b: Req, auth: string) => unknown

beforeEach(async () => {
  await Promise.all([db.settings.clear(), db.workouts.clear()])
  sent = []
  reply = (b) => ({ seq: b.since, more: false, changes: [] })
  vi.stubGlobal('fetch', async (_: string, o: { headers: Record<string, string>; body: string }) => {
    const body = JSON.parse(o.body) as Req, auth = o.headers.authorization
    sent.push({ auth, body })
    return new Response(JSON.stringify(reply(body, auth)))
  })
})

test('codes: 24 unambiguous characters, forgiving to type', async () => {
  const code = await backupCode()
  expect(isCode(code)).toBe(true)
  expect(await backupCode()).toBe(code) // stable
  expect(normalizeCode(fmtCode(code).toLowerCase())).toBe(code)
  expect(normalizeCode('o0-il')).toBe('0011')
  expect(isCode('SHORT')).toBe(false)
})

test('sync sends the code and the rows, but not untouched built-ins; marks the backup time', async () => {
  await db.workouts.add({ id: 'w', name: 'Push', exercises: [], updatedAt: 500 })
  await db.exercises.put({ id: 'builtin', name: 'x', updatedAt: 1 } as never)
  expect(await sync()).toBe(true)
  expect(sent[0].auth).toBe(`Bearer ${await backupCode()}`)
  expect(sent[0].body.changes.map((c) => c.id)).toEqual(['w'])
  expect(((await db.settings.get('sync'))?.value as { backedUpAt: number }).backedUpAt).toBeGreaterThan(0)
})

test('a long history goes up in batches', async () => {
  await db.workouts.bulkAdd(Array.from({ length: 2500 }, (_, i) => ({ id: `w${i}`, name: 'x', exercises: [], updatedAt: 500 })))
  await sync()
  expect(sent.map((s) => s.body.changes.length)).toEqual([1000, 1000, 500])
})

test('restore: a typo or an unknown code changes nothing; a real one brings the rows back and joins local data', async () => {
  const own = await backupCode()
  await db.workouts.add({ id: 'local', name: 'Mine', exercises: [], updatedAt: 500 })
  expect(await restoreBackup('nope')).toBe('bad')
  expect(await restoreBackup(CODE)).toBe('empty')
  expect(await backupCode()).toBe(own)

  const row = { tbl: 'workouts', id: 'old', updatedAt: 400, data: { id: 'old', name: 'Legs', exercises: [], updatedAt: 400 } }
  reply = (b) => ({ seq: 7, more: false, changes: b.since === 0 ? [row] : [] })
  expect(await restoreBackup(fmtCode(CODE).toLowerCase())).toBe('ok')
  expect(await backupCode()).toBe(CODE)
  expect((await db.workouts.get('old'))?.name).toBe('Legs')
  expect(sent.at(-1)?.auth).toBe(`Bearer ${CODE}`)
  expect(sent.at(-1)?.body.changes.map((c) => c.id)).toContain('local')
  expect((await db.settings.get('backupCodeSaved'))?.value).toBe(true)
})

test('offline: the phone keeps working and the restore says so', async () => {
  vi.stubGlobal('fetch', async () => { throw new Error('offline') })
  expect(await sync()).toBe(false)
  expect(await restoreBackup(CODE)).toBe('offline')
})
