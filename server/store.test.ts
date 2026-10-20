import { expect, test } from 'vitest'
import { openStore } from './store'

test('last write wins, deletes win when newer, pull is incremental', () => {
  const s = openStore(':memory:')
  s.push([{ tbl: 'workouts', id: 'w1', updatedAt: 100, data: { name: 'Push' } }])
  s.push([{ tbl: 'workouts', id: 'w1', updatedAt: 50, data: { name: 'stale' } }]) // older: ignored
  let r = s.pull(0)
  expect(r.changes).toEqual([{ tbl: 'workouts', id: 'w1', updatedAt: 100, data: { name: 'Push' } }])

  const seen = r.seq
  s.push([{ tbl: 'workouts', id: 'w1', updatedAt: 200, data: { name: 'Push v2' } }, { tbl: 'sets', id: 's1', updatedAt: 200, data: { reps: 8 } }])
  r = s.pull(seen)
  expect(r.changes.map((c) => c.id)).toEqual(['w1', 's1']) // only what changed since
  expect(s.pull(r.seq).changes).toEqual([])

  s.push([{ tbl: 'sets', id: 's1', updatedAt: 300, deleted: true }])
  expect(s.pull(r.seq).changes).toEqual([{ tbl: 'sets', id: 's1', updatedAt: 300, deleted: true }])
})

test('rejects malformed rows', () => {
  const s = openStore(':memory:')
  expect(s.valid({ tbl: 'workouts', id: 'a', updatedAt: 1, data: {} })).toBe(true)
  expect(s.valid({ tbl: 'settings', id: 'a', updatedAt: 1, data: {} })).toBe(false) // not a synced table
  expect(s.valid({ tbl: 'sets', id: '', updatedAt: 1, data: {} })).toBe(false)
  expect(s.valid({ tbl: 'sets', id: 'a', updatedAt: NaN, data: {} })).toBe(false)
  expect(s.valid({ tbl: 'sets', id: 'a', updatedAt: 1 })).toBe(false)
})
