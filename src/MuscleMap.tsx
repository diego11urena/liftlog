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

/** Per-figure widths (front and back each); height follows the art's aspect. `size` is for the dev page. */
const WIDTH = { sm: 31, md: 86, lg: 163 }

type Props = {
  primary: Muscle[]; secondary?: Muscle[]; size?: keyof typeof WIDTH; onMuscle?: (m: Muscle) => void
  /** width of ONE figure in px (overrides size) */
  w?: number
  /** the surface behind it: light (default) or an ink panel */
  surface?: 'l' | 'd'
  /** FRONT / BACK captions */
  labels?: boolean
}

export default function MuscleMap({ primary, secondary = [], size = 'lg', w: figW, surface = 'l', labels, onMuscle }: Props) {
  const uid = useId().replace(/:/g, '')
  const shown = (list: Muscle[]) => new Set(list.map((m) => SHOWN_AS[m] ?? m))
  const p = shown(primary), s = shown(secondary)
  const fill = (r: Muscle) => (p.has(r) ? 'var(--p)' : s.has(r) ? 'var(--s)' : 'var(--fig)')
  const w = figW ?? WIDTH[size], fibers = w >= 80, small = w < 60
  const label = (l: Muscle[]) => l.map((m) => MUSCLE_LABEL[m]).join(', ') || 'none'

  return (
    <div className={`fig-${surface} mx-auto flex shrink-0 justify-center`} style={{ gap: Math.max(6, w * 0.08) }} role="img"
      aria-label={`Primary: ${label(primary)}. Secondary: ${label(secondary)}.`}>
      {VIEWS.map((v, vi) => (
        <div key={vi} className="flex flex-col items-center gap-1.5">
        <svg viewBox={body.viewBox} style={{ width: w, height: (w * VH) / VW }} aria-hidden>
          <defs>
            {fibers && [...new Set(v.muscles.map((m) => angle(m)))].map((a) => (
              <pattern key={a} id={`${uid}f${a}`} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform={`rotate(${a})`}>
                <line x1="3" y1="0" x2="3" y2="14" stroke="var(--ln)" strokeWidth="1.6" />
              </pattern>
            ))}
            {v.muscles.map((m, i) => m.clip && (
              <clipPath key={i} id={`${uid}c${vi}-${i}`}>
                <rect x={VX} width={VW} y={m.clip.keep === 'above' ? VY : m.clip.y} height={m.clip.keep === 'above' ? m.clip.y - VY : VY + VH - m.clip.y} />
              </clipPath>
            ))}
          </defs>
          {v.outline.map((d, i) => <path key={i} d={d} fill="var(--fig)" stroke="var(--ln)" strokeWidth={small ? 0.5 : 1} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />)}
          {v.muscles.map((m, i) => {
            const clip = m.clip ? `url(#${uid}c${vi}-${i})` : undefined
            return (
              <g key={i} clipPath={clip} data-muscle={m.r} onClick={onMuscle && (() => onMuscle(m.r))} style={onMuscle ? { cursor: 'pointer' } : undefined}>
                <path d={m.d} fill={fill(m.r)} stroke="var(--ln)" strokeWidth={small ? 0.4 : 0.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                {fibers && <path d={m.d} fill={`url(#${uid}f${angle(m)})`} opacity={fill(m.r) === 'var(--fig)' ? 0.45 : 0.3} pointerEvents="none" />}
              </g>
            )
          })}
        </svg>
        {labels && <span className={`label ${surface === 'd' ? 'text-muteink' : ''}`}>{vi ? 'Back' : 'Front'}</span>}
        </div>
      ))}
    </div>
  )
}

const angle = (m: BodyPath) => (m.side === 'R' ? -1 : 1) * (FIBER[m.r] ?? 0)
