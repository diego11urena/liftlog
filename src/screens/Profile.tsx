import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { eraseAll, startSession } from '../actions'
import { toast } from '../App'
import { importFromLink } from '../sync'
import { db, MUSCLES } from '../db'
import { musclesOf, useActiveLog, useExercises, useStreak, useWeekStatus } from '../hooks'
import { addDays, dateKey, fmtDuration, fmtVolume, sundayOf, volume, weekStart } from '../lib'
import MuscleMap from '../MuscleMap'
import { ask, Icon, RoundBtn, Sheet, WeekStrip, type IconName } from '../ui'
import { label } from './Library'

export default function Profile({ onJump }: { onJump: (dateKey: string) => void }) {
  const exercises = useExercises()
  const active = useActiveLog()
  const [settings, setSettings] = useState(false)
  const [full, setFull] = useState(false)
  const sunday = sundayOf(Date.now())
  const status = useWeekStatus(sunday, addDays(sunday, 6))
  const streak = useStreak()
  const name = useName()

  const data = useLiveQuery(async () => {
    const logs = await db.workoutLogs.where('status').equals('done').toArray()
    const sets = await db.sets.filter((s) => s.completedAt > 0).toArray()
    const wk = weekStart(Date.now())
    // today's first planned workout that hasn't been done yet
    const doneToday = new Set(logs.filter((l) => dateKey(l.startedAt) === dateKey(Date.now())).map((l) => l.workoutId))
    const todays = await db.plans.where('date').equals(dateKey(Date.now())).filter((p) => p.type === 'workout' && !doneToday.has(p.workoutId)).toArray()
    const todayWorkout = todays.length ? await db.workouts.get(todays[0].workoutId!) : undefined
    return {
      time: logs.reduce((a, l) => a + ((l.endedAt ?? l.startedAt) - l.startedAt), 0),
      volume: volume(sets), workouts: logs.length, weekIds: sets.filter((s) => s.completedAt >= wk).map((s) => s.exerciseId), todayWorkout,
    }
  }, [])
  const week = musclesOf(data?.weekIds ?? [], exercises)
  const trained = week.primary.length + week.secondary.length
  const pct = Math.round((trained / MUSCLES.length) * 100)
  const formula = `${trained} of ${MUSCLES.length} muscle regions trained at least once this week (Mon–Sun).`

  return (
    <div className="space-y-4 px-[18px] pb-8">
      <div className="flex items-start justify-between pt-[calc(28px+env(safe-area-inset-top))]">
        <h1 className="text-[30px] font-semibold leading-[1.1]">{greeting()}{name ? <>,<br />{name}</> : ''}</h1>
        <RoundBtn icon="gear" label="Settings" onClick={() => setSettings(true)} />
      </div>

      <div className="card grid grid-cols-3 divide-x divide-line py-[18px] text-center">
        <Total icon="timer" value={fmtDuration(data?.time ?? 0)} label="time" />
        <Total icon="dumbbell" value={fmtVolume(data?.volume ?? 0, 'kg')} label="volume" />
        <Total icon="calendar" value={`${data?.workouts ?? 0}`} label={data?.workouts === 1 ? 'workout' : 'workouts'} />
      </div>

      <div className="ink-panel p-[22px]">
        <div className="mb-2 flex items-start justify-between">
          <div>
            <h2 className="label text-muteink">Muscles this week</h2>
            <div className="num text-[60px] font-semibold leading-none text-glow" title={formula}>{pct}%</div>
          </div>
          <RoundBtn onInk icon="expand" label="Full screen" onClick={() => setFull(true)} />
        </div>
        <MuscleMap w={104} surface="d" primary={week.primary} secondary={week.secondary} />
        <p className="num mt-4 text-center text-[13px] text-muteink">{trained} of {MUSCLES.length} muscle regions trained since Monday</p>
      </div>

      <div className="card p-[22px]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[22px] font-semibold">Week Overview</h2>
          <button className="btn-accent min-h-10 px-4 text-sm disabled:bg-panel disabled:text-muted disabled:opacity-100" disabled={!data?.todayWorkout || !!active}
            onClick={async () => { await startSession(data!.todayWorkout); onJump(dateKey(Date.now())) }}>Start Workout</button>
        </div>
        {streak.current > 0 && <p className="num mb-3 text-sm text-muted">{streak.current}-day streak · Best: {streak.best}</p>}
        <WeekStrip sunday={sunday} status={status} onSelect={onJump} />
      </div>

      {full && (
        <Sheet full label="Muscles this week" onClose={() => setFull(false)}>
          <div className="flex items-center justify-between px-[18px] pb-3 pt-6">
            <h2 className="text-[22px] font-semibold">Muscles this week</h2>
            <RoundBtn icon="x" label="Close" onClick={() => setFull(false)} />
          </div>
          <div className="space-y-4 px-[18px] pb-6">
            <div className="num text-5xl font-semibold text-acc-t">{pct}%</div>
            <p className="text-sm text-muted">{formula}</p>
            <MuscleMap primary={week.primary} secondary={week.secondary} />
            <div className="flex flex-wrap gap-1.5">
              {week.primary.map((m) => <span key={m} className="chip bg-accent text-xs font-semibold text-on-accent">{label(m)}</span>)}
              {week.secondary.map((m) => <span key={m} className="chip bg-accent-soft/40 text-xs">{label(m)}</span>)}
            </div>
          </div>
        </Sheet>
      )}
      {settings && <SettingsSheet onClose={() => setSettings(false)} />}
    </div>
  )
}

const Total = ({ icon, value, label }: { icon: IconName; value: string; label: string }) => (
  <div className="px-2">
    <Icon name={icon} className="mx-auto mb-1.5 size-5 text-muted" />
    <div className="num text-xl font-semibold">{value}</div>
    <div className="label mt-0.5">{label}</div>
  </div>
)

/** One-time move from another address: paste the #import= link (Home Screen apps don't share Safari's storage). */
function ImportBox() {
  const [text, setText] = useState('')
  const run = async () => {
    try {
      const n = await importFromLink(text)
      toast(n ? `Imported ${n} items` : 'That doesn\'t look like an import link')
      if (n) setText('')
    } catch (e) { toast(`Import failed: ${(e as Error).message}`) }
  }
  return (
    <div className="card p-4">
      <h3 className="mb-1 font-semibold">Move data here</h3>
      <p className="mb-3 text-sm text-muted">Paste a Liftlog import link to bring workouts over from another address. Existing data is kept.</p>
      <textarea className="field mb-2 min-h-20 py-3 text-base" placeholder="https://…/#import=…" value={text} onChange={(e) => setText(e.target.value)} />
      <button className="btn-accent w-full" disabled={!text.includes('#import=')} onClick={run}>Import</button>
    </div>
  )
}

/** Name in the greeting, saved on this phone only (not synced); asked once on first launch (App). Empty = no name. */
const useName = () => useLiveQuery(async () => ((await db.settings.get('name'))?.value as string | undefined) ?? '', []) ?? ''

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' }

/** Screen measurements, to debug layout on a specific phone (send a screenshot of this). */
function DisplayInfo() {
  const [rows, setRows] = useState<[string, string][]>([])
  const [strips, setStrips] = useState(false)
  useEffect(() => {
    const measure = () => {
      const box = (css: string) => { const d = document.createElement('div'); d.style.cssText = `position:fixed;visibility:hidden;${css}`; document.body.append(d); const r = d.getBoundingClientRect(); d.remove(); return r }
      const vv = window.visualViewport
      setRows([
        ['display', `${matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'} · ${(navigator as { standalone?: boolean }).standalone ? 'iOS home screen' : '-'}`],
        ['inner (w×h)', `${innerWidth} × ${innerHeight}`], ['outer (w×h)', `${outerWidth} × ${outerHeight}`],
        ['screen (w×h)', `${screen.width} × ${screen.height}`], ['visualViewport', vv ? `${Math.round(vv.width)} × ${Math.round(vv.height)} @ ${Math.round(vv.offsetTop)}` : 'n/a'],
        ['html clientHeight', String(document.documentElement.clientHeight)],
        ['100vh / svh / lvh / dvh', ['100vh', '100svh', '100lvh', '100dvh'].map((h) => Math.round(box(`height:${h}`).height)).join(' / ')],
        ['safe top / bottom', `${Math.round(box('top:0;height:env(safe-area-inset-top)').height)} / ${Math.round(box('height:env(safe-area-inset-bottom)').height)}`],
        ['fixed bottom:0 sits at', String(Math.round(box('bottom:0;height:1px').bottom))],
        ['nav-h / safe-b / gap-b', ['var(--nav-h)', 'var(--safe-b)', 'var(--gap-b)'].map((v) => Math.round(box(`height:${v}`).height)).join(' / ')],
      ])
    }
    measure()
    addEventListener('resize', measure)
    return () => removeEventListener('resize', measure)
  }, [])
  return (
    <div className="card p-[18px]">
      <h3 className="mb-1 font-semibold">Display info</h3>
      <p className="mb-3 text-sm text-muted">For fixing layout on a specific phone. Screenshot this box.</p>
      <dl className="num space-y-1 text-[13px]">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="text-right">{v}</dd></div>)}</dl>
      <button className="btn-ghost mt-3 min-h-11 w-full text-sm" onClick={() => setStrips(!strips)}>{strips ? 'Hide' : 'Show'} test strips below the screen edge</button>
      {strips && <>
        {/* painted just past the layout viewport: which colors can you see at the very bottom of the phone? */}
        <div className="fixed inset-x-0 z-[90] h-6 bg-[#e00]" style={{ top: 'calc(100% + 4px)' }} />
        <div className="absolute inset-x-0 z-[90] h-6 bg-[#06f]" style={{ top: `${innerHeight + 34}px` }} />
      </>}
    </div>
  )
}

function SettingsSheet({ onClose }: { onClose: () => void }) {
  const name = useName()
  return (
    <Sheet label="Settings" onClose={onClose}>
      <div className="flex items-center justify-between px-[18px] pb-3 pt-6">
        <h2 className="text-[22px] font-semibold">Settings</h2>
        <RoundBtn icon="x" label="Close" onClick={onClose} />
      </div>
      <div className="space-y-3 px-[18px] pb-6">
        <p className="text-sm text-muted">Weight units are picked per exercise, right next to the weight while you log.</p>
        <label className="card block p-4 font-semibold">Your name
          <input className="field mt-2 font-normal" placeholder="Shown in the greeting" defaultValue={name} maxLength={30}
            onChange={(e) => db.settings.put({ key: 'name', value: e.target.value.trim() })} />
        </label>
        <ImportBox />
        <DisplayInfo />
        <div className="card p-4">
          <h3 className="mb-1 font-semibold text-danger">Danger zone</h3>
          <p className="mb-3 text-sm text-muted">Erases every workout, plan, custom exercise and setting on this device. This can't be undone.</p>
          <button className="btn w-full bg-danger text-on-accent" onClick={() => {
            void (async () => {
              if (await ask({ title: 'Erase all data?', message: 'Every workout, plan, custom exercise and setting on this phone will be deleted.', confirm: 'Erase', danger: true })
                && await ask({ title: 'Really erase everything?', message: "There is no backup. This can't be undone.", confirm: 'Erase everything', danger: true })) void eraseAll()
            })()
          }}>Erase all data</button>
        </div>
      </div>
    </Sheet>
  )
}
