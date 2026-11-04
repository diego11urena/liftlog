import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import {
  addExercise, addSet, endOf, deleteLog, MAX_SETS, dropSet, finishSession, moveExercise, removeExercise, removeLastSet, replaceExercise,
  markNoteDone, saveSessionToWorkout, setUnilateral, updateSet,
} from '../actions'
import { toast } from '../App'
import { db, isBodyweight, isTimed, unitOf, type Exercise, type Unit, type WorkoutExercise, type WorkoutLog, type WSet } from '../db'
import { bySetOrder, logSummary, useExerciseHistory, useExercises, usePendingNotes } from '../hooks'
import { fmtClock, fmtDate, fmtDuration, fmtVolume, fmtWeight, fromDisplay, toDisplay } from '../lib'
import MuscleMap from '../MuscleMap'
import { ask, Busy, Icon, Pager, RoundBtn, Sheet, Tile, TopBar } from '../ui'
import Library, { label } from './Library'

/** Logging screen. Active sessions get the timer/End flow; finished ones (from Stats) are editable with Delete. */
export default function Session({ logId, onEnded, onClose }: { logId: string; onEnded?: (logId: string) => void; onClose?: () => void }) {
  const log = useLiveQuery(() => db.workoutLogs.get(logId), [logId])
  const wes = useLiveQuery(() => db.workoutExercises.where('logId').equals(logId).sortBy('order'), [logId])
  const exercises = useExercises()
  const [page, setPage] = useState(0)
  const [lib, setLib] = useState<null | { replace?: string }>(null)
  const [review, setReview] = useState(false)
  const pending = usePendingNotes(log, (wes ?? []).map((w) => w.exerciseId))

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
    if (await ask(active
      ? { title: 'Discard this workout?', message: 'Everything logged in it will be deleted.', confirm: 'Discard', danger: true }
      : { title: 'Delete this workout?', message: "It will be removed from your history.", confirm: 'Delete', danger: true })) {
      await deleteLog(logId); onClose?.()
    }
  }

  return (
    <div className="pb-8">
      <header className="flex items-start gap-2 px-[18px] pb-4 pt-[calc(28px+env(safe-area-inset-top))]">
        {onClose && <RoundBtn icon="chevL" label="Back" onClick={onClose} />}
        <div className="min-w-0 flex-1">
          <input className="w-full truncate bg-transparent text-[32px] font-semibold leading-tight tracking-[-0.02em] outline-none" defaultValue={log.name} key={log.id} aria-label="Workout name"
            onBlur={(e) => e.target.value.trim() && db.workoutLogs.update(log.id, { name: e.target.value.trim(), updatedAt: Date.now() })} />
          <p className="num text-xl font-medium text-muted">{active ? <Elapsed since={log.startedAt} /> : `${fmtDate(log.startedAt)} · ${fmtDuration((log.endedAt ?? log.startedAt) - log.startedAt)}`}</p>
        </div>
        <RoundBtn icon={active ? 'x' : 'trash'} label={active ? 'Discard workout' : 'Delete workout'} className="text-danger" onClick={discard} />
        {active && <button className="btn-dark min-h-[46px] px-5 text-[15px]" onClick={() => setReview(true)}>End Workout</button>}
      </header>

      <Pager accent index={Math.min(page, wes.length)} onIndex={setPage} marks={wes.map((w) => pending.has(w.exerciseId))} pages={[
        ...wes.map((we, i) => {
          const ex = exercises.get(we.exerciseId)
          return ex ? (
            <ExerciseCard key={we.id} we={we} ex={ex} log={log} pending={pending.get(we.exerciseId)} n={i + 1} total={wes.length}
              onReplace={() => setLib({ replace: we.id })} first={i === 0} last={i === wes.length - 1}
              onMove={async (d) => { await moveExercise(logId, we.id, d); setPage(i + d) }} />
          ) : <div key={we.id} />
        }),
        <div key="add" className="card grid min-h-80 place-items-center p-6">
          <button className="flex min-h-11 flex-col items-center gap-3 text-acc-t" onClick={() => setLib({})}>
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

const PRTag = () => <span className="rounded-md bg-accent px-1.5 py-px text-[11px] font-semibold leading-4 text-on-accent">PR</span>

function ExerciseCard({ we, ex, log, pending, n, total, onReplace, onMove, first, last }: {
  we: WorkoutExercise; ex: Exercise; log: WorkoutLog; pending?: { we: WorkoutExercise; date: number }; n: number; total: number
  onReplace: () => void; onMove: (d: -1 | 1) => void; first: boolean; last: boolean
}) {
  const unit = unitOf(ex)
  const rows = useLiveQuery(() => db.sets.where('workoutExerciseId').equals(we.id).toArray().then((r) => r.sort(bySetOrder)), [we.id])
  const hist = useExerciseHistory(ex.id, log.id, log.status === 'active' ? Infinity : log.startedAt)
  const [menu, setMenu] = useState(false)
  const timed = isTimed(ex), bw = isBodyweight(ex)

  if (!rows) return null
  const setNo = new Map<number, number>()
  for (const r of rows) if (!setNo.has(r.order)) setNo.set(r.order, setNo.size + 1)

  /** Gray hint = the last set you did of this exercise: the latest logged set above this row in this workout,
   *  else the last set of your previous session, else the saved workout's numbers (owner, 2026-10-19). */
  const placeholder = (r: WSet) => {
    const lastOf = (l: WSet[]) => l.filter((s) => s.side === r.side).at(-1) ?? l.at(-1) // prefer the same side (R/L)
    const m = lastOf(rows.filter((s) => s.completedAt && s.order < r.order)) ?? lastOf(hist?.last?.sets ?? [])
    if (m) return m
    const plan = we.planSets?.filter((s) => s.side === r.side || (!s.side && !r.side))
    const p = plan?.[r.order]
    return p && (p.weight != null || p.reps != null || p.durationSec) ? { weight: p.weight, reps: p.reps, durationSec: p.durationSec ?? null } : null
  }
  /** The same set (number and side) from the previous session: the chip beside each row. */
  const prevSession = (r: WSet) => hist?.last?.sets.find((s) => s.order === r.order && s.side === r.side)
  const showSet = (s: { weight: number | null; reps: number | null; durationSec: number | null }) =>
    `${fmtWeight(s.weight, unit)}×${timed ? (s.durationSec ? fmtClock(s.durationSec) : '–') : (s.reps ?? '–')}`
  const copyRow = async (r: WSet) => {
    const src = prevSession(r)
    if (src) await updateSet(r.id, { weight: src.weight, reps: src.reps, durationSec: src.durationSec ?? null })
  }
  const setUnit = (u: Unit) => db.exercises.update(ex.id, { unit: u, updatedAt: Date.now() })
  const names = (l: typeof ex.primaryMuscles) => l.map(label).join(', ') || '–'

  return (
    <section className="card space-y-3.5 p-[22px]">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="label">Exercise {n} of {total}</div>
          <h2 className="mt-1 text-[26px] font-semibold leading-tight">{ex.name}</h2>
        </div>
        <RoundBtn icon="dots" label="Exercise options" onClick={() => setMenu(true)} />
      </div>

      {/* muscles trained, right under the name */}
      <div className="flex items-center gap-4">
        <MuscleMap w={40} primary={ex.primaryMuscles} secondary={ex.secondaryMuscles} />
        <div className="min-w-0 flex-1 space-y-2 text-sm">
          <div><div className="label flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--p-l)]" />Primary</div><div className="font-semibold">{names(ex.primaryMuscles)}</div></div>
          <div><div className="label flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--s-l)]" />Secondary</div><div className="font-semibold">{names(ex.secondaryMuscles)}</div></div>
        </div>
      </div>

      {ex.notes?.trim() && <p className="flex items-start gap-2 text-[13.5px] text-muted"><Icon name="pin" className="mt-0.5 size-4 shrink-0" /><span className="whitespace-pre-wrap">{ex.notes}</span></p>}
      {pending && <NextTimeNote note={pending.we.notes} date={pending.date} onDone={() => void markNoteDone(pending.we.id, log.id)} />}

      {/* last session + PR at a glance; both update live */}
      <div className="flex items-center justify-between gap-3 rounded-[14px] bg-panel px-3.5 py-3">
        {hist?.last || hist?.top ? (
          <>
            <div className="min-w-0">
              <div className="label">Last{hist.last && ` · ${fmtDate(hist.last.date).replace(/, \d{4}$/, '')}`}</div>
              <div className="num mt-0.5 truncate text-[13px]">{hist.last ? hist.last.sets.map(showSet).join(' · ') : '–'}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="label">PR</div>
              <div className="num mt-0.5 text-[17px] font-semibold">{hist.top ? (hist.top.weight == null ? `BW×${hist.top.reps}` : `${fmtWeight(hist.top.weight, unit)}×${hist.top.reps}`) : '–'}</div>
            </div>
          </>
        ) : <div className="text-sm text-muted">{hist ? 'No history yet' : '…'}</div>}
      </div>

      <div className="flex items-center justify-between">
        <span className="label">Sets</span>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" className="peer sr-only" checked={we.unilateral} onChange={(e) => void setUnilateral(we.id, e.target.checked)} />
          Unilateral
          <span className="relative h-[22px] w-[38px] rounded-full bg-figure-lines transition peer-checked:bg-fg after:absolute after:left-0.5 after:top-0.5 after:size-[18px] after:rounded-full after:bg-card after:transition peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-fg" />
        </label>
      </div>

      <div className="space-y-2">
        {rows.map((r) => {
          const ph = placeholder(r), no = setNo.get(r.order), logged = r.completedAt > 0, prev = prevSession(r)
          const box = `h-10 min-w-0 rounded-[10px] ${logged ? 'bg-panel' : 'border-[1.5px] border-dashed border-fg/35'}`
          return (
            <div key={r.id} className="grid min-h-11 grid-cols-[20px_1fr_10px_64px_70px] items-center gap-1.5">
              <span className="num text-center text-sm font-semibold text-muted">
                {r.side === 'L' ? '' : r.isDrop ? 'D' : no}
                {r.side && <span className="block text-[10px] font-medium">{r.side}</span>}
              </span>
              {/* weight with its unit right beside it, in one box */}
              <span className={`relative flex items-center focus-within:ring-2 focus-within:ring-fg ${box}`}>
                {r.isPR && <span className="absolute -top-2 right-2"><PRTag /></span>}
                <NumField kind="weight" bare label={`Set ${no}${r.side ? ' ' + r.side : ''} weight (${unit})`} value={toDisplay(r.weight, unit)}
                  placeholder={ph?.weight != null ? String(toDisplay(ph.weight, unit)) : bw ? 'BW' : '0'}
                  onSave={(v) => updateSet(r.id, { weight: v == null ? null : fromDisplay(v, unit) })} />
                <UnitPicker unit={unit} label={`Weight unit for ${ex.name}`} onChange={setUnit} />
              </span>
              <span className="text-center text-muted">×</span>
              <span className={`flex items-center focus-within:ring-2 focus-within:ring-fg ${box}`}>
                {timed
                  ? <NumField kind="time" bare center label={`Set ${no}${r.side ? ' ' + r.side : ''} time`} value={r.durationSec}
                      placeholder={ph?.durationSec ? fmtClock(ph.durationSec) : '--:--'} onSave={(v) => updateSet(r.id, { durationSec: v })} />
                  : <NumField kind="reps" bare center label={`Set ${no}${r.side ? ' ' + r.side : ''} reps`} value={r.reps}
                      placeholder={ph?.reps != null ? String(ph.reps) : 'reps'} onSave={(v) => updateSet(r.id, { reps: v })} />}
              </span>
              {prev
                ? <button aria-label={`Copy last session's set: ${showSet(prev)}`} onClick={() => copyRow(r)} className="num flex min-h-11 items-center justify-end gap-1 text-xs text-muted">
                    <Icon name="repeat" className="size-3.5 text-acc-t" />{showSet(prev)}
                  </button>
                : <span />}
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-3 gap-2 pt-1">
        <button className="btn-outline min-h-[42px] border-danger px-2 text-sm text-danger" onClick={() => removeLastSet(we.id)} disabled={!rows.length}>Remove Set</button>
        <button className="btn-ghost min-h-[42px] px-2 text-sm" disabled={setNo.size >= MAX_SETS} onClick={() => dropSet(we.id, unit === 'kg' ? 2.5 : fromDisplay(5, 'lb'))}>Drop Set</button>
        <button className="btn-accent min-h-[42px] px-2 text-sm" disabled={setNo.size >= MAX_SETS} onClick={() => addSet(we.id)}>Add Set</button>
      </div>

      {menu && (
        <Sheet label="Exercise options" onClose={() => setMenu(false)}>
          <div className="space-y-2 px-[18px] pb-6 pt-5">
            <button className="btn-ghost w-full" onClick={() => { setMenu(false); onReplace() }}>Replace exercise</button>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-ghost" disabled={first} onClick={() => { setMenu(false); onMove(-1) }}>Move left</button>
              <button className="btn-ghost" disabled={last} onClick={() => { setMenu(false); onMove(1) }}>Move right</button>
            </div>
            <label className="block text-sm text-muted">Note for next time <span className="text-xs">(shown once, the next time you do this exercise)</span>
              <textarea className="field mt-1 min-h-20 py-3 text-fg" defaultValue={we.notes} onChange={(e) => db.workoutExercises.update(we.id, { notes: e.target.value })} />
            </label>
            <label className="block text-sm text-muted">Permanent note <span className="text-xs">(always shown on this exercise; clear it to remove)</span>
              <textarea className="field mt-1 min-h-20 py-3 text-fg" defaultValue={ex.notes} onChange={(e) => db.exercises.update(ex.id, { notes: e.target.value })} />
            </label>
            <button className="btn-ghost w-full text-danger" onClick={async () => { if (await ask({ title: `Remove ${ex.name}?`, message: 'Its sets in this workout will be deleted.', confirm: 'Remove', danger: true })) { setMenu(false); void removeExercise(we.id) } }}>Remove exercise</button>
          </div>
        </Sheet>
      )}
    </section>
  )
}

/** A note left in an earlier session for this exercise. Tap to read; Done marks it handled without logging a set. */
function NextTimeNote({ note, date, onDone }: { note: string; date: number; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-[14px] border-[1.5px] border-dashed border-accent bg-accent/12 px-3">
      <button className="flex min-h-10 w-full items-center gap-2 text-left text-sm font-semibold text-acc-t" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="info" className="size-4 shrink-0" />
        <span className="flex-1">You have a note for this exercise</span>
        <Icon name={open ? 'chevD' : 'chevR'} className="size-4 shrink-0" />
      </button>
      {open && (
        <div className="space-y-2 pb-3">
          <p className="whitespace-pre-wrap text-sm">{note}</p>
          <div className="flex items-center justify-between gap-2">
            <span className="num text-xs text-muted">Written {fmtDate(date)}</span>
            <button className="btn-ghost min-h-11 px-4 text-sm" onClick={onDone}>Done</button>
          </div>
        </div>
      )}
    </div>
  )
}

/** kg/lb beside the weight. The visible text is small; a transparent real <select> (16px, so iOS never zooms) sits on top,
 *  and iPhone opens its native wheel. Every row of an exercise shows the same value because the unit is saved on the exercise. */
function UnitPicker({ unit, label, onChange }: { unit: Unit; label: string; onChange: (u: Unit) => void }) {
  return (
    <span className="relative flex h-full shrink-0 items-center gap-0.5 pl-1 pr-2 text-[11.5px] text-muted">
      {unit}<Icon name="chevD" className="size-3" />
      <select aria-label={label} value={unit} onChange={(e) => onChange(e.target.value as Unit)} className="absolute -inset-y-0.5 inset-x-0 w-full cursor-pointer opacity-0">
        <option value="kg">kg</option>
        <option value="lb">lb</option>
      </select>
    </span>
  )
}

/** Native input (iPhone numeric keypad). Keeps the typed text locally so "62." isn't eaten; saves on every change. */
function NumField({ kind, value, placeholder, label, onSave, center }: {
  kind: 'weight' | 'reps' | 'time'; value: number | null; placeholder: string; label: string; onSave: (v: number | null) => void; bare?: boolean; center?: boolean
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
      className={`num h-full w-0 min-w-0 flex-1 bg-transparent text-[17px] font-semibold outline-none placeholder:font-semibold placeholder:text-muted/60 ${center ? 'text-center' : 'pr-1 text-right'}`} />
  )
}

/** Dotted-leader row: label left, value right. */
const Ledger = ({ k, v, pr }: { k: string; v: string; pr?: boolean }) => (
  <div className="flex items-baseline gap-2 py-1 text-[14.5px]">
    <span className="text-muted">{k}</span>
    <span className="flex-1 border-b-[1.5px] border-dotted border-figure-lines" />
    <span className="flex items-center gap-1.5">{pr && <PRTag />}<span className="num font-semibold">{v}</span></span>
  </div>
)

function Review({ log, onBack, onEnded }: { log: WorkoutLog; onBack: () => void; onEnded: () => void }) {
  const exercises = useExercises()
  const u = (exerciseId: string) => unitOf(exercises.get(exerciseId))
  const data = useLiveQuery(async () => {
    const [s, wes] = await Promise.all([logSummary(log.id, exercises), db.workoutExercises.where('logId').equals(log.id).sortBy('order')])
    return { ...s, wes, end: await endOf(log.id) }
  }, [log.id, exercises.size])
  const [busy, setBusy] = useState(false)
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
  const wt = (s: { weight: number | null; exerciseId: string }) => (s.weight == null ? 'BW' : `${fmtWeight(s.weight, u(s.exerciseId))} ${u(s.exerciseId)}`)

  return (
    <div className="pb-4">
      <TopBar title={log.name} onBack={onBack} right={<RoundBtn icon="pencil" label="Edit sets" onClick={onBack} />} />
      <div className="space-y-4 px-[18px]">
        <p className="text-[15px] text-muted">Review your workout before you finish. You can go back to edit your sets.</p>
        <div className="flex gap-3">
          <Tile tone="paper" big label="Total time" value={fmtDuration(data.end - log.startedAt)} />
          <Tile tone="paper" big label="Volume" value={fmtVolume(data.volume, 'kg')} />
        </div>
        <div className="ink-panel p-[22px]">
          <MuscleMap w={92} surface="d" primary={data.primary} secondary={data.secondary} />
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {data.primary.map((m) => <span key={m} className="inline-flex min-h-[30px] items-center rounded-full bg-[#ffffff16] px-3 text-[13px] font-medium">{label(m)}</span>)}
          </div>
        </div>
        <div className="card p-[18px]">
          <h2 className="mb-2 text-lg font-semibold">New PRs · <span className="num">{data.prs.length}</span></h2>
          {data.prs.length ? data.prs.map((s) => (
            <div key={s.id} className="flex items-center gap-2 py-1.5 text-[15px]">
              <Icon name="star" fill className="size-4 text-acc-t" />
              <span className="flex-1">{exercises.get(s.exerciseId)?.name}{s.side && ` (${s.side})`}</span>
              <span className="num font-semibold">{wt(s)} × {s.reps}</span>
            </div>
          )) : <p className="text-sm text-muted">No new PRs this time.</p>}
        </div>
        {data.wes.map((we) => {
          const sets = data.sets.filter((s) => s.workoutExerciseId === we.id).sort(bySetOrder)
          return (
            <div key={we.id} className="card p-[18px]">
              <h3 className="mb-2 text-lg font-semibold">{exercises.get(we.exerciseId)?.name}</h3>
              {sets.length ? sets.map((s) => (
                <Ledger key={s.id} pr={s.isPR} k={`Set ${s.order + 1}${s.side ? ` ${s.side}` : ''}${s.isDrop ? ' (drop)' : ''}`}
                  v={`${wt(s)} × ${s.reps ?? (s.durationSec ? fmtClock(s.durationSec) : '–')}`} />
              )) : <p className="text-sm text-muted">No logged sets (empty rows are dropped when you end).</p>}
            </div>
          )
        })}
        <label className="block text-sm text-muted">Workout notes
          <textarea className="field mt-1 min-h-20 py-3 text-fg" defaultValue={log.notes} onBlur={(e) => db.workoutLogs.update(log.id, { notes: e.target.value, updatedAt: Date.now() })} />
        </label>
      </div>
      <div className="mt-4 grid gap-3 px-[18px] pb-6">
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
      <div className="space-y-4 px-[18px]">
        <div className="ink-panel flex min-h-[560px] flex-col p-[22px]">
          <div className="label text-muteink">Finished · {new Date(log.startedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
          <h2 className="mt-1 text-[36px] font-semibold leading-[1.1]">{log.name}</h2>
          <div className="flex flex-1 items-center py-5"><MuscleMap w={108} surface="d" primary={s.primary} secondary={s.secondary} /></div>
          <div className="flex gap-3">
            <Tile tone="ink" big label="Time" value={fmtDuration((log.endedAt ?? Date.now()) - log.startedAt)} />
            <Tile tone="ink" big label="Volume" value={fmtVolume(s.volume, 'kg')} />
          </div>
        </div>
        <button className="btn-accent w-full" onClick={onBack}>Back to Home</button>
      </div>
    </div>
  )
}
