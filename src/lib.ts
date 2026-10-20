// Pure logic: no DB, no React. Covered by lib.test.ts.

export type SetLike = { weight: number | null; reps: number | null }

/** Estimated 1RM (Epley). */
export function e1rm(weight: number, reps: number): number {
  if (!weight || !reps) return 0
  return reps === 1 ? weight : weight * (1 + reps / 30)
}

/** Heaviest weight (ties → most reps) and best e1RM. Bodyweight (null) sets count as 0. */
export function bests(sets: SetLike[]) {
  let top: { weight: number | null; reps: number } | null = null
  let best1rm = 0
  for (const s of sets) {
    if (!s.reps) continue
    const w = s.weight ?? 0, tw = top?.weight ?? 0
    if (!top || w > tw || (w === tw && s.reps > top.reps)) top = { weight: s.weight, reps: s.reps }
    best1rm = Math.max(best1rm, e1rm(w, s.reps))
  }
  return { top, e1rm: best1rm }
}

export type PRKind = 'weight' | 'e1rm' | 'reps'

/** Which records `cur` beats compared to earlier sets. A first-ever set is not a PR. */
export function detectPR(prev: SetLike[], cur: SetLike): PRKind[] {
  if (!cur.reps) return []
  const p = prev.filter((s) => s.reps)
  if (!p.length) return []
  const w = cur.weight ?? 0, ws = p.map((s) => s.weight ?? 0)
  const out: PRKind[] = []
  if (w > 0 && w > Math.max(...ws)) out.push('weight')
  if (w > 0 && e1rm(w, cur.reps) > Math.max(...p.map((s) => e1rm(s.weight ?? 0, s.reps!))) + 1e-9) out.push('e1rm')
  const atOrAbove = p.filter((s) => (s.weight ?? 0) >= w)
  if (atOrAbove.length && cur.reps > Math.max(...atOrAbove.map((s) => s.reps!))) out.push('reps')
  return out
}

/** A set is logged once both fields are filled ("BW" counts as filled for bodyweight exercises). */
export function isLogged(s: SetLike & { durationSec?: number | null }, o: { bodyweight: boolean; timed: boolean }) {
  const second = o.timed ? !!s.durationSec : !!s.reps
  return second && (s.weight != null || o.bodyweight)
}

/** Σ weight × reps; R and L rows are separate sets so they count separately. */
export const volume = (sets: SetLike[]) => sets.reduce((a, s) => a + (s.weight ?? 0) * (s.reps ?? 0), 0)

/** Monday 00:00 local of the week containing t. */
export function weekStart(t: number) {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}
/** Sunday 00:00 local (the week strip runs S..S like the reference). */
export function sundayOf(t: number) {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d.getTime()
}
export const addDays = (t: number, n: number) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime() }
export const dateKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
export const fromKey = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).getTime() }

const KG_PER_LB = 0.45359237
export const toDisplay = (kg: number | null | undefined, unit: 'kg' | 'lb') =>
  kg == null ? null : Math.round((unit === 'lb' ? kg / KG_PER_LB : kg) * 100) / 100
export const fromDisplay = (v: number, unit: 'kg' | 'lb') => (unit === 'lb' ? v * KG_PER_LB : v)

/** 1300 → "1.3k kgs" */
export function fmtVolume(kg: number, unit: 'kg' | 'lb') {
  const v = toDisplay(kg, unit) ?? 0
  const n = v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v))
  return `${n} ${unit}s`
}
/** 3780e3 → "1h 3m" */
export function fmtDuration(ms: number) {
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60)
  return h ? `${h}h ${m % 60}m` : m ? `${m}m` : `${Math.floor(ms / 1000)}s`
}
export function fmtClock(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60)
  return `${h ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
export const fmtMDY = (t: number) => new Date(t).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
export const fmtDate = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
export const fmtWeight = (kg: number | null, unit: 'kg' | 'lb') => (kg == null ? 'BW' : String(toDisplay(kg, unit)))
