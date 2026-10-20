import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db, MUSCLES, type Muscle } from '../db'
import { useExercises, useSettings } from '../hooks'
import { bests, fmtDate, fmtDuration, fmtVolume, toDisplay, volume, weekStart } from '../lib'
import { Icon, Segmented } from '../ui'
import { label } from './Library'
import Session from './Session'

export default function Stats() {
  const [seg, setSeg] = useState<'History' | 'Progress'>('History')
  const [open, setOpen] = useState<string | null>(null)
  if (open) return <Session logId={open} onClose={() => setOpen(null)} />
  return (
    <div className="pb-8">
      <div className="px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top))]">
        <h1 className="mb-3 text-3xl font-bold">Stats</h1>
        <Segmented value={seg} options={['History', 'Progress'] as const} onChange={setSeg} />
      </div>
      {seg === 'History' ? <History onOpen={setOpen} /> : <Progress />}
    </div>
  )
}

function History({ onOpen }: { onOpen: (id: string) => void }) {
  const { unit } = useSettings()
  const exercises = useExercises()
  const rows = useLiveQuery(async () => {
    const logs = await db.workoutLogs.where('status').equals('done').reverse().sortBy('startedAt')
    return Promise.all(logs.map(async (l) => {
      const [wes, sets] = await Promise.all([db.workoutExercises.where('logId').equals(l.id).sortBy('order'), db.sets.where('logId').equals(l.id).toArray()])
      return { l, wes, sets: sets.length, prs: sets.filter((s) => s.isPR).length, vol: volume(sets) }
    }))
  }, [])
  if (rows?.length === 0) return <p className="px-4 py-10 text-center text-muted">No finished workouts yet.</p>
  return (
    <ul className="space-y-2 px-4">
      {rows?.map(({ l, wes, sets, prs, vol }) => (
        <li key={l.id}>
          <button className="card flex w-full items-center gap-3 p-4 text-left" onClick={() => onOpen(l.id)}>
            <div className="min-w-0 flex-1">
              <div className="flex justify-between gap-2"><span className="truncate font-bold">{l.name}</span><span className="shrink-0 text-sm text-muted">{fmtDate(l.startedAt)}</span></div>
              <div className="text-sm text-muted">
                {fmtDuration((l.endedAt ?? l.startedAt) - l.startedAt)} · {sets} sets · {fmtVolume(vol, unit)}{prs > 0 && <span className="text-accent"> · {prs} PR{prs > 1 && 's'}</span>}
              </div>
              <div className="mt-1 truncate text-sm">{wes.map((w) => exercises.get(w.exerciseId)?.name).join(', ')}</div>
            </div>
            <Icon name="chevR" className="size-4 text-muted" />
          </button>
        </li>
      ))}
    </ul>
  )
}

const METRICS = { e1rm: 'Est. 1RM', top: 'Top set', volume: 'Volume' } as const
type Metric = keyof typeof METRICS
const WEEK = 7 * 86400e3
const axis = { stroke: 'var(--muted)', fontSize: 11, tickLine: false, axisLine: false }
const tip = { contentStyle: { background: 'var(--card)', border: 'none', borderRadius: 12, color: 'var(--fg)' }, cursor: { stroke: 'var(--line)', fill: 'var(--line)' } }

function Progress() {
  const { unit } = useSettings()
  const exercises = useExercises()
  const sets = useLiveQuery(() => db.sets.filter((s) => s.completedAt > 0).toArray(), [])
  const [exId, setExId] = useState('')
  const [metric, setMetric] = useState<Metric>('e1rm')
  const [week, setWeek] = useState(() => weekStart(Date.now()))
  if (!sets) return null
  if (!sets.length) return <p className="px-4 py-10 text-center text-muted">Log some sets to see progress.</p>

  const counts = new Map<string, number>()
  for (const s of sets) counts.set(s.exerciseId, (counts.get(s.exerciseId) ?? 0) + 1)
  const logged = [...counts].sort((a, b) => b[1] - a[1]).map(([id]) => id)
  const current = exId || logged[0]
  const byLog = new Map<string, typeof sets>()
  for (const s of sets) if (s.exerciseId === current) byLog.set(s.logId, [...(byLog.get(s.logId) ?? []), s])
  const series = [...byLog.values()].map((ss) => {
    const b = bests(ss)
    const v = metric === 'e1rm' ? b.e1rm : metric === 'top' ? (b.top?.weight ?? 0) : volume(ss)
    return { t: Math.max(...ss.map((s) => s.completedAt)), v: Math.round(toDisplay(v, unit) ?? 0) }
  }).sort((a, b) => a.t - b.t)

  const per = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>
  for (const s of sets) {
    if (s.completedAt < week || s.completedAt >= week + WEEK) continue
    const e = exercises.get(s.exerciseId)
    e?.primaryMuscles.forEach((m) => (per[m] += 1))
    e?.secondaryMuscles.forEach((m) => (per[m] += 0.5))
  }
  const bars = MUSCLES.map((m) => ({ m: label(m), v: per[m] })).filter((b) => b.v > 0).sort((a, b) => b.v - a.v)
  const thisWeek = weekStart(Date.now())

  return (
    <div className="space-y-3 px-4">
      <section className="card p-4">
        <select className="field mb-3" value={current} onChange={(e) => setExId(e.target.value)} aria-label="Exercise">
          {logged.map((id) => <option key={id} value={id}>{exercises.get(id)?.name ?? id}</option>)}
        </select>
        <Segmented className="mb-3" value={METRICS[metric]} options={Object.values(METRICS)} onChange={(v) => setMetric((Object.keys(METRICS) as Metric[]).find((k) => METRICS[k] === v)!)} />
        <h2 className="mb-1 text-sm text-muted">{METRICS[metric]} ({unit}) per session</h2>
        <div className="h-56">
          <ResponsiveContainer>
            <LineChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {...axis} minTickGap={24} />
              <YAxis domain={['auto', 'auto']} {...axis} />
              <Tooltip {...tip} labelFormatter={(t) => fmtDate(Number(t))} formatter={(v) => [`${v} ${unit}`, METRICS[metric]]} />
              <Line dataKey="v" stroke="var(--accent)" strokeWidth={2} dot={{ r: 4, fill: 'var(--accent)', stroke: 'var(--card)', strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {series.length === 1 && <p className="text-center text-xs text-muted">One session so far; the trend shows from the second.</p>}
      </section>

      <section className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <button className="grid size-9 place-items-center rounded-full bg-card2" aria-label="Previous week" onClick={() => setWeek(weekStart(week - 1))}><Icon name="chevL" /></button>
          <h2 className="text-sm font-semibold">Sets per muscle · {week === thisWeek ? 'this week' : `week of ${fmtDate(week)}`}</h2>
          <button className="grid size-9 place-items-center rounded-full bg-card2 disabled:opacity-30" aria-label="Next week" disabled={week >= thisWeek} onClick={() => setWeek(weekStart(week + WEEK + 7200e3))}><Icon name="chevR" /></button>
        </div>
        {bars.length ? (
          <div style={{ height: bars.length * 28 + 24 }}>
            <ResponsiveContainer>
              <BarChart data={bars} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }} barCategoryGap={4}>
                <CartesianGrid horizontal={false} stroke="var(--line)" />
                <XAxis type="number" {...axis} allowDecimals={false} />
                <YAxis type="category" dataKey="m" width={84} {...axis} interval={0} />
                <Tooltip {...tip} formatter={(v) => [`${v} sets`, 'Volume']} />
                <Bar dataKey="v" fill="var(--accent)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="py-6 text-center text-sm text-muted">No sets logged this week.</p>}
        <p className="mt-1 text-xs text-muted">Primary muscle = 1 set, secondary = ½.</p>
      </section>
    </div>
  )
}
