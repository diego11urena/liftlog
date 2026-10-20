import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import {
  addExercise, addSet, deleteLog, MAX_SETS, dropSet, finishSession, moveExercise, removeExercise, removeLastSet, replaceExercise,
  saveSessionToWorkout, setUnilateral, updateSet,
} from '../actions'
import { toast } from '../App'
import { db, isBodyweight, isTimed, unitOf, type Exercise, type Unit, type WorkoutExercise, type WorkoutLog, type WSet } from '../db'
import { bySetOrder, logSummary, useExerciseHistory, useExercises } from '../hooks'
import { fmtClock, fmtDate, fmtDuration, fmtVolume, fmtWeight, fromDisplay, toDisplay } from '../lib'
import MuscleMap from '../MuscleMap'
import { Busy, Icon, Pager, RoundBtn, Sheet, Tile, TopBar } from '../ui'
import Library, { HowTo, label } from './Library'

/** Logging screen. Active sessions get the timer/End flow; finished ones (from Stats) are editable with Delete. */
export default function Session({ logId, onEnded, onClose }: { logId: string; onEnded?: (logId: string) => void; onClose?: () => void }) {
  const log = useLiveQuery(() => db.workoutLogs.get(logId), [logId])
  const wes = useLiveQuery(() => db.workoutExercises.where('logId').equals(logId).sortBy('order'), [logId])
  const exercises = useExercises()
  const [page, setPage] = useState(0)
  const [lib, setLib] = useState<null | { replace?: string }>(null)
  const [review, setReview] = useState(false)

  if (!log || !wes) return null
  if (lib) return (
    <Library onBack={() => setLib(null)} onAdd={async (eid) => {
      if (lib.replace) await replaceExercise(lib.replace, eid)
      else { await addExercise(logId, eid); setPage(wes.length) }
      setLib(null)
    }} />
  )
  if (review) return <Review log={log} onBack={() => setReview(false)} onEnded={() => onEnded?.(logId)} />

  const active = log.status === 'active'
  const discard = async () => {
    if (confirm(active ? 'Discard this workout? Everything logged in it will be deleted.' : 'Delete this workout from history?')) {
      await deleteLog(logId); onClose?.()
    }
  }

  return (
    <div className="pb-8">
      <header className="flex items-start gap-2 px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top))]">
        {onClose && <RoundBtn icon="chevL" label="Back" onClick={onClose} />}
        <div className="min-w-0 flex-1">
          <input className="w-full truncate bg-transparent text-3xl font-bold outline-none" defaultValue={log.name} key={log.id} aria-label="Workout name"
            onBlur={(e) => e.target.value.trim() && db.workoutLogs.update(log.id, { name: e.target.value.trim(), updatedAt: Date.now() })} />
          <p className="text-sm tabular-nums text-muted">{active ? <Elapsed since={log.startedAt} /> : `${fmtDate(log.startedAt)} · ${fmtDuration((log.endedAt ?? log.startedAt) - log.startedAt)}`}</p>
        </div>
        <RoundBtn icon={active ? 'x' : 'trash'} label={active ? 'Discard workout' : 'Delete workout'} className="bg-danger text-on-accent" onClick={discard} />
        {active && <button className="btn-dark min-h-10 px-4 text-sm" onClick={() => setReview(true)}>End Workout</button>}
      </header>

      <Pager index={Math.min(page, wes.length)} onIndex={setPage} pages={[
        ...wes.map((we, i) => {
          const ex = exercises.get(we.exerciseId)
          return ex ? (
            <ExerciseCard key={we.id} we={we} ex={ex} log={log}
              onReplace={() => setLib({ replace: we.id })} first={i === 0} last={i === wes.length - 1}
              onMove={async (d) => { await moveExercise(logId, we.id, d); setPage(i + d) }} />
          ) : <div key={we.id} />
        }),
        <div key="add" className="card grid min-h-80 place-items-center p-6">
          <button className="flex flex-col items-center gap-3 text-accent" onClick={() => setLib({})}>
            <span className="grid size-20 place-items-center rounded-full bg-accent/15"><Icon name="plus" className="size-9" /></span>
            Add Exercise
          </button>
        </div>,
      ]} />
    </div>
  )
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])
  return <>{fmtClock((now - since) / 1000)}</>
}

/** "130" → 90 s (last two digits are seconds), "1:30" → 90 s. */
const parseTime = (t: string) => {
  if (t.includes(':')) { const [m, sec] = t.split(':').map((x) => Number(x || 0)); return m * 60 + sec }
  const n = Number(t || 0); return Math.floor(n / 100) * 60 + (n % 100)
}

function ExerciseCard({ we, ex, log, onReplace, onMove, first, last }: {
  we: WorkoutExercise; ex: Exercise; log: WorkoutLog; onReplace: () => void; onMove: (d: -1 | 1) => void; first: boolean; last: boolean
}) {
  const unit = unitOf(ex)
  const rows = useLiveQuery(() => db.sets.where('workoutExerciseId').equals(we.id).toArray().then((r) => r.sort(bySetOrder)), [we.id])
  const hist = useExerciseHistory(ex.id, log.id, log.status === 'active' ? Infinity : log.startedAt)
  const [menu, setMenu] = useState(false)
  const [info, setInfo] = useState(false)
  const timed = isTimed(ex), bw = isBodyweight(ex)

  if (!rows) return null
  const setNo = new Map<number, number>()
  for (const r of rows) if (!setNo.has(r.order)) setNo.set(r.order, setNo.size + 1)

  /** Last session's value for the same set (falls back to the saved workout's plan). */
  const placeholder = (r: WSet) => {
    const l = hist?.last?.sets
    const m = l?.find((s) => s.order === r.order && s.side === r.side) ?? l?.find((s) => s.order === r.order)
    if (m) return m
    const plan = we.planSets?.filter((s) => s.side === r.side || (!s.side && !r.side))
    const p = plan?.[r.order]
    return p && (p.weight != null || p.reps != null || p.durationSec) ? { weight: p.weight, reps: p.reps, durationSec: p.durationSec ?? null } : null
  }
  const prevRow = (r: WSet) => [...rows].reverse().find((s) => s.order < r.order && s.side === r.side)
  const copyRow = async (r: WSet) => {
    const src = prevRow(r) ?? placeholder(r)
    if (src) await updateSet(r.id, { weight: src.weight, reps: src.reps, durationSec: src.durationSec ?? null })
  }
  const setUnit = (u: Unit) => db.exercises.update(ex.id, { unit: u, updatedAt: Date.now() })

  return (
    <section className="card p-4">
      <div className="mb-1 flex items-start gap-2">
        <h2 className="min-w-0 flex-1 text-xl font-bold leading-tight">{ex.name}</h2>
        {(ex.instructions.length > 0 || ex.images.length > 0) && <RoundBtn icon="info" label="How to" onClick={() => setInfo(true)} />}
        <RoundBtn icon="dots" label="Exercise options" onClick={() => setMenu(true)} />
      </div>
      <label className="mb-3 flex w-fit items-center gap-2 text-sm text-muted">
        <input type="checkbox" className="peer sr-only" checked={we.unilateral} onChange={(e) => void setUnilateral(we.id, e.target.checked)} />
        <span className="relative h-6 w-10 rounded-full bg-figure transition peer-checked:bg-accent after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-card after:transition peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-accent" />
        Unilateral
      </label>

      {/* Last workout + PR at a glance */}
      <div className="panel mb-3 grid grid-cols-2 gap-2 p-3 text-sm">
        {hist?.last ? (
          <div>
            <div className="text-xs text-muted">Last · {fmtDate(hist.last.date)}</div>
            <div className="font-semibold">{hist.last.sets.map((s) => `${fmtWeight(s.weight, unit)}×${s.reps ?? (s.durationSec ? fmtClock(s.durationSec) : '–')}`).join(', ')}</div>
          </div>
        ) : <div className="text-muted">{hist ? 'No history yet' : '…'}</div>}
        <div className="text-right">
          <div className="text-xs text-muted">PR</div>
          {hist?.top ? (
            <div className="font-semibold text-accent">{fmtWeight(hist.top.weight, unit)}{hist.top.weight != null && ` ${unit}`} × {hist.top.reps}</div>
          ) : <div className="text-muted">–</div>}
        </div>
      </div>

      <div className="mb-1 flex items-center gap-2 text-xs text-muted">
        <span className="w-[4.25rem] shrink-0" />
        <span className="flex flex-1 items-center justify-center gap-1.5">
          Weight
          {/* a <select> opens the native wheel picker on iPhone; the choice is remembered for this exercise */}
          <select aria-label={`Weight unit for ${ex.name}`} value={unit} onChange={(e) => setUnit(e.target.value as Unit)}
            className="rounded-full bg-panel px-2.5 py-0.5 font-semibold text-fg outline-none focus:ring-2 focus:ring-accent">
            <option value="kg">kg</option>
            <option value="lb">lb</option>
          </select>
        </span>
        <span className="w-2" />
        <span className="flex-1 text-center">{timed ? 'Time' : 'Reps'}</span>
        <span className="w-7 shrink-0" />
      </div>
      <div className="space-y-2">
        {rows.map((r) => {
          const ph = placeholder(r), n = setNo.get(r.order)
          return (
            <div key={r.id} className="flex items-center gap-2">
              <span className="w-7 shrink-0 text-center text-sm font-bold text-muted">
                {r.side === 'L' ? '' : r.isDrop ? 'D' : n}
                {r.side && <span className="block text-[10px] font-normal">{r.side}</span>}
              </span>
              <button aria-label="Copy previous set" className="grid size-9 shrink-0 place-items-center text-accent" onClick={() => copyRow(r)}><Icon name="repeat" className="size-5" /></button>
              <NumField kind="weight" label={`Set ${n}${r.side ? ' ' + r.side : ''} weight (${unit})`} value={toDisplay(r.weight, unit)}
                placeholder={ph?.weight != null ? String(toDisplay(ph.weight, unit)) : bw ? 'BW' : unit}
                onSave={(v) => updateSet(r.id, { weight: v == null ? null : fromDisplay(v, unit) })} />
              <span className="text-muted">×</span>
              {timed
                ? <NumField kind="time" label={`Set ${n}${r.side ? ' ' + r.side : ''} time`} value={r.durationSec}
                    placeholder={ph?.durationSec ? fmtClock(ph.durationSec) : '--:--'} onSave={(v) => updateSet(r.id, { durationSec: v })} />
                : <NumField kind="reps" label={`Set ${n}${r.side ? ' ' + r.side : ''} reps`} value={r.reps}
                    placeholder={ph?.reps != null ? String(ph.reps) : 'reps'} onSave={(v) => updateSet(r.id, { reps: v })} />}
              <span className={`w-7 shrink-0 text-center text-[10px] font-bold ${r.isPR ? 'text-accent' : 'text-transparent'}`}>PR</span>
            </div>
          )
        })}
      </div>

      <div className="my-4"><MuscleMap size="md" primary={ex.primaryMuscles} secondary={ex.secondaryMuscles} /></div>
      <div className="grid grid-cols-3 gap-2">
        <button className="btn min-h-11 bg-danger/15 px-2 text-sm text-danger" onClick={() => removeLastSet(we.id)} disabled={!rows.length}>Remove Set</button>
        <button className="btn-ghost min-h-11 px-2 text-sm" disabled={setNo.size >= MAX_SETS} onClick={() => dropSet(we.id, unit === 'kg' ? 2.5 : fromDisplay(5, 'lb'))}>Drop Set</button>
        <button className="btn min-h-11 bg-accent/20 px-2 text-sm text-accent" disabled={setNo.size >= MAX_SETS} onClick={() => addSet(we.id)}>Add Set</button>
      </div>

      {menu && (
        <Sheet label="Exercise options" onClose={() => setMenu(false)}>
          <div className="space-y-2 p-4">
            <button className="btn-ghost w-full" onClick={() => { setMenu(false); onReplace() }}>Replace exercise</button>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-ghost" disabled={first} onClick={() => { setMenu(false); onMove(-1) }}>Move left</button>
              <button className="btn-ghost" disabled={last} onClick={() => { setMenu(false); onMove(1) }}>Move right</button>
            </div>
            <label className="block text-sm text-muted">Exercise notes
              <textarea className="field mt-1 min-h-20 py-3 text-fg" defaultValue={we.notes} onBlur={(e) => db.workoutExercises.update(we.id, { notes: e.target.value, updatedAt: Date.now() })} />
            </label>
            <label className="block text-sm text-muted">Workout notes
              <textarea className="field mt-1 min-h-20 py-3 text-fg" defaultValue={log.notes} onBlur={(e) => db.workoutLogs.update(log.id, { notes: e.target.value, updatedAt: Date.now() })} />
            </label>
            <button className="btn-ghost w-full text-danger" onClick={() => { if (confirm(`Remove ${ex.name} and its sets?`)) { setMenu(false); void removeExercise(we.id) } }}>Remove exercise</button>
          </div>
        </Sheet>
      )}
      {info && <Sheet label="How to" onClose={() => setInfo(false)}><div className="p-4"><h2 className="mb-2 text-lg font-bold">{ex.name}</h2><HowTo e={ex} /></div></Sheet>}
    </section>
  )
}

/** Native input (iPhone numeric keypad). Keeps the typed text locally so "62." isn't eaten; saves on every change. */
function NumField({ kind, value, placeholder, label, onSave }: {
  kind: 'weight' | 'reps' | 'time'; value: number | null; placeholder: string; label: string; onSave: (v: number | null) => void
}) {
  const fmt = (v: number | null) => (v == null ? '' : kind === 'time' ? fmtClock(v) : String(v))
  const parse = (t: string): number | null => {
    const c = t.trim().replace(',', '.')
    if (!c || c === '.') return null
    if (kind === 'time') return parseTime(c) || null
    const n = Number(c)
    return isNaN(n) ? null : kind === 'reps' ? Math.round(n) : n
  }
  const [text, setText] = useState(fmt(value))
  useEffect(() => { if (parse(text) !== value) setText(fmt(value)) }, [value]) // changed elsewhere (copy previous set)
  return (
    <input aria-label={label} placeholder={placeholder} value={text}
      inputMode={kind === 'weight' ? 'decimal' : 'numeric'} pattern={kind === 'weight' ? undefined : '[0-9]*'} enterKeyHint="next"
      onChange={(e) => { setText(e.target.value); onSave(parse(e.target.value)) }}
      onFocus={(e) => e.target.select()} onBlur={() => setText(fmt(value))}
      className="h-11 w-0 min-w-0 flex-1 rounded-xl bg-panel text-center tabular-nums outline-none placeholder:text-muted/60 focus:ring-2 focus:ring-accent" />
  )
}

function Review({ log, onBack, onEnded }: { log: WorkoutLog; onBack: () => void; onEnded: () => void }) {
  const exercises = useExercises()
  const u = (exerciseId: string) => unitOf(exercises.get(exerciseId))
  const data = useLiveQuery(async () => {
    const [s, wes] = await Promise.all([logSummary(log.id, exercises), db.workoutExercises.where('logId').equals(log.id).sortBy('order')])
    return { ...s, wes }
  }, [log.id, exercises.size])
  const [busy, setBusy] = useState(false)
  const [now] = useState(Date.now())
  if (!data) return null

  const end = async () => {
    setBusy(true)
    await Promise.all([finishSession(log.id), new Promise((r) => setTimeout(r, 400))])
    onEnded()
  }
  const saveBack = async () => {
    await saveSessionToWorkout(log.id)
    toast('Saved to your workout')
  }

  return (
    <div className="pb-44">
      <TopBar title={log.name} onBack={onBack} right={<RoundBtn icon="pencil" label="Edit sets" onClick={onBack} />} />
      <div className="space-y-3 px-4">
        <p className="text-sm text-muted">Review your workout before you finish. You can go back to edit your sets.</p>
        <div className="flex gap-2">
          <Tile label="Total Time" value={fmtDuration(now - log.startedAt)} icon="timer" />
          <Tile label="Volume" value={fmtVolume(data.volume, 'kg')} icon="dumbbell" />
        </div>
        <div className="card p-4">
          <MuscleMap size="md" primary={data.primary} secondary={data.secondary} />
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">{data.primary.map((m) => <span key={m} className="chip text-xs">{label(m)}</span>)}</div>
        </div>
        <div className="card p-4">
          <h2 className="mb-2 font-bold">PRs</h2>
          {data.prs.length ? data.prs.map((s) => (
            <div key={s.id} className="flex items-center gap-2 py-1 text-sm">
              <Icon name="star" fill className="size-4 text-accent" />
              <span className="flex-1">{exercises.get(s.exerciseId)?.name}{s.side && ` (${s.side})`}</span>
              <span className="font-semibold">{fmtWeight(s.weight, u(s.exerciseId))}{s.weight != null && ` ${u(s.exerciseId)}`} × {s.reps}</span>
            </div>
          )) : <p className="text-sm text-muted">No new PRs this time.</p>}
        </div>
        {data.wes.map((we) => {
          const sets = data.sets.filter((s) => s.workoutExerciseId === we.id).sort(bySetOrder)
          return (
            <div key={we.id} className="card p-4">
              <h3 className="mb-2 font-bold">{exercises.get(we.exerciseId)?.name}</h3>
              {sets.length ? sets.map((s) => (
                <div key={s.id} className="flex justify-between py-0.5 text-sm">
                  <span className="text-muted">Set {s.order + 1}{s.side && ` ${s.side}`}{s.isDrop && ' (drop)'}</span>
                  <span>{fmtWeight(s.weight, u(s.exerciseId))}{s.weight != null && ` ${u(s.exerciseId)}`} × {s.reps ?? (s.durationSec ? fmtClock(s.durationSec) : '–')}</span>
                </div>
              )) : <p className="text-sm text-muted">No logged sets (empty rows are dropped when you end).</p>}
            </div>
          )
        })}
        <label className="block text-sm text-muted">Workout notes
          <textarea className="field mt-1 min-h-20 py-3 text-fg" defaultValue={log.notes} onBlur={(e) => db.workoutLogs.update(log.id, { notes: e.target.value, updatedAt: Date.now() })} />
        </label>
      </div>
      <div className="phone-fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 grid grid-cols-2 gap-2 px-4">
        <button className="btn-outline" onClick={saveBack}>Save Workout</button>
        <button className="btn-accent" onClick={end}>End Workout</button>
      </div>
      {busy && <Busy />}
    </div>
  )
}

export function Summary({ logId, onBack }: { logId: string; onBack: () => void }) {
  const exercises = useExercises()
  const log = useLiveQuery(() => db.workoutLogs.get(logId), [logId])
  const s = useLiveQuery(() => logSummary(logId, exercises), [logId, exercises.size])
  if (!log || !s) return null
  return (
    <div className="pb-8">
      <TopBar title="Workout Summary" onBack={onBack} />
      <div className="space-y-3 px-4">
        <div className="card py-4">
          <h2 className="mb-3 px-4 text-lg font-bold">{log.name} <span className="text-sm font-normal text-muted">· {fmtDate(log.startedAt)}</span></h2>
          <MuscleMap primary={s.primary} secondary={s.secondary} />
        </div>
        <div className="flex gap-2">
          <Tile label="Time" value={fmtDuration((log.endedAt ?? Date.now()) - log.startedAt)} icon="timer" />
          <Tile label="Volume" value={fmtVolume(s.volume, 'kg')} icon="dumbbell" />
        </div>
        <button className="btn-outline w-full" onClick={onBack}>Back to Home</button>
      </div>
    </div>
  )
}
