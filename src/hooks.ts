import Dexie from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Exercise, type Muscle, type WorkoutExercise, type WorkoutLog, type WSet } from './db'
import { bests, dateKey, streaks, volume } from './lib'

export function useExercises() {
  return useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e])), []) ?? new Map<string, Exercise>()
}

/** Logged sets of an exercise, oldest first (index order). */
export const loggedSetsFor = (exerciseId: string) =>
  db.sets.where('[exerciseId+completedAt]').between([exerciseId, 1], [exerciseId, Dexie.maxKey]).toArray()

/** Last session before `beforeTs` (excluding `logId`) + all-time bests. Live. */
export function useExerciseHistory(exerciseId: string, logId: string, beforeTs: number) {
  return useLiveQuery(async () => {
    const all = await loggedSetsFor(exerciseId)
    const prior = all.filter((s) => s.logId !== logId && s.completedAt < beforeTs)
    let last: { date: number; sets: WSet[] } | null = null
    if (prior.length) {
      const lastId = prior[prior.length - 1].logId
      const sets = prior.filter((s) => s.logId === lastId).sort(bySetOrder)
      last = { date: sets[sets.length - 1].completedAt, sets }
    }
    return { last, ...bests(all), count: all.length }
  }, [exerciseId, logId, beforeTs])
}

export const bySetOrder = (a: WSet, b: WSet) => a.order - b.order || (a.side ?? '').localeCompare(b.side ?? '') * -1 // R before L

/** Summary of one logged session. */
export async function logSummary(logId: string, exercises: Map<string, Exercise>) {
  const sets = (await db.sets.where('logId').equals(logId).toArray()).filter((s) => s.completedAt)
  return { sets, volume: volume(sets), prs: sets.filter((s) => s.isPR), ...musclesOf(sets.map((s) => s.exerciseId), exercises) }
}

/** Union of muscles across exercises; a muscle that's primary anywhere is primary. */
export function musclesOf(exerciseIds: string[], exercises: Map<string, Exercise>) {
  const primary = new Set<Muscle>(), secondary = new Set<Muscle>()
  for (const id of new Set(exerciseIds)) {
    const e = exercises.get(id)
    e?.primaryMuscles.forEach((m) => primary.add(m))
    e?.secondaryMuscles.forEach((m) => secondary.add(m))
  }
  return { primary: [...primary], secondary: [...secondary].filter((m) => !primary.has(m)) }
}

export const useActiveLog = () => useLiveQuery(async () => (await db.workoutLogs.where('status').equals('active').first()) ?? null, [])

/** Per-day status for the week strip, keyed by YYYY-MM-DD. */
export function useWeekStatus(from: number, to: number) {
  return useLiveQuery(async () => {
    const [plans, logs] = await Promise.all([
      db.plans.where('date').between(dateKey(from), dateKey(to), true, true).toArray(),
      db.workoutLogs.where('startedAt').between(from, to + 86400e3).filter((l) => l.status === 'done').toArray(),
    ])
    const out: Record<string, 'done' | 'rest' | 'planned'> = {}
    for (const p of plans) out[p.date] ??= p.type === 'rest' ? 'rest' : 'planned'
    for (const l of logs) out[dateKey(l.startedAt)] = 'done'
    return out
  }, [from, to]) ?? {}
}

/** Gym streak and best streak, derived from the plans and done logs. */
export function useStreak() {
  return useLiveQuery(async () => {
    const [plans, logs] = await Promise.all([db.plans.toArray(), db.workoutLogs.where('status').equals('done').toArray()])
    return streaks(plans, logs, dateKey(Date.now()))
  }, []) ?? { current: 0, best: 0 }
}

/** Older "note for next time" entries aren't surfaced (they'd be stale). */
const NOTE_MAX_AGE = 30 * 86400e3

/** Per exercise, the newest unhandled note from an earlier finished session (never the session it was written in). */
export async function pendingNotes(log: WorkoutLog, exerciseIds: string[]) {
  const rows = await db.workoutExercises.where('exerciseId').anyOf(exerciseIds)
    .filter((w) => w.logId !== log.id && !!w.notes?.trim() && !w.noteHandledInLogId).toArray()
  const logs = new Map((await db.workoutLogs.bulkGet([...new Set(rows.map((r) => r.logId))])).flatMap((l) => (l ? [[l.id, l] as const] : [])))
  const out = new Map<string, { we: WorkoutExercise; date: number }>()
  for (const we of rows) {
    const l = logs.get(we.logId)
    if (!l || l.status !== 'done' || l.startedAt >= log.startedAt || l.startedAt < log.startedAt - NOTE_MAX_AGE) continue
    if (l.startedAt > (out.get(we.exerciseId)?.date ?? 0)) out.set(we.exerciseId, { we, date: l.startedAt })
  }
  return out
}

export function usePendingNotes(log: WorkoutLog | undefined, exerciseIds: string[]) {
  return useLiveQuery(async () => (log?.status === 'active' ? pendingNotes(log, exerciseIds) : new Map<string, { we: WorkoutExercise; date: number }>()),
    [log?.id, log?.status, exerciseIds.join()]) ?? new Map<string, { we: WorkoutExercise; date: number }>()
}
