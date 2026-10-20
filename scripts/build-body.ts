// One-time: turn MuscleMap's MIT-licensed male front/back path data (@musclemap/assets) into
// src/data/body.json with one path per canonical muscle region. See docs/ASSETS.md.
// Run: npm run build:body
import { writeFileSync } from 'node:fs'
import { MUSCLES } from '../src/muscles.ts'

type Diagram = { muscles: { id?: string; group: string; side: string; d: string }[]; outline: { d: string }[] }
type R = (typeof MUSCLES)[number]

// Region for each sub-shape ("M ..." segment) of each MuscleMap path, in drawing order. A `_LEFT`/`_RIGHT` key
// wins over the plain one: the two sides often list their shapes in different orders.
// Assigned by rendering every sub-shape of each side with a number and reading the figure.
const FRONT: Record<string, R[]> = {
  TRAPEZIUS: ['traps-upper'],
  CHEST: ['chest-upper'], // split into upper/lower below
  SHOULDER_FRONT: ['delt-front'],
  SHOULDER_SIDE: ['delt-side'],
  BICEPS: ['biceps'],
  TRICEPS: ['triceps-long'],
  FOREARM_LEFT: ['brachioradialis', 'brachialis', 'forearm-flexors', 'brachioradialis', 'forearm-flexors'],
  FOREARM_RIGHT: ['forearm-flexors', 'brachioradialis', 'brachioradialis', 'forearm-flexors'],
  CORE_LEFT: ['abs-upper', 'abs-upper', 'abs-lower', 'abs-lower'],
  CORE_RIGHT: ['abs-lower', 'abs-lower', 'abs-upper', 'abs-upper'], // right side is listed bottom-up
  OBLIQUE: ['obliques', 'serratus', 'serratus', 'serratus'],
  ABDUCTOR: ['quads-vastus-lateralis'], // front outer-thigh strip is the vastus lateralis
  QUADRICEPS_LEFT: ['quads-vastus-medialis', 'hip-flexors', 'quads-rectus-femoris'], // narrow strip = sartorius (hip flexor)
  QUADRICEPS_RIGHT: ['quads-vastus-medialis', 'quads-rectus-femoris', 'hip-flexors'],
  QUADS: ['quads-vastus-medialis'], // two unnamed teardrops above the knees
  QUADS_2: ['quads-vastus-medialis'],
  CALVES_LEFT: ['tibialis', 'soleus', 'calves-gastrocnemius', 'tibialis', 'tibialis'],
  CALVES_RIGHT: ['tibialis', 'tibialis', 'tibialis', 'calves-gastrocnemius'],
  ADDUCTOR: ['adductors'],
}
const BACK: Record<string, R[]> = {
  TRAPEZIUS: ['traps-upper'],
  TRAPEZIUS_2: ['traps-lower', 'rhomboids', 'traps-middle'], // second TRAPEZIUS path (the strips along the spine)
  SHOULDER_REAR: ['delt-rear'],
  SHOULDER_SIDE: ['delt-side'],
  TRICEPS_LEFT: ['triceps-long', 'triceps-medial', 'triceps-lateral'],
  TRICEPS_RIGHT: ['triceps-medial', 'triceps-long', 'triceps-lateral'],
  FOREARM_LEFT: ['forearm-extensors', 'forearm-extensors', 'forearm-extensors', 'brachioradialis', 'brachioradialis'],
  FOREARM_RIGHT: ['forearm-extensors', 'forearm-extensors', 'brachioradialis', 'brachioradialis', 'forearm-extensors'],
  RHOMBOID: ['teres', 'rotator-cuff', 'rotator-cuff', 'rotator-cuff'], // these sit on the shoulder blade
  LATISSIMUS: ['lats', 'lats'],
  LOWER_BACK: ['erector-spinae'],
  OBLIQUE: ['obliques', 'obliques'],
  GLUTEUS: ['glutes-max', 'glutes-max', 'glutes-med'],
  ABDUCTOR: ['abductors', 'abductors'],
  ADDUCTOR: ['adductors'],
  HAMSTRINGS: ['hamstrings-biceps-femoris', 'hamstrings-biceps-femoris', 'hamstrings-semitendinosus'],
  CALVES_LEFT: ['soleus', 'calves-gastrocnemius', 'soleus', 'calves-gastrocnemius'],
  CALVES_RIGHT: ['soleus', 'soleus', 'calves-gastrocnemius', 'calves-gastrocnemius'],
}

export type BodyPath = { r: R; d: string; side: 'L' | 'R'; clip?: { y: number; keep: 'above' | 'below' } }

function convert(diag: Diagram, table: Record<string, R[]>) {
  const seen = new Map<string, number>()
  const out: BodyPath[] = []
  for (const mu of diag.muscles) {
    const id = mu.id ?? mu.group
    const base = id.replace(/_(LEFT|RIGHT)$/, '')
    const side = /RIGHT/.test(id) ? 'R' : 'L'
    const n = (seen.get(id) ?? 0) + 1
    seen.set(id, n)
    const name = n > 1 ? `${base}_${n}` : base
    const key = [`${name}_${side === 'R' ? 'RIGHT' : 'LEFT'}`, name].find((k) => table[k])
    if (!key) throw new Error(`No mapping for ${id} (#${n})`)
    const subs = mu.d.split(/(?=M)/).map((s) => s.trim())
    const regions = table[key]
    if (subs.length !== regions.length) throw new Error(`${id}: ${subs.length} shapes but ${regions.length} regions mapped`)
    subs.forEach((d, k) => {
      if (base === 'CHEST') {
        // one chest shape → upper/lower halves via a horizontal clip at 45% of its height
        const ys = (d.match(/-?\d+\.?\d*/g) ?? []).map(Number).filter((_, i) => i % 2 === 1)
        const y = Math.round(Math.min(...ys) + 0.45 * (Math.max(...ys) - Math.min(...ys)))
        out.push({ r: 'chest-upper', d, side, clip: { y, keep: 'above' } }, { r: 'chest-lower', d, side, clip: { y, keep: 'below' } })
      } else out.push({ r: regions[k], d, side })
    })
  }
  return out
}

const { MALE_FRONT, MALE_BACK } = await import('@musclemap/assets')
const [front, back] = [MALE_FRONT as unknown as Diagram, MALE_BACK as unknown as Diagram]
const body = {
  viewBox: '165 25 695 1455',
  front: { outline: front.outline.map((o) => o.d), muscles: convert(front, FRONT) },
  back: { outline: back.outline.map((o) => o.d), muscles: convert(back, BACK) },
}
const drawn = new Set([...body.front.muscles, ...body.back.muscles].map((m) => m.r))
console.log('Regions without their own art:', MUSCLES.filter((m) => !drawn.has(m)).join(', ') || 'none')
writeFileSync('src/data/body.json', JSON.stringify(body))
console.log(`Wrote src/data/body.json (${body.front.muscles.length} front + ${body.back.muscles.length} back paths)`)
