import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { createWorkout, deleteWorkout } from '../actions'
import { db, type PlanSet, type Workout } from '../db'
import { useExercises } from '../hooks'
import { ask, Busy, Icon, NameModal, RoundBtn, TopBar } from '../ui'
import Library, { label } from './Library'

/** "Workouts" screen from the Workouts pill. */
export default function WorkoutsScreen({ onBack }: { onBack: () => void }) {
  const workouts = useLiveQuery(() => db.workouts.orderBy('name').toArray(), [])
  const [naming, setNaming] = useState(false)
  const [editing, setEditing] = useState<{ id?: string; name: string } | null>(null)

  if (editing) return <WorkoutBuilder id={editing.id} newName={editing.name} onClose={() => setEditing(null)} />
  return (
    <div className="pb-28">
      <TopBar title="Workouts" onBack={onBack} />
      <div className="space-y-3 px-4">
        {!workouts?.length ? (
          <div className="card p-6 text-center text-muted">No saved workouts yet.</div>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {workouts.map((w) => (
              <li key={w.id}>
                <button className="flex min-h-14 w-full items-center gap-2 px-4 text-left" onClick={() => setEditing({ id: w.id, name: w.name })}>
                  <span className="flex-1 font-semibold">{w.name}</span>
                  <span className="text-sm text-muted">{w.exercises.length} exercises</span>
                  <Icon name="chevR" className="size-4 text-muted" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="phone-fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-4">
        <button className="btn-accent w-full" onClick={() => setNaming(true)}>Create Workout</button>
      </div>
      {naming && <NameModal onClose={() => setNaming(false)} onConfirm={(name) => { setNaming(false); setEditing({ name }) }} />}
    </div>
  )
}

type Draft = Workout['exercises']
const emptySets = (): PlanSet[] => Array.from({ length: 1 }, () => ({ weight: null, reps: null, side: null, isDrop: false }))

/** Create / edit a saved workout. Changes stay local until "Save Workout". */
export function WorkoutBuilder({ id, newName = '', onClose }: { id?: string; newName?: string; onClose: () => void }) {
  const existing = useLiveQuery(() => (id ? db.workouts.get(id) : undefined), [id])
  if (id && !existing) return null
  return <Builder key={id ?? 'new'} existing={existing} newName={newName} onClose={onClose} />
}

function Builder({ existing, newName, onClose }: { existing?: Workout; newName: string; onClose: () => void }) {
  const exercises = useExercises()
  const [name, setName] = useState(existing?.name ?? newName)
  const [list, setList] = useState<Draft>(existing?.exercises ?? [])
  const [renaming, setRenaming] = useState(false)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState<{ i: number; y0: number; dy: number } | null>(null)
  const rowH = useRef(56)

  if (adding) return <Library onBack={() => setAdding(false)} onAdd={(eid) => { setList([...list, { exerciseId: eid, unilateral: false, sets: emptySets() }]); setAdding(false) }} />

  const save = async () => {
    setBusy(true)
    const wid = existing?.id ?? (await createWorkout(name))
    await db.workouts.update(wid, { name, exercises: list, updatedAt: Date.now() })
    await new Promise((r) => setTimeout(r, 250)) // let the spinner register
    onClose()
  }
  const remove = async () => {
    if (!existing) return onClose()
    if (await ask({ title: `Delete "${existing.name}"?`, message: "It's also removed from any planned days. Logged history stays.", confirm: 'Delete', danger: true })) { await deleteWorkout(existing.id); onClose() }
  }
  const target = (d: NonNullable<typeof drag>) => Math.max(0, Math.min(list.length - 1, d.i + Math.round(d.dy / rowH.current)))
  const drop = () => {
    if (!drag) return
    const next = [...list], [item] = next.splice(drag.i, 1)
    next.splice(target(drag), 0, item)
    setList(next); setDrag(null)
  }

  return (
    <div className="pb-28">
      <TopBar title={existing ? 'Edit Workout' : 'Create Workout'} onBack={onClose}
        right={<RoundBtn icon="trash" label="Delete workout" className="bg-danger text-on-accent" onClick={remove} />} />
      <div className="px-4">
        <div className="card overflow-hidden">
          <button className="flex w-full items-center gap-2 px-4 py-4 text-left" onClick={() => setRenaming(true)}>
            <span className="flex-1 text-xl font-bold">{name}</span>
            <Icon name="pencil" className="size-5 text-muted" />
          </button>
          <ul className="divide-y divide-line border-t border-line">
            {list.map((x, i) => {
              const e = exercises.get(x.exerciseId)
              const dragging = drag?.i === i
              return (
                <li key={`${x.exerciseId}-${i}`} className={`flex min-h-14 items-center gap-2 bg-card px-4 ${dragging ? 'relative z-10 shadow-xl' : ''}`}
                  style={dragging ? { transform: `translateY(${drag.dy}px)` } : undefined}
                  ref={(el) => { if (el) rowH.current = el.offsetHeight }}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{e?.name ?? 'Unknown exercise'}</div>
                    <div className="truncate text-xs text-muted">{e && label(e.primaryMuscles.join(', '))}</div>
                  </div>
                  <button aria-label="Remove" className="grid size-9 place-items-center text-muted" onClick={() => setList(list.filter((_, k) => k !== i))}><Icon name="x" className="size-4" /></button>
                  <button aria-label={`Reorder ${e?.name}`} className="grid size-10 cursor-grab touch-none place-items-center text-muted"
                    onPointerDown={(ev) => { ev.currentTarget.setPointerCapture(ev.pointerId); setDrag({ i, y0: ev.clientY, dy: 0 }) }}
                    onPointerMove={(ev) => drag && setDrag({ ...drag, dy: ev.clientY - drag.y0 })}
                    onPointerUp={drop} onPointerCancel={() => setDrag(null)}
                    onKeyDown={(ev) => {
                      const j = ev.key === 'ArrowUp' ? i - 1 : ev.key === 'ArrowDown' ? i + 1 : -1
                      if (j < 0 || j >= list.length) return
                      const next = [...list]; [next[i], next[j]] = [next[j], next[i]]; setList(next)
                    }}>
                    <Icon name="grip" />
                  </button>
                </li>
              )
            })}
            <li>
              <button className="flex min-h-14 w-full items-center gap-3 px-4 text-accent" onClick={() => setAdding(true)}>
                <span className="grid size-7 place-items-center rounded-full border-2 border-accent"><Icon name="plus" className="size-4" /></span>
                Add Exercise
              </button>
            </li>
          </ul>
        </div>
      </div>
      <div className="phone-fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-4">
        <button className="btn-accent w-full" onClick={save} disabled={!name.trim()}>Save Workout</button>
      </div>
      {renaming && <NameModal initial={name} onClose={() => setRenaming(false)} onConfirm={(n) => { setName(n); setRenaming(false) }} />}
      {busy && <Busy />}
    </div>
  )
}
