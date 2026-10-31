import 'fake-indexeddb/auto'
import { afterAll, beforeAll, expect, test, vi } from 'vitest'
import { addExercise, deleteLog, finishSession, markNoteDone, startSession, updateSet } from './actions'
import { db } from './db'
import { pendingNotes } from './hooks'

const DAY = 86400e3
const mon = new Date(2026, 10, 2, 9).getTime() // Mon 2026-11-02 09:00
beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  await db.exercises.bulkAdd([
    { id: 'pec', name: 'Pec Deck', equipment: 'machine' }, { id: 'row', name: 'Row', equipment: 'machine' },
  ] as never[])
})
afterAll(() => vi.useRealTimers())

/** One session on `day` offset from Monday; returns what the pec-deck note looks like at its start. */
async function session(day: number, opts: { logPec: boolean; note?: string }) {
  vi.setSystemTime(mon + day * DAY)
  const logId = await startSession(undefined, 'Day')
  const pec = await addExercise(logId, 'pec')
  const row = await addExercise(logId, 'row')
  const log = (await db.workoutLogs.get(logId))!
  const seen = [...(await pendingNotes(log, ['pec', 'row'])).keys()]
  if (opts.note) await db.workoutExercises.update(pec, { notes: opts.note })
  const setOf = async (we: string) => (await db.sets.where('workoutExerciseId').equals(we).first())!.id
  await updateSet(await setOf(row), { weight: 50, reps: 10 })
  if (opts.logPec) await updateSet(await setOf(pec), { weight: 40, reps: 12 })
  return { logId, seen }
}

test('next-time note: hidden where written, shown next session, handled only if a set was logged', async () => {
  const a = await session(0, { logPec: true, note: 'seat one notch higher' }) // Monday
  expect(a.seen).toEqual([]) // never in the session it was written in
  await finishSession(a.logId)

  const b = await session(2, { logPec: false }) // Wednesday: skips pec deck
  expect(b.seen).toEqual(['pec'])
  await finishSession(b.logId)

  const c = await session(4, { logPec: true }) // Friday: still carried over
  expect(c.seen).toEqual(['pec'])
  await finishSession(c.logId) // pec set logged -> handled

  const d = await session(6, { logPec: true })
  expect(d.seen).toEqual([]) // Sunday: gone
  await finishSession(d.logId)
  expect((await db.workoutExercises.filter((w) => w.notes === 'seat one notch higher').toArray()).length).toBe(1) // not deleted
})

test('discarding a session handles nothing, even after Done; Done hides it; old notes are skipped', async () => {
  const a = await session(10, { logPec: true, note: 'drop the weight' })
  await finishSession(a.logId)
  const b = await session(12, { logPec: true })
  expect(b.seen).toEqual(['pec'])
  const shown = (await pendingNotes((await db.workoutLogs.get(b.logId))!, ['pec'])).get('pec')!
  await markNoteDone(shown.we.id, b.logId)
  expect([...(await pendingNotes((await db.workoutLogs.get(b.logId))!, ['pec'])).keys()]).toEqual([])
  await deleteLog(b.logId) // discard
  const c = await session(14, { logPec: false })
  expect(c.seen).toEqual(['pec']) // came back
  await deleteLog(c.logId)

  const late = await session(10 + 31, { logPec: false }) // 31 days after the note was written
  expect(late.seen).toEqual([])
})
