import Model, { type IExerciseData, type Muscle as LibMuscle } from 'react-body-highlighter'
import type { Muscle } from './db'

// ponytail: the library has no separate lats or side-delt regions, so lats light up upper-back and
// side-delts light up both delt regions. Draw original SVG paths if that distinction matters.
const TO_LIB: Record<Muscle, LibMuscle[]> = {
  chest: ['chest'], 'front-delts': ['front-deltoids'], 'side-delts': ['front-deltoids', 'back-deltoids'],
  'rear-delts': ['back-deltoids'], biceps: ['biceps'], triceps: ['triceps'], forearms: ['forearm'],
  abs: ['abs'], obliques: ['obliques'], traps: ['trapezius'], 'upper-back': ['upper-back'], lats: ['upper-back'],
  'lower-back': ['lower-back'], glutes: ['gluteal'], quads: ['quadriceps'], hamstrings: ['hamstring'],
  adductors: ['adductor'], abductors: ['abductors'], calves: ['calves', 'left-soleus', 'right-soleus'], neck: ['neck'],
}
const FROM_LIB: Partial<Record<LibMuscle, Muscle>> = {}
for (const [m, libs] of Object.entries(TO_LIB) as [Muscle, LibMuscle[]][]) for (const l of libs) FROM_LIB[l] ??= m
FROM_LIB['back-deltoids'] = 'rear-delts'

type Props = { primary: Muscle[]; secondary?: Muscle[]; size?: 'sm' | 'md' | 'lg'; onMuscle?: (m: Muscle) => void }

export default function MuscleMap({ primary, secondary = [], size = 'lg', onMuscle }: Props) {
  // frequency 1 → secondary tint, ≥2 → primary accent (library sums frequencies per region)
  const data: IExerciseData[] = [
    { name: 'primary', muscles: primary.flatMap((m) => TO_LIB[m]), frequency: 2 },
    { name: 'secondary', muscles: secondary.flatMap((m) => TO_LIB[m]), frequency: 1 },
  ]
  const h = { sm: 64, md: 190, lg: 260 }[size]
  const common = {
    data, bodyColor: 'var(--body)', highlightedColors: ['var(--accent-soft)', 'var(--accent)'],
    style: { height: h, width: h / 2 },
    onClick: onMuscle ? ({ muscle }: { muscle: LibMuscle }) => { const m = FROM_LIB[muscle]; if (m) onMuscle(m) } : undefined,
  }
  return (
    <div className="flex shrink-0 justify-center gap-3" aria-label={`Primary: ${primary.join(', ') || 'none'}. Secondary: ${secondary.join(', ') || 'none'}.`} role="img">
      <Model {...common} type="anterior" />
      <Model {...common} type="posterior" />
    </div>
  )
}
