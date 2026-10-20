import Dexie, { type EntityTable } from 'dexie'

export { MUSCLE_GROUPS, MUSCLES, type Muscle } from './muscles'
import { upgradeMuscles, type Muscle } from './muscles'

type Row = { id: string; updatedAt: number }

export type Exercise = Row & {
  name: string; category: string; equipment: string; classification: string
  primaryMuscles: Muscle[]; secondaryMuscles: Muscle[]
  instructions: string[]; images: string[]; isCustom: boolean; notes: string
  aliases?: string[]
  /** logged as mm:ss instead of reps (holds, carries) */
  timed?: boolean
  unit?: Unit
}
/** A set as stored in a saved workout (the plan / "next time starts from these"). */
export type PlanSet = { weight: number | null; reps: number | null; durationSec?: number | null; side: Side; isDrop: boolean }
/** Saved workout definition ("Your Workouts"). Exercises are embedded and ordered. */
export type Workout = Row & { name: string; exercises: { exerciseId: string; unilateral: boolean; sets: PlanSet[] }[] }
export type Plan = Row & { date: string; type: 'workout' | 'rest'; workoutId?: string }
/** One logged session. */
export type WorkoutLog = Row & {
  name: string; workoutId?: string; startedAt: number; endedAt?: number; status: 'active' | 'done'; notes: string
}
export type WorkoutExercise = Row & {
  logId: string; exerciseId: string; order: number; notes: string; unilateral: boolean
  /** copied from the saved workout at start: placeholder fallback when there's no last session */
  planSets?: PlanSet[]
}
export type Side = 'R' | 'L' | null
export type WSet = Row & {
  workoutExerciseId: string; logId: string; exerciseId: string; order: number; side: Side; isDrop: boolean
  weight: number | null; reps: number | null; durationSec: number | null
  /** 0 until the set is logged (weight/BW + reps or time filled) */
  completedAt: number; isPR: boolean
}
export type Setting = { key: string; value: unknown }
/** A local delete, kept until it's been sent to the sync server. */
export type Tombstone = { key: string; tbl: string; id: string; deletedAt: number }

export const db = new Dexie('liftlog') as Dexie & {
  exercises: EntityTable<Exercise, 'id'>
  workouts: EntityTable<Workout, 'id'>
  plans: EntityTable<Plan, 'id'>
  workoutLogs: EntityTable<WorkoutLog, 'id'>
  workoutExercises: EntityTable<WorkoutExercise, 'id'>
  sets: EntityTable<WSet, 'id'>
  settings: EntityTable<Setting, 'key'>
  tombstones: EntityTable<Tombstone, 'key'>
}

db.version(1).stores({
  exercises: 'id, name',
  workouts: 'id, name',
  plans: 'id, date, workoutId',
  workoutLogs: 'id, status, startedAt, workoutId',
  workoutExercises: 'id, logId, exerciseId',
  sets: 'id, workoutExerciseId, logId, [exerciseId+completedAt]',
  settings: 'key',
})
db.version(2).stores({ tombstones: 'key, deletedAt' })

/** While on, writes aren't re-stamped or logged for sync: applying another device's changes, and the local seed. */
export const quiet = { on: false }
export async function quietly<T>(fn: () => Promise<T>) {
  quiet.on = true
  try { return await fn() } finally { quiet.on = false }
}


// The DB was deleted or upgraded elsewhere (another tab, devtools, a newer build): this connection is dead and
// every query would come back empty. Reload to reconnect and re-seed.
db.on('versionchange', () => {
  db.close()
  location.reload()
  return false
})

// Bump when exercises.seed.json changes.
const SEED_VERSION = 8

type SeedRow = Omit<Exercise, 'updatedAt'> & { legacyIds?: string[] }

/** Loads the built-in list. Built-ins that left the list are remapped (history moves to the curated
 *  exercise that replaced them), kept as custom if they're in use, or removed if unused. */
export async function seed() {
  const v = (await db.settings.get('seedVersion'))?.value
  if (v === SEED_VERSION) return
  const data = (await import('./data/exercises.seed.json')).default as SeedRow[]
  // every device runs this itself, so none of it is synced
  await quietly(() => db.transaction('rw', [db.exercises, db.settings, db.workoutExercises, db.sets, db.workouts, db.plans], async () => {
    // Activities were removed (owner, 2026-10-19); drop any leftover activity plans
    await db.plans.filter((p) => (p.type as string) === 'activity').delete()
    // The app-wide kg/lb setting became per-exercise (2026-10-19): carry an old "lb" choice over, then drop it
    const oldUnit = (await db.settings.get('unit'))?.value
    await db.settings.bulkDelete(['unit', 'weightStep'])
    const old = await db.exercises.toArray()
    const notes = new Map(old.map((e) => [e.id, e.notes]))
    const ids = new Set(data.map((e) => e.id))
    const replacedBy = new Map(data.flatMap((e) => (e.legacyIds ?? []).map((l) => [l, e.id] as const)))
    const saved = await db.workouts.toArray()
    const used = new Set([...(await db.workoutExercises.toArray()).map((w) => w.exerciseId), ...saved.flatMap((w) => w.exercises.map((x) => x.exerciseId))])

    for (const o of old) {
      if (ids.has(o.id)) continue
      const to = o.isCustom ? undefined : replacedBy.get(o.id)
      if (to) {
        await db.workoutExercises.where('exerciseId').equals(o.id).modify({ exerciseId: to })
        await db.sets.where('[exerciseId+completedAt]').between([o.id, -Infinity], [o.id, Infinity]).modify({ exerciseId: to })
        for (const w of saved) if (w.exercises.some((x) => x.exerciseId === o.id))
          await db.workouts.update(w.id, { exercises: w.exercises.map((x) => (x.exerciseId === o.id ? { ...x, exerciseId: to } : x)) })
        if (!notes.get(to)) notes.set(to, o.notes)
        await db.exercises.delete(o.id)
      } else if (o.isCustom || used.has(o.id)) {
        await db.exercises.update(o.id, {
          isCustom: true, category: 'strength', classification: o.classification === 'Cardio' ? 'Other' : (o.classification ?? 'Other'),
          primaryMuscles: upgradeMuscles(o.primaryMuscles), secondaryMuscles: upgradeMuscles(o.secondaryMuscles),
        })
      } else await db.exercises.delete(o.id)
    }
    const prev = new Map(old.map((e) => [e.id, e]))
    // built-ins keep their old timestamp (new ones get 1) so a reseed never beats a real edit synced from another device
    await db.exercises.bulkPut(data.map(({ legacyIds: _, ...e }) => ({
      ...e, notes: notes.get(e.id) ?? e.notes, unit: prev.get(e.id)?.unit ?? (oldUnit === 'lb' ? 'lb' as const : undefined),
      updatedAt: prev.get(e.id)?.updatedAt ?? 1,
    })))
    if (oldUnit === 'lb') await db.exercises.filter((e) => e.isCustom && !e.unit).modify({ unit: 'lb' })
    await db.settings.put({ key: 'seedVersion', value: SEED_VERSION })
  }))
}

export const uuid = () => crypto.randomUUID()

export type Unit = 'kg' | 'lb'
/** Weights are stored in kg; each exercise remembers the unit it's shown/entered in (default kg). */
export const unitOf = (e?: { unit?: Unit }): Unit => e?.unit ?? 'kg'

export const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'

export const isBodyweight = (e: Exercise) => e.equipment === 'body only'
/** Holds and similar: logged as mm:ss instead of reps. */
export const isTimed = (e: Exercise) => !!e.timed
