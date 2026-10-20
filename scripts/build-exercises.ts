// Curated list (scripts/curated-exercises.json) → src/data/exercises.seed.json. No network, no third-party data:
// exercises have no how-to text or photos (owner decision 2026-10-19). Run: npm run build:exercises
import { readFileSync, writeFileSync } from 'node:fs'
import { check, expand, type Curated } from './check-exercises.ts'

const slug = (s: string) => s.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const curated: Curated[] = JSON.parse(readFileSync('scripts/curated-exercises.json', 'utf8'))
const problems = check(curated)
if (problems.length) throw new Error('Curated list incomplete (npm run check:exercises):\n' + problems.join('\n'))

const out = curated.map((c) => {
  const primary = expand(c.primaryMuscles)
  return {
    id: slug(c.name), name: c.name, aliases: c.aliases, category: 'strength', classification: c.classification,
    equipment: c.classification === 'Body Weight/Weighted' ? 'body only' : c.classification.toLowerCase(),
    primaryMuscles: primary, secondaryMuscles: expand(c.secondaryMuscles).filter((m) => !primary.includes(m)),
    instructions: [], images: [], isCustom: false, notes: '',
    ...(c.timed && { timed: true }),
  }
})
writeFileSync('src/data/exercises.seed.json', JSON.stringify(out))
console.log(`Wrote ${out.length} exercises`)
