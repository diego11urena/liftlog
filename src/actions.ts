// Every edit writes straight to IndexedDB, so the in-progress session is always autosaved.
import { db, isBodyweight, isTimed, uuid, type PlanSet, type Side, type Workout, type WorkoutExercise, type WSet } from './db'
import { bySetOrder, loggedSetsFor } from './hooks'
import { dateKey, detectPR, isLogged } from './lib'

const now = () => Date.now()
const touch = <T extends object>(o: T) => ({ ...o, updatedAt: now() })

// ---------- sessions ----------

export async function startSession(workout?: Workout, name?: string) {
  const active = await db.workoutLogs.where('status').equals('active').first()
  if (active) return active.id
  const logId = uuid()
  await db.transaction('rw', db.workoutLogs, db.workoutExercises, db.sets, async () => {
    await db.workoutLogs.add(touch({ id: logId, name: workout?.name ?? name ?? 'Freestyle', workoutId: workout?.id, startedAt: now(), status: 'active' as const, notes: '' }))
    for (const [i, e] of (workout?.exercises ?? []).entries()) await addExercise(logId, e.exerciseId, i, e.unilateral, e.sets)
  })
  return logId
}

/** Adds an exercise with empty set rows (placeholders come from last session / the saved workout). */
export async function addExercise(logId: string, exerciseId: string, order?: number, unilateral = false, planSets?: PlanSet[]) {
  const id = uuid()
  order ??= await db.workoutExercises.where('logId').equals(logId).count()
  await db.workoutExercises.add(touch({ id, logId, exerciseId, order, notes: '', unilateral, planSets }))
  const prior = (await loggedSetsFor(exerciseId)).filter((s) => s.logId !== logId)
  const lastId = prior.at(-1)?.logId
  const lastCount = new Set(prior.filter((s) => s.logId === lastId).map((s) => s.order)).size
  const planRows = planSets?.filter((s) => s.side !== 'L') // one entry per set number
  const n = planRows?.length || lastCount || 1
  for (let i = 0; i < n; i++) await addRows({ id, logId, exerciseId, unilateral }, i, !!planRows?.[i]?.isDrop)
  return id
}

async function addRows(we: Pick<WorkoutExercise, 'id' | 'logId' | 'exerciseId' | 'unilateral'>, order: number, isDrop = false, weight: number | null = null) {
  const sides: Side[] = we.unilateral ? ['R', 'L'] : [null]
  await db.sets.bulkAdd(sides.map((side) => touch({
    id: uuid(), workoutExerciseId: we.id, logId: we.logId, exerciseId: we.exerciseId, order, side, isDrop,
    weight, reps: null, durationSec: null, completedAt: 0, isPR: false,
  })))
}

const rowsOf = (weId: string) => db.sets.where('workoutExerciseId').equals(weId).toArray().then((r) => r.sort(bySetOrder))

export async function addSet(weId: string) {
  const we = (await db.workoutExercises.get(weId))!
  const rows = await rowsOf(weId)
  await addRows(we, (rows.at(-1)?.order ?? -1) + 1)
}

/** Drop set: a linked row at ~80% of the last weight, rounded to the weight step. */
export async function dropSet(weId: string, stepKg: number) {
  const we = (await db.workoutExercises.get(weId))!
  const rows = await rowsOf(weId)
  const lastW = [...rows].reverse().find((r) => r.weight != null)?.weight
  const w = lastW == null ? null : Math.max(0, Math.round((lastW * 0.8) / stepKg) * stepKg)
  await addRows(we, (rows.at(-1)?.order ?? -1) + 1, true, w)
}

export async function removeLastSet(weId: string) {
  const rows = await rowsOf(weId)
  const last = rows.at(-1)?.order
  if (last == null) return
  await db.sets.bulkDelete(rows.filter((r) => r.order === last).map((r) => r.id))
}

export async function setUnilateral(weId: string, on: boolean) {
  const rows = await rowsOf(weId)
  await db.transaction('rw', db.workoutExercises, db.sets, async () => {
    await db.workoutExercises.update(weId, touch({ unilateral: on }))
    if (on) {
      for (const r of rows.filter((r) => r.side === null)) {
        await db.sets.update(r.id, touch({ side: 'R' as Side }))
        await db.sets.add(touch({ ...r, id: uuid(), side: 'L' as Side, weight: null, reps: null, durationSec: null, completedAt: 0, isPR: false }))
      }
    } else {
      await db.sets.bulkDelete(rows.filter((r) => r.side === 'L').map((r) => r.id))
      for (const r of rows.filter((r) => r.side === 'R')) await db.sets.update(r.id, touch({ side: null as Side }))
    }
  })
}

/** Save a field and re-evaluate "logged" + PR for the row. */
export async function updateSet(id: string, patch: Partial<Pick<WSet, 'weight' | 'reps' | 'durationSec'>>) {
  const s = await db.sets.get(id)
  if (!s) return
  const next = { ...s, ...patch }
  const [ex, log] = await Promise.all([db.exercises.get(s.exerciseId), db.workoutLogs.get(s.logId)])
  const logged = !!ex && isLogged(next, { bodyweight: isBodyweight(ex), timed: isTimed(ex) })
  let completedAt = 0, isPR = false
  if (logged) {
    completedAt = s.completedAt || (log?.status === 'done' ? (log.endedAt ?? log.startedAt) : now())
    const prev = (await loggedSetsFor(s.exerciseId)).filter((p) => p.id !== id && p.completedAt <= completedAt && p.side === next.side)
    isPR = detectPR(prev, next).length > 0
  }
  await db.sets.update(id, touch({ ...patch, completedAt, isPR }))
}

export async function removeExercise(weId: string) {
  await db.transaction('rw', db.workoutExercises, db.sets, async () => {
    await db.sets.where('workoutExerciseId').equals(weId).delete()
    await db.workoutExercises.delete(weId)
  })
}

export async function replaceExercise(weId: string, exerciseId: string) {
  await db.transaction('rw', db.workoutExercises, db.sets, async () => {
    await db.workoutExercises.update(weId, touch({ exerciseId, planSets: undefined }))
    const rows = await db.sets.where('workoutExerciseId').equals(weId).toArray()
    await db.sets.bulkPut(rows.map((r) => touch({ ...r, exerciseId, weight: null, reps: null, durationSec: null, completedAt: 0, isPR: false })))
  })
}

export async function moveExercise(logId: string, weId: string, dir: -1 | 1) {
  const list = await db.workoutExercises.where('logId').equals(logId).sortBy('order')
  const i = list.findIndex((w) => w.id === weId), j = i + dir
  if (j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j], list[i]]
  await db.workoutExercises.bulkPut(list.map((w, k) => touch({ ...w, order: k })))
}

/** Ends the session: unlogged rows are dropped (a set only counts once both fields are filled). */
export async function finishSession(logId: string) {
  await db.transaction('rw', db.workoutLogs, db.sets, async () => {
    await db.sets.where('logId').equals(logId).filter((s) => !s.completedAt).delete()
    await db.workoutLogs.update(logId, touch({ status: 'done' as const, endedAt: now() }))
  })
}

export async function deleteLog(logId: string) {
  await db.transaction('rw', db.workoutLogs, db.workoutExercises, db.sets, async () => {
    await db.sets.where('logId').equals(logId).delete()
    await db.workoutExercises.where('logId').equals(logId).delete()
    await db.workoutLogs.delete(logId)
  })
}

/** "Save Workout" on the review screen: write this session back to its saved workout; session stays open. */
export async function saveSessionToWorkout(logId: string) {
  const log = (await db.workoutLogs.get(logId))!
  const wes = await db.workoutExercises.where('logId').equals(logId).sortBy('order')
  const exercises = await Promise.all(wes.map(async (we) => ({
    exerciseId: we.exerciseId, unilateral: we.unilateral,
    sets: (await rowsOf(we.id)).map((r): PlanSet => ({ weight: r.weight, reps: r.reps, durationSec: r.durationSec, side: r.side, isDrop: r.isDrop })),
  })))
  if (log.workoutId && (await db.workouts.get(log.workoutId))) {
    await db.workouts.update(log.workoutId, touch({ exercises }))
  } else {
    const id = uuid()
    await db.workouts.add(touch({ id, name: log.name, exercises }))
    await db.workoutLogs.update(logId, touch({ workoutId: id }))
  }
}

// ---------- saved workouts ----------

export async function createWorkout(name: string) {
  const id = uuid()
  await db.workouts.add(touch({ id, name, exercises: [] }))
  return id
}

export async function deleteWorkout(id: string) {
  await db.transaction('rw', db.workouts, db.plans, async () => {
    await db.plans.where('workoutId').equals(id).delete()
    await db.workouts.delete(id)
  })
}

// ---------- plans ----------

export type Selection = { type: 'rest' } | { type: 'workout'; workoutId: string }

/** Rest replaces everything on the day; anything else removes a rest plan. `replaceId` edits one page in place. */
export async function setPlan(date: string, sel: Selection, replaceId?: string) {
  await db.transaction('rw', db.plans, async () => {
    const day = await db.plans.where('date').equals(date).toArray()
    if (sel.type === 'rest') {
      await db.plans.bulkDelete(day.map((p) => p.id))
      await db.plans.add(touch({ id: uuid(), date, type: 'rest' as const }))
      return
    }
    await db.plans.bulkDelete(day.filter((p) => p.type === 'rest').map((p) => p.id))
    const row = { date, type: sel.type, workoutId: sel.type === 'workout' ? sel.workoutId : undefined }
    if (replaceId && day.some((p) => p.id === replaceId)) await db.plans.update(replaceId, touch(row))
    else await db.plans.add(touch({ id: uuid(), ...row }))
  })
}

export const removePlan = (id: string) => db.plans.delete(id)
export const todayKey = () => dateKey(now())

export async function eraseAll() {
  await db.delete()
  location.reload()
}
