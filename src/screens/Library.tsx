import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db, MUSCLE_GROUPS, unitOf, MUSCLES, uuid, type Exercise, type Muscle } from '../db'
import { loggedSetsFor, useExerciseHistory, useExercises } from '../hooks'
import { bests, fmtDate, fmtWeight, toDisplay, volume } from '../lib'
import MuscleMap from '../MuscleMap'
import { CLASSIFICATIONS, MUSCLE_LABEL } from '../muscles'
import { toast, useHideTabs } from '../App'
import { ask, Icon, RoundBtn, Segmented, Sheet, TopBar } from '../ui'

export const label = (s: string) => MUSCLE_LABEL[s as Muscle] ?? s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
const DAY = 86400e3

/** "Add Exercise" library. With `onAdd`, the detail screen's "Add Exercise" button adds it and returns. */
export default function Library({ onBack, onAdd }: { onBack: () => void; onAdd?: (exerciseId: string) => void }) {
  useHideTabs()
  const all = useExercises()
  const [q, setQ] = useState('')
  const [group, setGroup] = useState(''), [muscle, setMuscle] = useState(''), [cls, setCls] = useState('')
  const [picker, setPicker] = useState<null | 'group' | 'muscle' | 'cls'>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [custom, setCustom] = useState<{ id?: string } | null>(null)
  const recent = useLiveQuery(async () => {
    const ids = await db.workoutLogs.where('startedAt').above(Date.now() - 14 * DAY).primaryKeys()
    return new Set((await db.workoutExercises.where('logId').anyOf(ids).toArray()).map((w) => w.exerciseId))
  }, []) ?? new Set<string>()

  if (custom) return <CustomForm id={custom.id} onDone={(id) => { setCustom(null); if (id) setDetail(id) }} />
  if (detail) return <ExerciseDetail id={detail} onBack={() => setDetail(null)} onAdd={onAdd} onEdit={() => setCustom({ id: detail })} />

  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const list = [...all.values()]
    .filter((e) => { const hay = [e.name, ...(e.aliases ?? [])].join(' | ').toLowerCase(); return words.every((w) => hay.includes(w)) })
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
    : picker === 'cls' ? { title: 'Classification', opts: CLASSIFICATIONS, v: cls, set: setCls } : null

  return (
    <div>
      <div className="sticky top-0 z-30 bg-bg px-[18px] pb-3 pt-[calc(28px+env(safe-area-inset-top))]">
        <div className="mb-3.5 flex items-center gap-3">
          <RoundBtn icon="chevL" label="Back" onClick={onBack} />
          <h1 className="flex-1 text-center text-[26px] font-semibold">Exercises</h1>
          <RoundBtn icon="plus" label="New custom exercise" onClick={() => setCustom({})} />
        </div>
        <label className="mb-2 flex h-[52px] items-center gap-2 rounded-2xl border border-line bg-card px-4">
          <Icon name="search" className="size-5 text-muted" />
          <input className="min-w-0 flex-1 outline-none" type="search" placeholder={`Search ${all.size} exercises`} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {chips.map((c) => (
            <span key={c.k} className={`inline-flex h-10 shrink-0 items-center rounded-full border-[1.5px] border-fg ${c.v ? 'bg-fg text-onink' : ''}`}>
              <button onClick={() => setPicker(c.k)} className="h-full pl-4 pr-3 text-sm font-semibold">{c.v || c.label}{!c.v && ' ▾'}</button>
              {c.v && <button aria-label={`Clear ${c.label}`} onClick={() => ({ group: setGroup, muscle: setMuscle, cls: setCls })[c.k]('')} className="relative h-full pr-3 before:absolute before:-inset-1 before:content-['']"><Icon name="x" className="size-4" /></button>}
            </span>
          ))}
        </div>
      </div>

      <div className="px-[18px] pb-6">
        {[...sections].map(([L, items]) => (
          <section key={L}>
            <h2 className="num sticky top-[calc(198px+env(safe-area-inset-top))] z-20 h-[34px] bg-bg text-[13px] font-semibold leading-[34px] text-acc-t">{L}</h2>
            <ul className="mb-2 divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-card">
              {items.map((e) => (
                <li key={e.id}>
                  <button className="flex h-[76px] w-full items-center gap-3 px-3.5 text-left" onClick={() => setDetail(e.id)}>
                    <span className="grid h-[62px] w-[62px] shrink-0 place-items-center rounded-2xl bg-panel"><MuscleMap w={25} primary={e.primaryMuscles} secondary={e.secondaryMuscles} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17px] font-semibold">{e.name}</span>
                      <span className="block truncate text-[13px] text-muted">{[e.classification, e.primaryMuscles[0] && label(e.primaryMuscles[0])].filter(Boolean).join(' · ')}</span>
                    </span>
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
          <h2 className="px-[18px] pb-3 pt-6 text-center text-[22px] font-semibold">{pickerData.title}</h2>
          <ul className="card mx-[18px] mb-4 divide-y divide-line">
            {['', ...pickerData.opts].map((o) => (
              <li key={o}>
                <button className="flex min-h-14 w-full items-center justify-between px-4" onClick={() => { pickerData.set(o); setPicker(null) }}>
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
  <span className={`grid size-6 place-items-center rounded-full border-2 ${on ? 'border-accent' : 'border-muted/50'}`}>
    {on && <span className="size-3 rounded-full bg-accent" />}
  </span>
)

const RANGES = ['Month', 'Year', 'All Time'] as const
const axis = { stroke: 'var(--mute)', fontSize: 11, tickLine: false, axisLine: false }
const tip = { contentStyle: { background: 'var(--paper)', border: 'none', borderRadius: 12, color: 'var(--ink)' }, cursor: { stroke: 'var(--line)', fill: 'var(--line)' } }

function ExerciseDetail({ id, onBack, onAdd, onEdit }: { id: string; onBack: () => void; onAdd?: (id: string) => void; onEdit: () => void }) {
  const e = useLiveQuery(() => db.exercises.get(id), [id])
  const hist = useExerciseHistory(id, '', Infinity)
  const unit = unitOf(e)
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
    <div className="pb-4">
      <TopBar title={e.name} onBack={onBack} sub={`Class: ${e.classification}`}
        right={e.isCustom ? <RoundBtn icon="pencil" label="Edit" onClick={onEdit} /> : null} />
      <div className="space-y-4 px-[18px]">
        <div className="ink-panel px-[22px] py-6">
          <MuscleMap w={104} surface="d" labels primary={e.primaryMuscles} secondary={e.secondaryMuscles} />
          <div className="mt-4 flex justify-center gap-5 text-[13px]">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--p-d)]" />Primary</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--s-d)]" />Secondary</span>
          </div>
        </div>

        <div className="card p-[18px]">
          {hist?.count ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="label">Last workout{hist.last && ` · ${fmtDate(hist.last.date)}`}</div>
                <div className="num mt-1 font-semibold">{hist.last?.sets.map((s) => `${fmtWeight(s.weight, unit)}×${s.reps ?? '–'}`).join(' · ') ?? '–'}</div>
              </div>
              <div className="text-right">
                <div className="label">PR</div>
                <div className="num text-[28px] font-semibold leading-tight text-acc-t">{hist.top ? `${fmtWeight(hist.top.weight, unit)}×${hist.top.reps}` : '–'}</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex-1"><div className="font-semibold">No data</div><div className="text-sm text-muted">Log this exercise first</div></div>
              <Icon name="pencil" className="size-5 text-acc-t" />
            </div>
          )}
        </div>

        <div className="card p-[18px]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">PR Progress</h2>
            <Segmented className="w-40" value={mode} options={['PR', 'Vol.'] as const} onChange={setMode} />
          </div>
          {data.length ? (
            <div className="h-48">
              <ResponsiveContainer>
                {mode === 'PR' ? (
                  <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 4" />
                    <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {...axis} minTickGap={24} />
                    <YAxis domain={['auto', 'auto']} {...axis} />
                    <Tooltip {...tip} labelFormatter={(t) => fmtDate(Number(t))} formatter={(v) => [`${v} ${unit}`, 'Top weight']} />
                    <Line dataKey="v" stroke="var(--acc-t)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--paper)', stroke: 'var(--acc-t)', strokeWidth: 2 }} activeDot={{ r: 5, fill: 'var(--acc-t)' }} isAnimationActive={false} />
                  </LineChart>
                ) : (
                  <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 4" />
                    <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {...axis} minTickGap={24} />
                    <YAxis {...axis} />
                    <Tooltip {...tip} labelFormatter={(t) => fmtDate(Number(t))} formatter={(v) => [`${v} ${unit}`, 'Volume']} />
                    <Bar dataKey="v" fill="var(--acc-t)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
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

        <div className="card space-y-2 p-[18px] text-[15px]">
          <div className="flex justify-between gap-4"><span className="font-semibold">Primary muscles:</span><span className="text-right text-muted">{e.primaryMuscles.map(label).join(', ') || '–'}</span></div>
          <div className="flex justify-between gap-4"><span className="font-semibold">Secondary muscles:</span><span className="text-right text-muted">{e.secondaryMuscles.map(label).join(', ') || '–'}</span></div>
        </div>
      </div>

      {onAdd && (
        <div className="mt-4 px-[18px] pb-6">
          <button className="btn-accent w-full" onClick={() => onAdd(id)}>Add Exercise</button>
        </div>
      )}
    </div>
  )
}

function CustomForm({ id, onDone }: { id?: string; onDone: (id?: string) => void }) {
  const existing = useLiveQuery(() => (id ? db.exercises.get(id) : undefined), [id])
  if (id && !existing) return null
  return <CustomFormInner key={id} e={existing} onDone={onDone} />
}

function CustomFormInner({ e, onDone }: { e?: Exercise; onDone: (id?: string) => void }) {
  const [name, setName] = useState(e?.name ?? '')
  const [cls, setCls] = useState(e?.classification ?? 'Barbell')
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
      id: nid, name: name.trim(), category: 'strength', classification: cls,
      equipment: cls === 'Body Weight/Weighted' ? 'body only' : cls.toLowerCase(),
      primaryMuscles: primary, secondaryMuscles: secondary, instructions: e?.instructions ?? [], images: [], isCustom: true, notes: e?.notes ?? '', updatedAt: Date.now(),
    })
    onDone(nid)
  }
  const remove = async () => {
    if (!e) return
    const used = await db.workoutExercises.where('exerciseId').equals(e.id).count()
    if (used) return toast(`It's used in ${used} logged session(s), so it can't be deleted.`)
    if (await ask({ title: `Delete "${e.name}"?`, confirm: 'Delete', danger: true })) { await db.exercises.delete(e.id); onDone() }
  }
  return (
    <div className="pb-8">
      <TopBar title={e ? 'Edit' : 'New Exercise'} onBack={() => onDone(e?.id)}
        right={e && <RoundBtn icon="trash" label="Delete" className="text-danger" onClick={remove} />} />
      <div className="space-y-3 px-[18px]">
        <input className="field" placeholder="Name" value={name} onChange={(ev) => setName(ev.target.value)} />
        <select className="field" value={cls} onChange={(ev) => setCls(ev.target.value)} aria-label="Classification">
          {CLASSIFICATIONS.map((c) => <option key={c}>{c}</option>)}
        </select>
        <div className="card py-4"><MuscleMap size="md" primary={primary} secondary={secondary} onMuscle={cycle} /></div>
        <p className="text-sm text-muted">Tap to cycle: primary → secondary → off</p>
        <div className="flex flex-wrap gap-2">
          {MUSCLES.map((m) => (
            <button key={m} onClick={() => cycle(m)}
              className={`chip min-h-9 ${primary.includes(m) ? 'bg-accent text-on-accent font-semibold' : secondary.includes(m) ? 'bg-accent-soft/40' : ''}`}>{label(m)}</button>
          ))}
        </div>
        <button className="btn-accent w-full" disabled={!name.trim() || !primary.length} onClick={save}>Save</button>
      </div>
    </div>
  )
}
