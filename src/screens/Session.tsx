import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import {
  addExercise, addSet, deleteLog, dropSet, finishSession, moveExercise, removeExercise, removeLastSet, replaceExercise,
  saveSessionToWorkout, setUnilateral, updateSet,
} from '../actions'
import { toast } from '../App'
import { db, isBodyweight, isTimed, stepFor, type Exercise, type WorkoutExercise, type WorkoutLog, type WSet } from '../db'
import { bySetOrder, logSummary, useExerciseHistory, useExercises, useSettings } from '../hooks'
import { fmtClock, fmtDate, fmtDuration, fmtVolume, fmtWeight, fromDisplay, toDisplay } from '../lib'
import MuscleMap from '../MuscleMap'
import { Busy, Icon, Pager, RoundBtn, Sheet, Tile, TopBar } from '../ui'
import Library, { HowTo, label } from './Library'

type Field = 'weight' | 'reps' | 'time'
export type Focus = { setId: string; field: Field; text: string | null } | null

/** Logging screen. Active sessions get the timer/End flow; finished ones (from Stats) are editable with Delete. */
export default function Session({ logId, onEnded, onClose }: { logId: string; onEnded?: (logId: string) => void; onClose?: () => void }) {
  const log = useLiveQuery(() => db.workoutLogs.get(logId), [logId])
  const wes = useLiveQuery(() => db.workoutExercises.where('logId').equals(logId).sortBy('order'), [logId])
  const exercises = useExercises()
  const [page, setPage] = useState(0)
  const [focus, setFocus] = useState<Focus>(null)
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
    <div className={focus ? 'pb-[22rem]' : 'pb-8'}>
      <header className="flex items-start gap-2 px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top))]">
        {onClose && <RoundBtn icon="chevL" label="Back" onClick={onClose} />}
        <div className="min-w-0 flex-1">
          <input className="w-full truncate bg-transparent text-3xl font-bold outline-none" defaultValue={log.name} key={log.id} aria-label="Workout name"
            onBlur={(e) => e.target.value.trim() && db.workoutLogs.update(log.id, { name: e.target.value.trim(), updatedAt: Date.now() })} />
          <p className="text-sm tabular-nums text-muted">{active ? <Elapsed since={log.startedAt} /> : `${fmtDate(log.startedAt)} · ${fmtDuration((log.endedAt ?? log.startedAt) - log.startedAt)}`}</p>
        </div>
        <RoundBtn icon={active ? 'x' : 'trash'} label={active ? 'Discard workout' : 'Delete workout'} className="bg-danger text-on-accent" onClick={discard} />
        {active && <button className="btn-dark min-h-10 px-4 text-sm" onClick={() => { setFocus(null); setReview(true) }}>End Workout</button>}
      </header>

      <Pager peek index={Math.min(page, wes.length)} onIndex={(i) => { setPage(i); setFocus(null) }} pages={[
        ...wes.map((we, i) => {
          const ex = exercises.get(we.exerciseId)
          return ex ? (
            <ExerciseCard key={we.id} we={we} ex={ex} log={log} focus={focus} setFocus={setFocus}
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

const secToDigits = (s: number | null) => (s ? String(Math.floor(s / 60) * 100 + (s % 60)) : '')
const digitsToSec = (d: string) => { const n = Number(d || 0); return Math.floor(n / 100) * 60 + (n % 100) }
const fmtDigits = (d: string) => { const n = d.padStart(3, '0'); return `${Number(n.slice(0, -2))}:${n.slice(-2)}` }

function ExerciseCard({ we, ex, log, focus, setFocus, onReplace, onMove, first, last }: {
  we: WorkoutExercise; ex: Exercise; log: WorkoutLog; focus: Focus; setFocus: (f: Focus) => void
  onReplace: () => void; onMove: (d: -1 | 1) => void; first: boolean; last: boolean
}) {
  const settings = useSettings(), { unit } = settings
  const rows = useLiveQuery(() => db.sets.where('workoutExerciseId').equals(we.id).toArray().then((r) => r.sort(bySetOrder)), [we.id])
  const hist = useExerciseHistory(ex.id, log.id, log.status === 'active' ? Infinity : log.startedAt)
  const [menu, setMenu] = useState(false)
  const [info, setInfo] = useState(false)
  const timed = isTimed(ex), bw = isBodyweight(ex)
  const second: Field = timed ? 'time' : 'reps'

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
  const valueOf = (r: WSet, f: Field) => (f === 'weight' ? toDisplay(r.weight, unit) : f === 'reps' ? r.reps : r.durationSec)
  const save = (r: WSet, f: Field, v: number | null) =>
    updateSet(r.id, f === 'weight' ? { weight: v == null ? null : fromDisplay(v, unit) } : f === 'reps' ? { reps: v == null ? null : Math.round(v) } : { durationSec: v })

  const copyRow = async (r: WSet) => {
    const src = prevRow(r) ?? placeholder(r)
    if (src) await updateSet(r.id, { weight: src.weight, reps: src.reps, durationSec: src.durationSec ?? null })
  }

  const focused = focus && rows.find((r) => r.id === focus.setId)
  const key = async (k: string) => {
    if (!focus || !focused) return
    const f = focus.field, cur = valueOf(focused, f)
    const curText = f === 'time' ? secToDigits(cur) : cur == null ? '' : String(cur)
    const ph = placeholder(focused)
    const phVal = ph ? (f === 'weight' ? toDisplay(ph.weight, unit) : f === 'reps' ? ph.reps : ph.durationSec ?? null) : null
    const write = (text: string) => {
      setFocus({ ...focus, text })
      if (f === 'time') return save(focused, f, text ? digitsToSec(text) : null)
      return save(focused, f, text === '' || text === '.' ? null : Number(text))
    }
    if (/^\d$/.test(k) || k === '.') {
      if (k === '.' && (f !== 'weight' || (focus.text ?? '').includes('.'))) return
      return write((focus.text ?? '') + k)
    }
    if (k === 'back') return write((focus.text ?? curText).slice(0, -1))
    if (k === '+' || k === '-') {
      const step = f === 'weight' ? stepFor(settings) : f === 'reps' ? 1 : 15
      const above = prevRow(focused)
      const base = cur ?? phVal ?? (above ? valueOf(above, f) : null) ?? 0
      setFocus({ ...focus, text: null })
      return save(focused, f, Math.max(0, Math.round((base + (k === '+' ? step : -step)) * 100) / 100))
    }
    if (k === 'copy') {
      const src = prevRow(focused)
      const v = src ? valueOf(src, f) : phVal
      setFocus({ ...focus, text: null })
      return save(focused, f, v ?? null)
    }
    if (k === 'next') {
      if (cur == null && phVal != null) await save(focused, f, phVal) // empty field accepts the greyed last-session value
      if (f === 'weight') return setFocus({ setId: focused.id, field: second, text: null })
      const i = rows.indexOf(focused)
      return setFocus(rows[i + 1] ? { setId: rows[i + 1].id, field: 'weight', text: null } : null)
    }
    if (k === 'hide') setFocus(null)
  }

  const fieldBtn = (r: WSet, f: Field) => {
    const isF = focus?.setId === r.id && focus.field === f
    const v = valueOf(r, f)
    const ph = placeholder(r)
    const phText = !ph ? '' : f === 'weight' ? (ph.weight == null ? (bw ? 'BW' : '') : String(toDisplay(ph.weight, unit))) : f === 'reps' ? String(ph.reps ?? '') : ph.durationSec ? fmtClock(ph.durationSec) : ''
    let shown: string, dim = false
    if (isF && focus.text !== null) shown = f === 'time' ? fmtDigits(focus.text) : focus.text
    else if (v != null) shown = f === 'time' ? fmtClock(v) : String(v)
    else { shown = phText || (f === 'weight' ? (bw ? 'BW' : unit + 's') : f === 'time' ? '0:00' : 'reps'); dim = true }
    return (
      <button aria-label={`Set ${setNo.get(r.order)}${r.side ? ' ' + r.side : ''} ${f}`}
        onClick={() => setFocus({ setId: r.id, field: f, text: null })}
        className={`flex h-11 min-w-0 flex-1 items-center justify-center rounded-xl bg-panel tabular-nums ${isF ? 'ring-2 ring-accent' : ''}`}>
        <span className={dim ? 'text-muted/60' : ''}>{shown}</span>
        {isF && <span className="caret ml-px h-5 w-0.5 bg-accent" />}
        {!dim && <span className="ml-1 text-xs text-muted">{f === 'weight' ? unit : f === 'reps' ? 'reps' : ''}</span>}
      </button>
    )
  }

  return (
    <section className="card p-4">
      <div className="mb-1 flex items-start gap-2">
        <h2 className="min-w-0 flex-1 text-xl font-bold leading-tight">{ex.name}</h2>
        {(ex.instructions.length > 0 || ex.images.length > 0) && <RoundBtn icon="info" label="How to" onClick={() => setInfo(true)} />}
        <RoundBtn icon="dots" label="Exercise options" onClick={() => setMenu(true)} />
      </div>
      <label className="mb-3 flex w-fit items-center gap-2 text-sm text-muted">
        <input type="checkbox" className="peer sr-only" checked={we.unilateral} onChange={(e) => { setFocus(null); void setUnilateral(we.id, e.target.checked) }} />
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

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2">
            <span className="w-7 shrink-0 text-center text-sm font-bold text-muted">
              {r.side === 'L' ? '' : r.isDrop ? 'D' : setNo.get(r.order)}
              {r.side && <span className="block text-[10px] font-normal">{r.side}</span>}
            </span>
            <button aria-label="Copy previous set" className="grid size-9 shrink-0 place-items-center text-accent" onClick={() => copyRow(r)}><Icon name="repeat" className="size-5" /></button>
            {fieldBtn(r, 'weight')}
            <span className="text-muted">×</span>
            {fieldBtn(r, second)}
            <span className={`w-7 shrink-0 text-center text-[10px] font-bold ${r.isPR ? 'text-accent' : 'text-transparent'}`}>PR</span>
          </div>
        ))}
      </div>

      <div className="my-4"><MuscleMap size="md" primary={ex.primaryMuscles} secondary={ex.secondaryMuscles} /></div>
      <div className="grid grid-cols-3 gap-2">
        <button className="btn min-h-11 bg-danger/15 px-2 text-sm text-danger" onClick={() => { setFocus(null); void removeLastSet(we.id) }} disabled={!rows.length}>Remove Set</button>
        <button className="btn-ghost min-h-11 px-2 text-sm" onClick={() => dropSet(we.id, fromDisplay(stepFor(settings), unit))}>Drop Set</button>
        <button className="btn min-h-11 bg-accent/20 px-2 text-sm text-accent" onClick={() => addSet(we.id)}>Add Set</button>
      </div>

      {focus && focused && <Numpad field={focus.field} onKey={key} step={focus.field === 'weight' ? stepFor(settings) : focus.field === 'reps' ? 1 : 15} />}

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

/** Custom keypad docked at the bottom; covers the tab bar. */
const Key = ({ k, onKey, children, className = '', disabled }: { k: string; onKey: (k: string) => void; children: React.ReactNode; className?: string; disabled?: boolean }) => (
  <button onClick={() => onKey(k)} disabled={disabled} className={`grid h-13 place-items-center rounded-2xl bg-panel text-xl font-semibold active:bg-line disabled:opacity-25 ${className}`}>{children}</button>
)

function Numpad({ field, onKey, step }: { field: Field; onKey: (k: string) => void; step: number }) {
  return (
    <div className="phone-fixed bottom-0 z-[55] border-t border-line bg-card px-2 pb-[calc(.5rem+env(safe-area-inset-bottom))] pt-2 slide-up" role="group" aria-label="Number pad">
      <div className="grid grid-cols-[1fr_3fr_1fr] gap-2">
        <div className="grid gap-2">
          <Key onKey={onKey} k="+" className="text-base text-accent">+{step}</Key>
          <Key onKey={onKey} k="-" className="text-base text-accent">−{step}</Key>
          <Key onKey={onKey} k="hide"><Icon name="kbd" /></Key>
          <span />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <Key onKey={onKey} key={d} k={d}>{d}</Key>)}
          <Key onKey={onKey} k="." disabled={field !== 'weight'}>.</Key>
          <Key onKey={onKey} k="0">0</Key>
          <Key onKey={onKey} k="back"><Icon name="back" /></Key>
        </div>
        <div className="grid grid-rows-[auto_1fr] gap-2">
          <Key onKey={onKey} k="copy" className="text-accent"><Icon name="repeat" /></Key>
          <button onClick={() => onKey('next')} className="rounded-2xl bg-accent text-lg font-bold text-on-accent active:opacity-80">Next</button>
        </div>
      </div>
    </div>
  )
}

function Review({ log, onBack, onEnded }: { log: WorkoutLog; onBack: () => void; onEnded: () => void }) {
  const exercises = useExercises()
  const { unit } = useSettings()
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
          <Tile label="Volume" value={fmtVolume(data.volume, unit)} icon="dumbbell" />
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
              <span className="font-semibold">{fmtWeight(s.weight, unit)} × {s.reps}</span>
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
                  <span>{fmtWeight(s.weight, unit)} × {s.reps ?? (s.durationSec ? fmtClock(s.durationSec) : '–')}</span>
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
  const { unit } = useSettings()
  const log = useLiveQuery(() => db.workoutLogs.get(logId), [logId])
  const s = useLiveQuery(() => logSummary(logId, exercises), [logId, exercises.size])
  if (!log || !s) return null
  return (
    <div className="pb-8">
      <TopBar title={log.name} onBack={onBack} sub={fmtDate(log.startedAt)} />
      <div className="space-y-3 px-4">
        <div className="card py-6"><MuscleMap primary={s.primary} secondary={s.secondary} /></div>
        <div className="flex gap-2">
          <Tile label="Time" value={fmtDuration((log.endedAt ?? Date.now()) - log.startedAt)} icon="timer" />
          <Tile label="Volume" value={fmtVolume(s.volume, unit)} icon="dumbbell" />
        </div>
        <button className="btn-outline w-full" onClick={onBack}>Back to Home</button>
      </div>
    </div>
  )
}
