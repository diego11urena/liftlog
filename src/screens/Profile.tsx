import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { eraseAll, startSession } from '../actions'
import { db, MUSCLES } from '../db'
import { musclesOf, useActiveLog, useExercises, useWeekStatus } from '../hooks'
import { addDays, dateKey, fmtDuration, fmtVolume, sundayOf, volume, weekStart } from '../lib'
import MuscleMap from '../MuscleMap'
import { Icon, RoundBtn, Sheet, WeekStrip, type IconName } from '../ui'
import { label } from './Library'

export default function Profile({ onJump }: { onJump: (dateKey: string) => void }) {
  const exercises = useExercises()
  const active = useActiveLog()
  const [settings, setSettings] = useState(false)
  const [full, setFull] = useState(false)
  const sunday = sundayOf(Date.now())
  const status = useWeekStatus(sunday, addDays(sunday, 6))

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
    <div className="space-y-3 px-4 pb-8">
      <div className="flex justify-end pt-[calc(1rem+env(safe-area-inset-top))]">
        <RoundBtn icon="gear" label="Settings" onClick={() => setSettings(true)} />
      </div>

      <div className="card grid grid-cols-3 divide-x divide-line py-4 text-center">
        <Total icon="timer" value={fmtDuration(data?.time ?? 0)} label="time" />
        <Total icon="dumbbell" value={fmtVolume(data?.volume ?? 0, 'kg')} label="volume" />
        <Total icon="calendar" value={`${data?.workouts ?? 0}`} label={data?.workouts === 1 ? 'workout' : 'workouts'} />
      </div>

      <div className="card p-4">
        <div className="mb-2 flex items-start justify-between">
          <div>
            <h2 className="font-bold">Muscles this week</h2>
            <div className="text-4xl font-bold text-accent" title={formula}>{pct}%</div>
          </div>
          <RoundBtn icon="expand" label="Full screen" onClick={() => setFull(true)} />
        </div>
        <MuscleMap primary={week.primary} secondary={week.secondary} />
      </div>

      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Week Overview</h2>
          <button className="btn-accent min-h-9 px-4 text-sm disabled:bg-panel disabled:text-muted disabled:opacity-100" disabled={!data?.todayWorkout || !!active}
            onClick={async () => { await startSession(data!.todayWorkout); onJump(dateKey(Date.now())) }}>Start Workout</button>
        </div>
        <WeekStrip sunday={sunday} status={status} onSelect={onJump} />
      </div>

      {full && (
        <Sheet full label="Muscles this week" onClose={() => setFull(false)}>
          <div className="flex items-center justify-between p-4">
            <h2 className="text-lg font-bold">Muscles this week</h2>
            <RoundBtn icon="x" label="Close" onClick={() => setFull(false)} />
          </div>
          <div className="space-y-4 px-4 pb-6">
            <div className="text-5xl font-bold text-accent">{pct}%</div>
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
    <Icon name={icon} className="mx-auto mb-1 size-5 text-muted" />
    <div className="font-bold">{value}</div>
    <div className="text-xs text-muted">{label}</div>
  </div>
)

function SettingsSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet label="Settings" onClose={onClose}>
      <div className="flex items-center justify-between p-4">
        <h2 className="text-lg font-bold">Settings</h2>
        <RoundBtn icon="x" label="Close" onClick={onClose} />
      </div>
      <div className="space-y-3 px-4 pb-6">
        <p className="text-sm text-muted">Weight units are picked per exercise, right next to the weight while you log.</p>
        <div className="card p-4">
          <h3 className="mb-1 font-bold text-danger">Danger zone</h3>
          <p className="mb-3 text-sm text-muted">Erases every workout, plan, custom exercise and setting on this device. This can't be undone.</p>
          <button className="btn w-full bg-danger text-on-accent" onClick={() => {
            if (confirm('Erase ALL data?') && confirm('Really erase everything? There is no backup.')) void eraseAll()
          }}>Erase all data</button>
        </div>
      </div>
    </Sheet>
  )
}
