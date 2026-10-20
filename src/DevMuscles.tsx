import { useEffect, useState } from 'react'
import MuscleMap from './MuscleMap'
import { MUSCLE_LABEL, MUSCLES } from './muscles'

/** /dev/muscles: lights each region one at a time at the three quality-check sizes. */
export default function DevMuscles() {
  const [i, setI] = useState(0)
  const [play, setPlay] = useState(true)
  useEffect(() => {
    if (!play) return
    const id = setInterval(() => setI((n) => (n + 1) % MUSCLES.length), 1200)
    return () => clearInterval(id)
  }, [play])
  const m = MUSCLES[i]
  return (
    <div className="mx-auto h-dvh max-w-[430px] space-y-4 overflow-y-auto p-4">
      <h1 className="text-xl font-bold">Muscle regions · {i + 1}/{MUSCLES.length}</h1>
      <div className="flex items-center gap-2">
        <button className="btn-ghost min-h-10" onClick={() => setI((i - 1 + MUSCLES.length) % MUSCLES.length)}>‹</button>
        <button className="btn-accent min-h-10 flex-1" onClick={() => setPlay(!play)}>{play ? 'Pause' : 'Play'} · {MUSCLE_LABEL[m]} ({m})</button>
        <button className="btn-ghost min-h-10" onClick={() => setI((i + 1) % MUSCLES.length)}>›</button>
      </div>
      <div className="card flex items-end justify-center gap-4 p-4">
        <MuscleMap size="sm" primary={[m]} />
        <MuscleMap size="md" primary={[m]} />
      </div>
      <div className="card flex justify-center p-4"><MuscleMap size="lg" primary={[m]} /></div>
      <div className="card flex justify-center p-4"><MuscleMap size="lg" primary={['chest-upper', 'triceps-lateral']} secondary={['delt-front', 'chest-lower']} /></div>
      <h2 className="font-bold">All regions</h2>
      <div className="grid grid-cols-2 gap-2">
        {MUSCLES.map((r) => (
          <div key={r} className="card flex flex-col items-center p-2">
            <MuscleMap size="md" primary={[r]} />
            <span className="text-xs">{MUSCLE_LABEL[r]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
