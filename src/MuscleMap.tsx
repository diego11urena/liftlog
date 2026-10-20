import { useId } from 'react'
import body from './data/body.json'
import { MUSCLE_LABEL, type Muscle } from './muscles'

// Figure art: MuscleMap (MIT), split into our regions by scripts/build-body.ts. See docs/ASSETS.md.
type BodyPath = { r: Muscle; d: string; side: 'L' | 'R'; clip?: { y: number; keep: 'above' | 'below' } }
const VIEWS = [body.front, body.back] as unknown as { outline: string[]; muscles: BodyPath[] }[]
const [VX, VY, VW, VH] = body.viewBox.split(' ').map(Number)

/** Regions with no art of their own light up a neighbor instead. */
const SHOWN_AS: Partial<Record<Muscle, Muscle>> = { neck: 'traps-upper' }

/** Fiber direction per region, degrees from vertical for the figure's screen-left side (mirrored on the right). */
const FIBER: Partial<Record<Muscle, number>> = {
  'chest-upper': 70, 'chest-lower': 80, 'delt-front': 15, 'delt-side': 0, 'delt-rear': -20, 'rotator-cuff': 70, teres: 60,
  obliques: 35, serratus: 60, lats: 45, 'traps-upper': 55, 'traps-middle': 90, 'traps-lower': -50, rhomboids: -60,
  'glutes-max': 50, 'glutes-med': 30, 'hip-flexors': 25, adductors: -15, 'abs-upper': 0, 'abs-lower': 0,
}

const WIDTH = { sm: 64, md: 180, lg: 340 }

type Props = { primary: Muscle[]; secondary?: Muscle[]; size?: keyof typeof WIDTH; onMuscle?: (m: Muscle) => void }

export default function MuscleMap({ primary, secondary = [], size = 'lg', onMuscle }: Props) {
  const uid = useId().replace(/:/g, '')
  const shown = (list: Muscle[]) => new Set(list.map((m) => SHOWN_AS[m] ?? m))
  const p = shown(primary), s = shown(secondary)
  const fill = (r: Muscle) => (p.has(r) ? 'var(--accent)' : s.has(r) ? 'var(--accent-soft)' : 'var(--figure)')
  const w = WIDTH[size], fibers = size !== 'sm'
  const label = (l: Muscle[]) => l.map((m) => MUSCLE_LABEL[m]).join(', ') || 'none'

  return (
    <div className="mx-auto flex shrink-0 justify-center" style={{ width: w, gap: w * 0.04 }} role="img"
      aria-label={`Primary: ${label(primary)}. Secondary: ${label(secondary)}.`}>
      {VIEWS.map((v, vi) => (
        <svg key={vi} viewBox={body.viewBox} style={{ width: w * 0.48, height: (w * 0.48 * VH) / VW }} aria-hidden>
          <defs>
            {fibers && [...new Set(v.muscles.map((m) => angle(m)))].map((a) => (
              <pattern key={a} id={`${uid}f${a}`} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform={`rotate(${a})`}>
                <line x1="3" y1="0" x2="3" y2="14" stroke="var(--figure-lines)" strokeWidth="1.6" />
              </pattern>
            ))}
            {v.muscles.map((m, i) => m.clip && (
              <clipPath key={i} id={`${uid}c${vi}-${i}`}>
                <rect x={VX} width={VW} y={m.clip.keep === 'above' ? VY : m.clip.y} height={m.clip.keep === 'above' ? m.clip.y - VY : VY + VH - m.clip.y} />
              </clipPath>
            ))}
          </defs>
          {v.outline.map((d, i) => <path key={i} d={d} fill="var(--figure)" stroke="var(--figure-lines)" strokeWidth={size === 'sm' ? 0.5 : 1} vectorEffect="non-scaling-stroke" />)}
          {v.muscles.map((m, i) => {
            const clip = m.clip ? `url(#${uid}c${vi}-${i})` : undefined
            return (
              <g key={i} clipPath={clip} data-muscle={m.r} onClick={onMuscle && (() => onMuscle(m.r))} style={onMuscle ? { cursor: 'pointer' } : undefined}>
                <path d={m.d} fill={fill(m.r)} stroke="var(--figure-lines)" strokeWidth={size === 'sm' ? 0.4 : 0.9} vectorEffect="non-scaling-stroke" />
                {fibers && <path d={m.d} fill={`url(#${uid}f${angle(m)})`} opacity={fill(m.r) === 'var(--figure)' ? 0.45 : 0.3} pointerEvents="none" />}
              </g>
            )
          })}
        </svg>
      ))}
    </div>
  )
}

const angle = (m: BodyPath) => (m.side === 'R' ? -1 : 1) * (FIBER[m.r] ?? 0)
