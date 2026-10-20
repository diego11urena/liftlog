import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db, IMAGE_BASE, isActivity, MUSCLE_GROUPS, MUSCLES, uuid, type Exercise, type Muscle } from '../db'
import { loggedSetsFor, useExerciseHistory, useExercises, useSettings } from '../hooks'
import { bests, fmtDate, fmtWeight, toDisplay, volume } from '../lib'
import MuscleMap from '../MuscleMap'
import { Icon, RoundBtn, Segmented, Sheet, TopBar } from '../ui'

export const label = (s: string) => s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
const CLASSES = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Kettlebell', 'Band', 'Body Weight/Weighted', 'Other']
const SEGS = ['Exercises', 'Activities'] as const
const DAY = 86400e3

/** "Add Exercise" library. With `onAdd`, the detail screen's "Add Exercise" button adds it and returns. */
export default function Library({ onBack, onAdd }: { onBack: () => void; onAdd?: (exerciseId: string) => void }) {
  const all = useExercises()
  const [seg, setSeg] = useState<(typeof SEGS)[number]>('Exercises')
  const [q, setQ] = useState('')
  const [group, setGroup] = useState(''), [muscle, setMuscle] = useState(''), [cls, setCls] = useState('')
  const [picker, setPicker] = useState<null | 'group' | 'muscle' | 'cls'>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [custom, setCustom] = useState<{ id?: string } | null>(null)
  const recent = useLiveQuery(async () => {
    const ids = await db.workoutLogs.where('startedAt').above(Date.now() - 14 * DAY).primaryKeys()
    return new Set((await db.workoutExercises.where('logId').anyOf(ids).toArray()).map((w) => w.exerciseId))
  }, []) ?? new Set<string>()

  if (custom) return <CustomForm id={custom.id} activity={seg === 'Activities'} onDone={(id) => { setCustom(null); if (id) setDetail(id) }} />
  if (detail) return <ExerciseDetail id={detail} onBack={() => setDetail(null)} onAdd={onAdd} onEdit={() => setCustom({ id: detail })} />

  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const list = [...all.values()]
    .filter((e) => isActivity(e) === (seg === 'Activities'))
    .filter((e) => words.every((w) => e.name.toLowerCase().includes(w)))
    .filter((e) => !group || e.primaryMuscles.some((m) => MUSCLE_GROUPS[group].includes(m)))
    .filter((e) => !muscle || e.primaryMuscles.includes(muscle as Muscle))
    .filter((e) => !cls || e.classification === cls)
    .sort((a, b) => a.name.localeCompare(b.name))
  const sections = new Map<string, Exercise[]>()
  for (const e of list) {
    const L = /[a-z]/i.test(e.name[0]) ? e.name[0].toUpperCase() : '#'
    sections.set(L, [...(sections.get(L) ?? []), e])
  }

  const chips = [
    { k: 'group' as const, label: 'Muscle Group', v: group },
    { k: 'muscle' as const, label: 'Primary Muscle', v: muscle && label(muscle) },
    { k: 'cls' as const, label: 'Classification', v: cls },
  ]
  const pickerData = picker === 'group' ? { title: 'Muscle Group', opts: Object.keys(MUSCLE_GROUPS), v: group, set: setGroup }
    : picker === 'muscle' ? { title: 'Primary Muscle', opts: [...MUSCLES], v: muscle, set: setMuscle }
    : picker === 'cls' ? { title: 'Classification', opts: CLASSES, v: cls, set: setCls } : null

  return (
    <div>
      <div className="sticky top-0 z-30 bg-bg px-4 pb-3 pt-[calc(.75rem+env(safe-area-inset-top))]">
        <div className="mb-3 flex items-center gap-3">
          <RoundBtn icon="chevL" label="Back" onClick={onBack} />
          <Segmented className="flex-1" value={seg} options={SEGS} onChange={setSeg} />
          <RoundBtn icon="plus" label={`New custom ${seg === 'Activities' ? 'activity' : 'exercise'}`} onClick={() => setCustom({})} />
        </div>
        <label className="field mb-2 flex items-center gap-2">
          <Icon name="search" className="size-5 text-muted" />
          <input className="min-w-0 flex-1 outline-none" type="search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {chips.map((c) => (
            <button key={c.k} onClick={() => setPicker(c.k)} className={`chip min-h-9 ${c.v ? 'bg-accent text-black font-semibold' : ''}`}>
              {c.v || c.label} ▾
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-6">
        {[...sections].map(([L, items]) => (
          <section key={L}>
            <h2 className="sticky top-[10.5rem] z-20 bg-bg py-1 text-sm font-bold text-muted">{L}</h2>
            <ul className="card mb-2 divide-y divide-line overflow-hidden">
              {items.map((e) => (
                <li key={e.id}>
                  <button className="flex min-h-13 w-full items-center gap-2 px-4 py-3 text-left" onClick={() => setDetail(e.id)}>
                    <span className="flex-1">{e.name}</span>
                    {recent.has(e.id) && <Icon name="clock" className="size-4 text-muted" />}
                    <Icon name="chevR" className="size-4 text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!list.length && <p className="py-10 text-center text-muted">Nothing matches.</p>}
      </div>

      {pickerData && (
        <Sheet label={pickerData.title} onClose={() => setPicker(null)}>
          <h2 className="p-4 text-center text-lg font-bold">{pickerData.title}</h2>
          <ul className="card mx-4 mb-4 divide-y divide-line">
            {['', ...pickerData.opts].map((o) => (
              <li key={o}>
                <button className="flex min-h-12 w-full items-center justify-between px-4" onClick={() => { pickerData.set(o); setPicker(null) }}>
                  {o ? label(o) : 'Any'} <Radio on={pickerData.v === o} />
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </div>
  )
}

export const Radio = ({ on }: { on: boolean }) => (
  <span className={`grid size-6 place-items-center rounded-full border-2 ${on ? 'border-accent' : 'border-white/25'}`}>
    {on && <span className="size-3 rounded-full bg-accent" />}
  </span>
)

const RANGES = ['Month', 'Year', 'All Time'] as const
const axis = { stroke: 'var(--muted)', fontSize: 11, tickLine: false, axisLine: false }
const tip = { contentStyle: { background: 'var(--card)', border: 'none', borderRadius: 12, color: 'var(--fg)' }, cursor: { stroke: 'var(--line)', fill: 'var(--line)' } }

function ExerciseDetail({ id, onBack, onAdd, onEdit }: { id: string; onBack: () => void; onAdd?: (id: string) => void; onEdit: () => void }) {
  const e = useLiveQuery(() => db.exercises.get(id), [id])
  const hist = useExerciseHistory(id, '', Infinity)
  const { unit } = useSettings()
  const [mode, setMode] = useState<'PR' | 'Vol.'>('PR')
  const [range, setRange] = useState<(typeof RANGES)[number]>('All Time')
  const sessions = useLiveQuery(async () => {
    const by = new Map<string, Awaited<ReturnType<typeof loggedSetsFor>>>()
    for (const s of await loggedSetsFor(id)) by.set(s.logId, [...(by.get(s.logId) ?? []), s])
    return [...by.values()].map((ss) => ({ t: Math.max(...ss.map((s) => s.completedAt)), top: bests(ss).top?.weight ?? 0, vol: volume(ss) }))
  }, [id])
  if (!e) return null

  const from = range === 'Month' ? Date.now() - 30 * DAY : range === 'Year' ? Date.now() - 365 * DAY : 0
  const data = (sessions ?? []).filter((s) => s.t >= from).sort((a, b) => a.t - b.t)
    .map((s) => ({ t: s.t, v: Math.round(toDisplay(mode === 'PR' ? s.top : s.vol, unit) ?? 0) }))

  return (
    <div className={onAdd ? 'pb-28' : 'pb-8'}>
      <TopBar title={e.name} onBack={onBack} sub={`Class: ${e.classification}`}
        right={e.isCustom ? <RoundBtn icon="pencil" label="Edit" onClick={onEdit} /> : null} />
      <div className="space-y-3 px-4">
        <div className="card py-5"><MuscleMap primary={e.primaryMuscles} secondary={e.secondaryMuscles} /></div>

        <div className="card p-4">
          {hist?.count ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted">Last workout{hist.last && ` · ${fmtDate(hist.last.date)}`}</div>
                <div className="font-semibold">{hist.last?.sets.map((s) => `${fmtWeight(s.weight, unit)}×${s.reps ?? '–'}`).join(', ') ?? '–'}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted">PR</div>
                <div className="font-semibold text-accent">{hist.top ? `${fmtWeight(hist.top.weight, unit)} ${hist.top.weight != null ? unit : ''} × ${hist.top.reps}` : '–'}</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex-1"><div className="font-semibold">No data</div><div className="text-sm text-muted">Log this exercise first</div></div>
              <Icon name="pencil" className="size-5 text-accent" />
            </div>
          )}
        </div>

        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-bold">PR Progress</h2>
            <Segmented className="w-36" value={mode} options={['PR', 'Vol.'] as const} onChange={setMode} />
          </div>
          {data.length ? (
            <div className="h-48">
              <ResponsiveContainer>
                {mode === 'PR' ? (
                  <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--line)" />
                    <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {...axis} minTickGap={24} />
                    <YAxis domain={['auto', 'auto']} {...axis} />
                    <Tooltip {...tip} labelFormatter={(t) => fmtDate(Number(t))} formatter={(v) => [`${v} ${unit}`, 'Top weight']} />
                    <Line dataKey="v" stroke="var(--accent)" strokeWidth={2} dot={{ r: 4, fill: 'var(--accent)', stroke: 'var(--card)', strokeWidth: 2 }} isAnimationActive={false} />
                  </LineChart>
                ) : (
                  <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--line)" />
                    <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {...axis} minTickGap={24} />
                    <YAxis {...axis} />
                    <Tooltip {...tip} labelFormatter={(t) => fmtDate(Number(t))} formatter={(v) => [`${v} ${unit}`, 'Volume']} />
                    <Bar dataKey="v" fill="var(--accent)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-6 text-center">
              <Icon name="stats" className="mx-auto mb-2 size-8 text-muted" />
              <div className="font-semibold">No Data</div>
              <div className="text-sm text-muted">Log this exercise to activate insights and data.</div>
            </div>
          )}
          <Segmented className="mt-3" value={range} options={RANGES} onChange={setRange} />
        </div>

        <div className="card space-y-1 p-4 text-sm">
          <div><span className="font-semibold">Primary muscles: </span><span className="text-muted">{e.primaryMuscles.map(label).join(', ') || '–'}</span></div>
          <div><span className="font-semibold">Secondary muscles: </span><span className="text-muted">{e.secondaryMuscles.map(label).join(', ') || '–'}</span></div>
        </div>
      </div>

      {onAdd && (
        <div className="phone-fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-4">
          <button className="btn-accent w-full" onClick={() => onAdd(id)}>Add Exercise</button>
        </div>
      )}
    </div>
  )
}

export function HowTo({ e }: { e: Exercise }) {
  return (
    <div className="card p-4">
      <h2 className="mb-2 font-bold">How to</h2>
      {e.images.length > 0 && (
        <div className="no-scrollbar mb-3 flex snap-x gap-2 overflow-x-auto">
          {e.images.map((src) => <img key={src} src={IMAGE_BASE + src} alt="" loading="lazy" className="h-40 snap-start rounded-2xl bg-card2" />)}
        </div>
      )}
      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">{e.instructions.map((s, i) => <li key={i}>{s}</li>)}</ol>
    </div>
  )
}

function CustomForm({ id, activity, onDone }: { id?: string; activity: boolean; onDone: (id?: string) => void }) {
  const existing = useLiveQuery(() => (id ? db.exercises.get(id) : undefined), [id])
  if (id && !existing) return null
  return <CustomFormInner key={id} e={existing} activity={existing ? isActivity(existing) : activity} onDone={onDone} />
}

function CustomFormInner({ e, activity, onDone }: { e?: Exercise; activity: boolean; onDone: (id?: string) => void }) {
  const [name, setName] = useState(e?.name ?? '')
  const [cls, setCls] = useState(e?.classification ?? (activity ? 'Other' : 'Barbell'))
  const [primary, setPrimary] = useState<Muscle[]>(e?.primaryMuscles ?? [])
  const [secondary, setSecondary] = useState<Muscle[]>(e?.secondaryMuscles ?? [])
  const cycle = (m: Muscle) => {
    if (primary.includes(m)) { setPrimary(primary.filter((x) => x !== m)); setSecondary([...secondary, m]) }
    else if (secondary.includes(m)) setSecondary(secondary.filter((x) => x !== m))
    else setPrimary([...primary, m])
  }
  const save = async () => {
    const nid = e?.id ?? uuid()
    await db.exercises.put({
      id: nid, name: name.trim(), category: activity ? 'activity' : 'strength', classification: cls,
      equipment: cls === 'Body Weight/Weighted' ? 'body only' : cls.toLowerCase(),
      primaryMuscles: primary, secondaryMuscles: secondary, instructions: e?.instructions ?? [], images: [], isCustom: true, notes: e?.notes ?? '', updatedAt: Date.now(),
    })
    onDone(nid)
  }
  const remove = async () => {
    if (!e) return
    const used = await db.workoutExercises.where('exerciseId').equals(e.id).count()
    if (used) return alert(`It's used in ${used} logged session(s), so it can't be deleted.`)
    if (confirm(`Delete "${e.name}"?`)) { await db.exercises.delete(e.id); onDone() }
  }
  return (
    <div className="pb-8">
      <TopBar title={e ? 'Edit' : activity ? 'New Activity' : 'New Exercise'} onBack={() => onDone(e?.id)}
        right={e && <RoundBtn icon="trash" label="Delete" className="bg-danger text-white" onClick={remove} />} />
      <div className="space-y-3 px-4">
        <input className="field" placeholder="Name" value={name} onChange={(ev) => setName(ev.target.value)} />
        <select className="field" value={cls} onChange={(ev) => setCls(ev.target.value)} aria-label="Classification">
          {CLASSES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <div className="card py-4"><MuscleMap size="md" primary={primary} secondary={secondary} onMuscle={cycle} /></div>
        <p className="text-sm text-muted">Tap to cycle: primary → secondary → off</p>
        <div className="flex flex-wrap gap-2">
          {MUSCLES.map((m) => (
            <button key={m} onClick={() => cycle(m)}
              className={`chip min-h-9 ${primary.includes(m) ? 'bg-accent text-black font-semibold' : secondary.includes(m) ? 'bg-accent-soft/40' : ''}`}>{label(m)}</button>
          ))}
        </div>
        <button className="btn-accent w-full" disabled={!name.trim() || (!activity && !primary.length)} onClick={save}>Save</button>
      </div>
    </div>
  )
}
