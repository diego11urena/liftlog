import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { removePlan, setPlan, startSession, type Selection } from '../actions'
import { db, type Plan, type Workout, type WorkoutLog } from '../db'
import { logSummary, musclesOf, useActiveLog, useExercises, useSettings, useWeekStatus } from '../hooks'
import { addDays, dateKey, fmtDate, fmtDuration, fmtMDY, fmtVolume, fromKey, sundayOf } from '../lib'
import MuscleMap from '../MuscleMap'
import { Icon, NameModal, Pager, RoundBtn, Sheet, Spinner, Tile, WeekStrip, type IconName } from '../ui'
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
  const canStart = isToday && !!cur && (cur.kind === 'planned' || cur.kind === 'empty')
  const start = () => {
    if (!cur || !canStart) return
    void startSession(cur.kind === 'planned' ? cur.workout : undefined, 'Freestyle')
  }
  const pick = (k: string) => { setDate(k); setPage(0) }

  return (
    <div className="pb-32">
      <header className="flex items-start gap-2 px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <h1 className={`truncate text-3xl font-bold ${doneDay ? 'text-accent' : ''}`}>{title}</h1>
          <p className="text-sm text-muted">{fmtMDY(day)}</p>
        </div>
        <RoundBtn icon="bell" label="Exercise library" onClick={() => go({ kind: 'library' })} />
        <button className="btn-ghost min-h-10 px-4 text-sm" onClick={() => go({ kind: 'workouts' })}>Workouts</button>
      </header>

      <div className="mb-4 px-2">
        <WeekStrip sunday={sunday} selected={date} status={status} onSelect={pick} onWeek={(d) => pick(dateKey(addDays(day, 7 * d)))} />
      </div>

      {data && (
        <Pager key={date} index={Math.min(page, pages.length - 1)} onIndex={setPage} pages={pages.map((p, i) => (
          <DayCard key={i} p={p} isToday={isToday} onPlus={() => setSheet({})} onMenu={setMenu} onStartFree={() => startSession(undefined, 'Freestyle')}
            onReview={(logId) => go({ kind: 'summary', logId })} onPlanRest={(plan) => (isToday ? startSession(undefined, 'Freestyle') : setSheet({ replace: plan }))} />
        ))} />
      )}

      <div className="phone-fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-4">
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

function CardShell({ title, sub, action, children }: { title: string; sub?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="card flex min-h-[27rem] flex-col p-4">
      <div className="mb-3 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-bold">{title}</h2>
          {sub && <p className="truncate text-sm text-muted">{sub}</p>}
        </div>
        {action}
      </div>
      <div className="panel flex flex-1 flex-col items-center justify-center gap-3 p-4">{children}</div>
    </div>
  )
}

const Dim = ({ icon }: { icon: IconName }) => <Icon name={icon} className="size-24 text-figure" />

function DayCard({ p, isToday, onPlus, onMenu, onReview, onStartFree, onPlanRest }: {
  p: Page; isToday: boolean; onPlus: () => void; onMenu: (p: Plan) => void; onReview: (logId: string) => void; onStartFree: () => void; onPlanRest: (p: Plan) => void
}) {
  const exercises = useExercises()
  const { unit } = useSettings()
  const prev = useLiveQuery(async () => {
    if (p.kind !== 'planned') return null
    const last = await db.workoutLogs.where('workoutId').equals(p.workout.id).filter((l) => l.status === 'done').reverse().sortBy('startedAt')
    if (!last[0]) return 'None'
    const s = await logSummary(last[0].id, exercises)
    return `${fmtVolume(s.volume, unit)} · ${fmtDuration((last[0].endedAt ?? last[0].startedAt) - last[0].startedAt)}`
  }, [p, exercises.size, unit])
  const review = useLiveQuery(async () => (p.kind === 'review' ? logSummary(p.log.id, exercises) : null), [p, exercises.size])

  switch (p.kind) {
    case 'planned': {
      const m = musclesOf(p.workout.exercises.map((e) => e.exerciseId), exercises)
      const names = p.workout.exercises.map((e) => exercises.get(e.exerciseId)?.name ?? '?')
      return (
        <CardShell title={p.workout.name} sub={`Prev. ${prev ?? '…'}`} action={<RoundBtn icon="dots" label="Plan options" onClick={() => onMenu(p.plan)} />}>
          <span className="chip self-start text-xs">Planned Workout</span>
          <MuscleMap size="md" primary={m.primary} secondary={m.secondary} />
          <div className="flex flex-wrap justify-center gap-1.5">
            {names.slice(0, 3).map((n, i) => <span key={i} className="chip text-xs">{n}</span>)}
            {names.length > 3 && <span className="chip text-xs">+{names.length - 3} more</span>}
            {!names.length && <span className="text-sm text-muted">No exercises yet. Use ⋯ → Edit workout.</span>}
          </div>
        </CardShell>
      )
    }
    case 'review':
      return (
        <CardShell title="Workout Review" sub={p.log.name} action={<RoundBtn icon="eye" label="Open summary" onClick={() => onReview(p.log.id)} />}>
          {review && <MuscleMap size="md" primary={review.primary} secondary={review.secondary} />}
          <div className="flex w-full gap-2">
            <Tile label="PRs" value={review?.prs.length ?? 0} />
            <Tile label="Volume" value={fmtVolume(review?.volume ?? 0, unit)} />
            <Tile label="Time" value={fmtDuration((p.log.endedAt ?? p.log.startedAt) - p.log.startedAt)} />
          </div>
        </CardShell>
      )
    case 'rest':
      return (
        <CardShell title="Rest Day" sub="Recovery day" action={<RoundBtn icon="dots" label="Plan options" onClick={() => onMenu(p.plan)} />}>
          <Dim icon="moon" />
          <button className="chip mt-4" onClick={() => onPlanRest(p.plan)}>Log a workout</button>
        </CardShell>
      )
    case 'none':
      return <CardShell title="No Workout" sub="Nothing logged"><Dim icon="moon" /></CardShell>
    case 'empty':
      return (
        <CardShell title="Not Planned Yet!">
          <button aria-label="Plan this day" onClick={onPlus} className="card grid size-20 place-items-center rounded-full! active:scale-95"><Icon name="plus" className="size-9" /></button>
          <p className="max-w-56 text-center text-sm text-muted">Tap + to plan a workout or add a rest day.</p>
          {isToday && <button className="chip mt-2" onClick={onStartFree}>or just start a freestyle workout below</button>}
        </CardShell>
      )
  }
}

function PlanSheet({ date, replace, hasLogs, onClose, onCreate }: { date: string; replace?: Plan; hasLogs: boolean; onClose: () => void; onCreate: () => void }) {
  const workouts = useLiveQuery(() => db.workouts.orderBy('name').toArray(), [])
  const activeToday = useActiveLog()
  const initial = replace ? (replace.type === 'workout' ? replace.workoutId! : replace.type) : ''
  const [sel, setSel] = useState(initial)
  const [busy, setBusy] = useState(false)
  const isToday = date === dateKey(Date.now())
  const when = isToday ? 'Today' : new Date(fromKey(date)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  // Hide Rest once the day already has a started or logged workout.
  const hideRest = hasLogs || (isToday && !!activeToday)
  const chosen = workouts?.find((w) => w.id === sel)
  const cta = sel === initial || !sel ? 'Change to Selection' : sel === 'rest' ? 'Set as Rest Day' : `Set ${chosen?.name} for ${when}`

  const apply = async () => {
    setBusy(true)
    const s: Selection = sel === 'rest' ? { type: 'rest' } : { type: 'workout', workoutId: sel }
    await Promise.all([setPlan(date, s, replace?.id), new Promise((r) => setTimeout(r, 300))])
    onClose()
  }
  const row = (id: string, name: string, icon?: IconName) => <PlanRow key={id} id={id} name={name} icon={icon} sel={sel} setSel={setSel} />

  return (
    <Sheet full label="Plan the day" onClose={onClose}>
      <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 p-4">
        <RoundBtn icon="chevL" label="Back" onClick={onClose} />
        <h2 className="text-center font-bold">{fmtDate(fromKey(date))}</h2>
        <RoundBtn icon="plus" label="Create workout" onClick={onCreate} />
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-4">
        <section>
          <h3 className="mb-2 text-sm font-semibold text-muted">Presets</h3>
          {hideRest ? <p className="card p-4 text-sm text-muted">Rest isn't available once a workout is logged or started that day.</p> : (
            <ul className="card divide-y divide-line overflow-hidden">{row('rest', 'Rest', 'moon')}</ul>
          )}
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold text-muted">Your Workouts</h3>
          {workouts?.length ? (
            <ul className="card divide-y divide-line overflow-hidden">{workouts.map((w) => row(w.id, w.name))}</ul>
          ) : <p className="card p-4 text-sm text-muted">No saved workouts yet. Tap + to create one.</p>}
        </section>
      </div>
      <div className="p-4">
        <button className="btn-accent w-full disabled:bg-panel disabled:text-muted disabled:opacity-100" disabled={sel === initial || !sel || busy} onClick={apply}>
          {busy ? <Spinner className="size-5" /> : cta}
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
