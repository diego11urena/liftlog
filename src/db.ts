import Dexie, { type EntityTable } from 'dexie'

export { MUSCLE_GROUPS, MUSCLES, type Muscle } from './muscles'
import { upgradeMuscles, type Muscle } from './muscles'

type Row = { id: string; updatedAt: number }

export type Exercise = Row & {
  name: string; category: string; equipment: string; classification: string
  primaryMuscles: Muscle[]; secondaryMuscles: Muscle[]
  instructions: string[]; images: string[]; isCustom: boolean; notes: string
  aliases?: string[]
  /** logged as mm:ss instead of reps (holds, carries, activities) */
  timed?: boolean
}
/** A set as stored in a saved workout (the plan / "next time starts from these"). */
export type PlanSet = { weight: number | null; reps: number | null; durationSec?: number | null; side: Side; isDrop: boolean }
/** Saved workout definition ("Your Workouts"). Exercises are embedded and ordered. */
export type Workout = Row & { name: string; exercises: { exerciseId: string; unilateral: boolean; sets: PlanSet[] }[] }
export type Plan = Row & { date: string; type: 'workout' | 'rest' | 'activity'; workoutId?: string }
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

export const db = new Dexie('liftlog') as Dexie & {
  exercises: EntityTable<Exercise, 'id'>
  workouts: EntityTable<Workout, 'id'>
  plans: EntityTable<Plan, 'id'>
  workoutLogs: EntityTable<WorkoutLog, 'id'>
  workoutExercises: EntityTable<WorkoutExercise, 'id'>
  sets: EntityTable<WSet, 'id'>
  settings: EntityTable<Setting, 'key'>
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

// The DB was deleted or upgraded elsewhere (another tab, devtools, a newer build): this connection is dead and
// every query would come back empty. Reload to reconnect and re-seed.
db.on('versionchange', () => {
  db.close()
  location.reload()
  return false
})

// Bump when exercises.seed.json changes.
const SEED_VERSION = 6

type SeedRow = Omit<Exercise, 'updatedAt'> & { legacyIds?: string[] }

/** Loads the built-in list. Built-ins that left the list are remapped (history moves to the curated
 *  exercise that replaced them), kept as custom if they're in use, or removed if unused. */
export async function seed() {
  const v = (await db.settings.get('seedVersion'))?.value
  if (v === SEED_VERSION) return
  const data = (await import('./data/exercises.seed.json')).default as SeedRow[]
  const now = Date.now()
  await db.transaction('rw', [db.exercises, db.settings, db.workoutExercises, db.sets, db.workouts], async () => {
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
          isCustom: true, classification: o.classification ?? 'Other',
          primaryMuscles: upgradeMuscles(o.primaryMuscles), secondaryMuscles: upgradeMuscles(o.secondaryMuscles),
        })
      } else await db.exercises.delete(o.id)
    }
    await db.exercises.bulkPut(data.map(({ legacyIds: _, ...e }) => ({ ...e, notes: notes.get(e.id) ?? e.notes, updatedAt: now })))
    await db.settings.put({ key: 'seedVersion', value: SEED_VERSION })
  })
}

export const uuid = () => crypto.randomUUID()

export type Settings = { unit: 'kg' | 'lb'; weightStep: number | null }
export const DEFAULT_SETTINGS: Settings = { unit: 'kg', weightStep: null }
/** 2.5 kg / 5 lb unless overridden. */
export const stepFor = (s: Settings) => s.weightStep ?? (s.unit === 'kg' ? 2.5 : 5)

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  await db.settings.put({ key, value })
}

export const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'

/** Activities = cardio-type entries, shown under the library's "Activities" segment. */
export const isActivity = (e: Exercise) => e.category === 'cardio' || e.category === 'activity'
export const isBodyweight = (e: Exercise) => e.equipment === 'body only'
/** Holds and similar: logged as mm:ss instead of reps. */
export const isTimed = (e: Exercise) => e.timed ?? isActivity(e)
