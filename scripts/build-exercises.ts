// One-time: download free-exercise-db (Unlicense / public domain) and write src/data/exercises.seed.json.
// Run: npm run build:exercises
import { writeFileSync } from 'node:fs'

const SRC = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'

type Raw = {
  id: string; name: string; equipment: string | null; category: string
  primaryMuscles: string[]; secondaryMuscles: string[]; instructions: string[]; images: string[]
}

const DIRECT: Record<string, string> = {
  abdominals: 'abs', chest: 'chest', biceps: 'biceps', triceps: 'triceps', forearms: 'forearms',
  traps: 'traps', 'middle back': 'upper-back', lats: 'lats', 'lower back': 'lower-back',
  glutes: 'glutes', quadriceps: 'quads', hamstrings: 'hamstrings', adductors: 'adductors',
  abductors: 'abductors', calves: 'calves', neck: 'neck',
}

// The dataset only says "shoulders"; pick the head from the exercise name.
function delt(name: string): string {
  const n = name.toLowerCase()
  if (/rear|reverse fly|reverse flye|face pull|bent.over.*(raise|fly)|back fly/.test(n)) return 'rear-delts'
  if (/lateral|side raise|upright row|side lateral/.test(n)) return 'side-delts'
  return 'front-delts'
}

const CLASS: Record<string, string> = {
  'body only': 'Body Weight/Weighted', machine: 'Machine', barbell: 'Barbell', 'e-z curl bar': 'Barbell',
  dumbbell: 'Dumbbell', cable: 'Cable', kettlebells: 'Kettlebell', bands: 'Band',
}

export function mapMuscle(m: string, name: string): string {
  if (m === 'shoulders') return delt(name)
  const out = DIRECT[m]
  if (!out) throw new Error(`Unmapped muscle "${m}" in "${name}"`)
  return out
}

async function main() {
  const raw: Raw[] = await (await fetch(SRC)).json()
  const failures: string[] = []
  const out = raw.map((e) => {
    const map = (list: string[]) =>
      [...new Set(list.flatMap((m) => { try { return [mapMuscle(m, e.name)] } catch (err) { failures.push(String(err)); return [] } }))]
    const primary = map(e.primaryMuscles)
    if (/oblique|twist|side bend|woodchop|russian/i.test(e.name) && primary.includes('abs')) primary.push('obliques')
    const secondary = map(e.secondaryMuscles).filter((m) => !primary.includes(m))
    return {
      id: e.id, name: e.name, category: e.category, equipment: e.equipment ?? 'other',
      classification: CLASS[e.equipment ?? ''] ?? 'Other',
      primaryMuscles: primary, secondaryMuscles: secondary,
      instructions: e.instructions, images: e.images, isCustom: false, notes: '',
    }
  })
  if (failures.length) throw new Error('Fix the mapping:\n' + [...new Set(failures)].join('\n'))
  writeFileSync('src/data/exercises.seed.json', JSON.stringify(out))
  console.log(`Wrote ${out.length} exercises`)
}

main()
