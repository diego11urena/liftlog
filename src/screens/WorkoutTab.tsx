import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { removePlan, setPlan, startSession, type Selection } from '../actions'
import { toast } from '../App'
import { db, type Plan, type Workout, type WorkoutLog } from '../db'
import { logSummary, musclesOf, useActiveLog, useExercises, useStreak, useWeekStatus } from '../hooks'
import { addDays, dateKey, fmtDate, fmtDuration, fmtMDY, fmtVolume, fromKey, sundayOf } from '../lib'
import MuscleMap from '../MuscleMap'
import { Icon, NameModal, Pager, RoundBtn, Sheet, Tile, WeekStrip, type IconName } from '../ui'
import Library, { Radio } from './Library'
import Session, { Summary } from './Session'
import WorkoutsScreen, { WorkoutBuilder } from './Workouts'

type Screen = { kind: 'home' } | { kind: 'library' } | { kind: 'workouts' } | { kind: 'builder'; id?: string; name: string } | { kind: 'summary'; logId: string }

export default function WorkoutTab({ date, setDate }: { date: string; setDate: (k: string) => void }) {
  const active = useActiveLog()
  const [screen, setScreen] = useState<Screen>({ kind: 'home' })
  const home = () => setScreen({ kind: 'home' })

  if (screen.kind === 'summary') return <Summary logId={screen.logId} onBack={home} />
  if (active === undefined) return null
  if (active) return <Session logId={active.id} onEnded={(logId) => setScreen({ kind: 'summary', logId })} />
  if (screen.kind === 'library') return <Library onBack={home} />
  if (screen.kind === 'workouts') return <WorkoutsScreen onBack={home} />
  if (screen.kind === 'builder') return <WorkoutBuilder id={screen.id} newName={screen.name} onClose={home} />
  return <Home date={date} setDate={setDate} go={setScreen} />
}

type Page =
  | { kind: 'review'; log: WorkoutLog }
  | { kind: 'planned'; plan: Plan; workout: Workout }
  | { kind: 'rest'; plan: Plan }
  | { kind: 'none' }
  | { kind: 'empty' }

function Home({ date, setDate, go }: { date: string; setDate: (k: string) => void; go: (s: Screen) => void }) {
  const day = fromKey(date), today = dateKey(Date.now()), isToday = date === today, isPast = date < today
  const sunday = sundayOf(day)
  const status = useWeekStatus(sunday, addDays(sunday, 6))
  const [page, setPage] = useState(0)
  const [sheet, setSheet] = useState<{ replace?: Plan } | null>(null)
  const [menu, setMenu] = useState<Plan | null>(null)
  const [naming, setNaming] = useState(false)
  const data = useLiveQuery(async () => {
    const [plans, logs, workouts] = await Promise.all([
      db.plans.where('date').equals(date).toArray(),
      db.workoutLogs.where('startedAt').between(day, addDays(day, 1)).filter((l) => l.status === 'done').sortBy('startedAt'),
      db.workouts.toArray(),
    ])
    return { plans: plans.sort((a, b) => a.updatedAt - b.updatedAt), logs, workouts: new Map(workouts.map((w) => [w.id, w])) }
  }, [date])

  const pages: Page[] = []
  if (data) {
    const doneIds = new Set(data.logs.map((l) => l.workoutId))
    for (const log of data.logs) pages.push({ kind: 'review', log })
    for (const plan of data.plans) {
      if (plan.type === 'rest') pages.push({ kind: 'rest', plan })
      else {
        const w = plan.workoutId ? data.workouts.get(plan.workoutId) : undefined
        if (w && !doneIds.has(w.id)) pages.push({ kind: 'planned', plan, workout: w })
      }
    }
    if (!pages.length) pages.push(isPast ? { kind: 'none' } : { kind: 'empty' })
    else if (!isPast && !pages.some((p) => p.kind === 'rest')) pages.push({ kind: 'empty' })
  }
  const cur = pages[Math.min(page, pages.length - 1)]
  const doneDay = !!data?.logs.length
  const title = !cur ? '' : cur.kind === 'review' ? cur.log.name : cur.kind === 'planned' ? cur.workout.name : cur.kind === 'rest' ? 'Rest'
    : cur.kind === 'none' ? 'No Workout' : isToday ? 'Freestyle' : 'Not Planned Yet!'
  // a planned workout can be started from any day (it's logged today); freestyle only from today's "+" page (owner, 2026-10-19)
  const canStart = !!cur && (cur.kind === 'planned' || (cur.kind === 'empty' && isToday))
  const start = () => {
    if (!cur || !canStart) return
    void startSession(cur.kind === 'planned' ? cur.workout : undefined, 'Freestyle')
  }
  const pick = (k: string) => { setDate(k); setPage(0) }

  return (
    <div className="pb-4">
      <header className="flex items-start gap-2 px-[18px] pb-[18px] pt-[calc(28px+env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <h1 className={`truncate text-[38px] font-semibold leading-[1.1] ${doneDay ? 'text-acc-t' : ''}`}>{title}</h1>
          <p className="num mt-1 text-[13px] text-muted">{fmtMDY(day)}{doneDay ? ' · Done' : isToday ? ' · Today' : ''}</p>
        </div>
        <RoundBtn icon="bell" label="Exercise library" onClick={() => go({ kind: 'library' })} />
        <button className="btn-outline min-h-[46px] px-4 text-[15px]" onClick={() => go({ kind: 'workouts' })}>Workouts</button>
      </header>

      <div className="mb-4 px-3">
        <WeekStrip sunday={sunday} selected={date} status={status} onSelect={pick} onWeek={(d) => pick(dateKey(addDays(day, 7 * d)))} />
      </div>

      {data && (
        <Pager key={date} index={Math.min(page, pages.length - 1)} onIndex={setPage} pages={pages.map((p, i) => (
          <DayCard key={i} p={p} isToday={isToday} onPlus={() => setSheet({})} onMenu={setMenu} onStartFree={() => startSession(undefined, 'Freestyle')}
            onReview={(logId) => go({ kind: 'summary', logId })} onPlanRest={(plan) => (isToday ? startSession(undefined, 'Freestyle') : setSheet({ replace: plan }))} />
        ))} />
      )}

      <div className="mt-4 px-[18px] pb-6">
        <button className="btn-accent w-full disabled:bg-panel disabled:text-muted disabled:opacity-100" disabled={!canStart} onClick={start}>Start Workout</button>
      </div>

      {sheet && (
        <PlanSheet date={date} replace={sheet.replace} hasLogs={doneDay} onClose={() => setSheet(null)}
          onCreate={() => { setSheet(null); setNaming(true) }} />
      )}
      {menu && (
        <Sheet label="Plan options" onClose={() => setMenu(null)}>
          <div className="space-y-2 p-4">
            <button className="btn-ghost w-full" onClick={() => { setSheet({ replace: menu }); setMenu(null) }}>Change plan</button>
            {menu.workoutId && <button className="btn-ghost w-full" onClick={() => { go({ kind: 'builder', id: menu.workoutId, name: '' }); setMenu(null) }}>Edit workout</button>}
            <button className="btn-ghost w-full text-danger" onClick={() => { void removePlan(menu.id); setMenu(null); setPage(0) }}>Remove from {fmtDate(day)}</button>
          </div>
        </Sheet>
      )}
      {naming && <NameModal onClose={() => setNaming(false)} onConfirm={(name) => { setNaming(false); go({ kind: 'builder', name }) }} />}
    </div>
  )
}

/** Light card (finished day, empty states). */
function LightCard({ title, sub, action, dashed, children }: { title: string; sub?: ReactNode; action?: ReactNode; dashed?: boolean; children: ReactNode }) {
  return (
    <div className={`flex min-h-[460px] flex-col rounded-[28px] bg-card p-[22px] ${dashed ? 'border-[1.5px] border-dashed border-figure-lines' : 'border border-line'}`}>
      <div className="mb-3.5 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[26px] font-semibold leading-tight">{title}</h2>
          {sub && <p className="truncate text-[15px] text-muted">{sub}</p>}
        </div>
        {action}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4">{children}</div>
    </div>
  )
}

const Dim = ({ icon, className = 'text-figure' }: { icon: IconName; className?: string }) => <Icon name={icon} className={`size-24 ${className}`} />

function DayCard({ p, isToday, onPlus, onMenu, onReview, onStartFree, onPlanRest }: {
  p: Page; isToday: boolean; onPlus: () => void; onMenu: (p: Plan) => void; onReview: (logId: string) => void; onStartFree: () => void; onPlanRest: (p: Plan) => void
}) {
  const exercises = useExercises()
  const prev = useLiveQuery(async () => {
    if (p.kind !== 'planned') return null
    const last = await db.workoutLogs.where('workoutId').equals(p.workout.id).filter((l) => l.status === 'done').reverse().sortBy('startedAt')
    if (!last[0]) return 'None'
    const s = await logSummary(last[0].id, exercises)
    return `${fmtVolume(s.volume, 'kg')} · ${fmtDuration((last[0].endedAt ?? last[0].startedAt) - last[0].startedAt)}`
  }, [p, exercises.size])
  const streak = useStreak().current
  const review = useLiveQuery(async () => (p.kind === 'review' ? logSummary(p.log.id, exercises) : null), [p, exercises.size])

  switch (p.kind) {
    case 'planned': {
      const m = musclesOf(p.workout.exercises.map((e) => e.exerciseId), exercises)
      const names = p.workout.exercises.map((e) => exercises.get(e.exerciseId)?.name ?? '?')
      return (
        <div className="ink-panel flex min-h-[460px] flex-col p-[22px]">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="label text-glow">Planned workout</div>
              <p className="num mt-1.5 truncate text-[15px] text-muteink">Prev. {prev ?? '…'}</p>
            </div>
            <RoundBtn onInk icon="dots" label="Plan options" onClick={() => onMenu(p.plan)} />
          </div>
          <div className="flex flex-1 items-center py-4"><MuscleMap w={88} surface="d" labels primary={m.primary} secondary={m.secondary} /></div>
          <div className="flex flex-wrap justify-center gap-2">
            {names.slice(0, 3).map((n, i) => <span key={i} className="inline-flex min-h-[30px] items-center rounded-full bg-[#ffffff16] px-3 text-[13px] font-medium">{n}</span>)}
            {names.length > 3 && <span className="inline-flex min-h-[30px] items-center rounded-full border-[1.5px] border-dashed border-[#ffffff4a] px-3 text-[13px] font-medium text-muteink">+{names.length - 3} more</span>}
            {!names.length && <span className="text-sm text-muteink">No exercises yet. Use ⋯ → Edit workout.</span>}
          </div>
          {isToday && streak > 0 && <p className="num mt-4 text-center text-[12.5px] text-muteink">Keep your {streak}-day streak going.</p>}
        </div>
      )
    }
    case 'review':
      return (
        <LightCard title="Workout Review" sub={p.log.name} action={<RoundBtn icon="eye" label="Open summary" onClick={() => onReview(p.log.id)} />}>
          <div className="flex flex-1 items-center">{review && <MuscleMap w={88} labels primary={review.primary} secondary={review.secondary} />}</div>
          <div className="flex w-full gap-2">
            <Tile label="PRs" value={review?.prs.length ?? 0} />
            <Tile label="Volume" value={fmtVolume(review?.volume ?? 0, 'kg')} />
            <Tile label="Time" value={fmtDuration((p.log.endedAt ?? p.log.startedAt) - p.log.startedAt)} />
          </div>
        </LightCard>
      )
    case 'rest':
      return (
        <div className="relative flex min-h-[460px] flex-col rounded-[28px] bg-rest-panel p-[22px] text-rest-text" style={{ backgroundImage: 'radial-gradient(#ffffff12 1px, transparent 1px)', backgroundSize: '14px 14px' }}>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="text-[26px] font-semibold leading-tight">Rest Day</h2>
              <p className="text-[15px] text-rest-mute">Recovery day</p>
            </div>
            <RoundBtn onInk icon="dots" label="Plan options" onClick={() => onMenu(p.plan)} />
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-6">
            <Dim icon="moon" className="text-rest-icon" />
            <button className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-rest-line px-5 text-[15px] font-semibold" onClick={() => onPlanRest(p.plan)}>Log a workout</button>
          </div>
        </div>
      )
    case 'none':
      return <LightCard dashed title="No Workout" sub="Nothing logged"><Dim icon="moon" /></LightCard>
    case 'empty':
      return (
        <LightCard title="Not Planned Yet!">
          <button aria-label="Plan this day" onClick={onPlus} className="grid size-[88px] place-items-center rounded-full bg-fg text-onink active:scale-95"><Icon name="plus" className="size-9" /></button>
          <p className="max-w-56 text-center text-[15px] text-muted">Tap + to plan a workout or add a rest day.</p>
          {isToday && <button className="chip mt-2 min-h-11" onClick={onStartFree}>or just start a freestyle workout below</button>}
        </LightCard>
      )
  }
}

function PlanSheet({ date, replace, hasLogs, onClose, onCreate }: { date: string; replace?: Plan; hasLogs: boolean; onClose: () => void; onCreate: () => void }) {
  const workouts = useLiveQuery(() => db.workouts.orderBy('name').toArray(), [])
  const activeToday = useActiveLog()
  const initial = replace ? (replace.type === 'workout' ? replace.workoutId! : replace.type) : ''
  const [sel, setSel] = useState(initial)
  const isToday = date === dateKey(Date.now())
  const when = isToday ? 'Today' : new Date(fromKey(date)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  // Hide Rest once the day already has a started or logged workout.
  const hideRest = hasLogs || (isToday && !!activeToday)
  const chosen = workouts?.find((w) => w.id === sel)
  const cta = sel === initial || !sel ? 'Change to Selection' : sel === 'rest' ? 'Set as Rest Day' : `Set ${chosen?.name} for ${when}`

  // close right away and save in the background: the write is local and near-instant
  const apply = () => {
    const s: Selection = sel === 'rest' ? { type: 'rest' } : { type: 'workout', workoutId: sel }
    onClose()
    setPlan(date, s, replace?.id).catch((e: Error) => toast(`Couldn't save the plan: ${e.message}`))
  }
  const row = (id: string, name: string, icon?: IconName) => <PlanRow key={id} id={id} name={name} icon={icon} sel={sel} setSel={setSel} />

  return (
    <Sheet full label="Plan the day" onClose={onClose}>
      <div className="grid grid-cols-[46px_1fr_46px] items-center gap-2 px-[18px] pb-3 pt-[calc(28px+env(safe-area-inset-top))]">
        <RoundBtn icon="chevL" label="Back" onClick={onClose} />
        <h2 className="text-center font-semibold">{fmtDate(fromKey(date))}</h2>
        <RoundBtn icon="plus" label="Create workout" onClick={onCreate} />
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-4">
        <section>
          <h3 className="label mb-2">Presets</h3>
          {hideRest ? <p className="card p-4 text-sm text-muted">Rest isn't available once a workout is logged or started that day.</p> : (
            <ul className="card divide-y divide-line overflow-hidden">{row('rest', 'Rest', 'moon')}</ul>
          )}
        </section>
        <section>
          <h3 className="label mb-2">Your Workouts</h3>
          {workouts?.length ? (
            <ul className="card divide-y divide-line overflow-hidden">{workouts.map((w) => row(w.id, w.name))}</ul>
          ) : <p className="card p-4 text-sm text-muted">No saved workouts yet. Tap + to create one.</p>}
        </section>
      </div>
      <div className="p-4">
        <button className="btn-accent w-full disabled:bg-panel disabled:text-muted disabled:opacity-100" disabled={sel === initial || !sel} onClick={apply}>
          {cta}
        </button>
      </div>
    </Sheet>
  )
}

function PlanRow({ id, icon, name, sel, setSel }: { id: string; icon?: IconName; name: string; sel: string; setSel: (id: string) => void }) {
  return (
    <li>
      <button className="flex min-h-14 w-full items-center gap-3 px-4 text-left" onClick={() => setSel(id)} aria-pressed={sel === id}>
        {icon && <Icon name={icon} className="size-5 text-muted" />}
        <span className="flex-1 font-medium">{name}</span>
        <Radio on={sel === id} />
      </button>
    </li>
  )
}
