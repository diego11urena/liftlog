// Validates scripts/curated-exercises.json. Run: npm run check:exercises (build:exercises runs it too).
import { readFileSync } from 'node:fs'
import { MUSCLES, SHORTHAND } from '../src/muscles.ts'

export type Curated = {
  name: string; aliases: string[]; classification: string; primaryMuscles: string[]; secondaryMuscles: string[]
  timed?: boolean
}

import { CLASSIFICATIONS } from '../src/muscles.ts'

// CLAUDE.md "Must include at minimum": each needs a name or alias containing this text.
const REQUIRED = [
  'pec deck', 'reverse pec deck', 'cable fly', 'cable crossover', 'dumbbell fly', 'bench press', 'dumbbell bench press', 'incline bench',
  'decline bench', 'chest press machine', 'lat pulldown', 'seated cable row', 't-bar row', 'leg press', 'hack squat', 'leg extension',
  'seated leg curl', 'lying leg curl', 'abductor machine', 'adductor machine', 'standing calf raise', 'seated calf raise',
  'shoulder press machine', 'dumbbell shoulder press', 'dumbbell lateral raise', 'cable lateral raise', 'lateral raise machine',
  'face pull', 'preacher curl', 'hammer curl', 'triceps rope pushdown', 'overhead cable triceps extension', 'dips', 'pull-up',
  'deadlift', 'romanian deadlift', 'hip thrust', 'glute bridge', 'cable kickback', 'ab crunch machine', 'cable crunch',
  'hanging leg raise', 'plank',
]

export const expand = (list: string[]) => [...new Set(list.flatMap((m) => SHORTHAND[m] ?? [m]))]

export function check(entries: Curated[]): string[] {
  const problems: string[] = []
  const valid = new Set<string>([...MUSCLES, ...Object.keys(SHORTHAND)])
  for (const e of entries) {
    const who = e.name || JSON.stringify(e).slice(0, 40)
    if (!e.name?.trim()) problems.push(`${who}: missing name`)
    if (!e.aliases?.length) problems.push(`${who}: no aliases`)
    if (!CLASSIFICATIONS.includes(e.classification)) problems.push(`${who}: bad classification "${e.classification}"`)
    if (!e.primaryMuscles?.length) problems.push(`${who}: no primary muscles`)
    for (const m of [...(e.primaryMuscles ?? []), ...(e.secondaryMuscles ?? [])]) if (!valid.has(m)) problems.push(`${who}: unknown muscle "${m}"`)
  }
  const text = entries.map((e) => [e.name, ...e.aliases].join(' | ').toLowerCase().replace(/-/g, ' '))
  for (const r of REQUIRED) if (!text.some((t) => t.includes(r.replace(/-/g, ' ')))) problems.push(`required exercise missing: "${r}"`)
  return problems
}

if (process.argv[1] === import.meta.filename) {
  const entries: Curated[] = JSON.parse(readFileSync('scripts/curated-exercises.json', 'utf8'))
  const problems = check(entries)
  console.log(problems.length ? problems.join('\n') : `OK: ${entries.length} curated exercises, all complete`)
  process.exit(problems.length ? 1 : 0)
}
