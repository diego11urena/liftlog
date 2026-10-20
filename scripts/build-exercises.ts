// One-time: curated list (scripts/curated-exercises.json) + instructions/photos from free-exercise-db
// (Unlicense / public domain) → src/data/exercises.seed.json. Run: npm run build:exercises
import { readFileSync, writeFileSync } from 'node:fs'
import { check, expand, type Curated } from './check-exercises.ts'

const SRC = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'
type Raw = { id: string; name: string; instructions: string[]; images: string[] }

// Hand-confirmed dataset entries for curated names that don't match a dataset name exactly.
const DATASET: Record<string, string> = {
  'Barbell Bench Press': 'Barbell_Bench_Press_-_Medium_Grip', 'Incline Barbell Bench Press': 'Barbell_Incline_Bench_Press_-_Medium_Grip',
  'Close-Grip Bench Press': 'Close-Grip_Barbell_Bench_Press', 'Smith Machine Incline Press': 'Smith_Machine_Incline_Bench_Press',
  'Single-Arm Cable Fly': 'Single-Arm_Cable_Crossover', 'Dumbbell Fly': 'Dumbbell_Flyes', 'Incline Dumbbell Fly': 'Incline_Dumbbell_Flyes',
  'Dumbbell Pullover': 'Bent-Arm_Dumbbell_Pullover', 'Pull-Up': 'Pullups', 'Lat Pulldown': 'Wide-Grip_Lat_Pulldown',
  'Close-Grip Lat Pulldown': 'Close-Grip_Front_Lat_Pulldown', 'Single-Arm Lat Pulldown': 'One_Arm_Lat_Pulldown', 'Seated Cable Row': 'Seated_Cable_Rows',
  'Barbell Row': 'Bent_Over_Barbell_Row', 'Dumbbell Row': 'One-Arm_Dumbbell_Row', 'T-Bar Row': 'T-Bar_Row_with_Handle',
  'Chest-Supported T-Bar Row': 'Lying_T-Bar_Row', 'Back Extension': 'Hyperextensions_Back_Extensions', 'Overhead Press': 'Standing_Military_Press',
  'Seated Barbell Shoulder Press': 'Seated_Barbell_Military_Press', 'Shoulder Press Machine': 'Machine_Shoulder_Military_Press',
  'Smith Machine Shoulder Press': 'Smith_Machine_Overhead_Shoulder_Press', 'Dumbbell Lateral Raise': 'Side_Lateral_Raise',
  'Seated Dumbbell Lateral Raise': 'Seated_Side_Lateral_Raise', 'Dumbbell Front Raise': 'Front_Dumbbell_Raise', 'Cable Front Raise': 'Front_Cable_Raise',
  'Plate Front Raise': 'Front_Plate_Raise', 'Bent-Over Dumbbell Reverse Fly': 'Reverse_Flyes', 'Chest-Supported Rear Delt Raise': 'Lying_Rear_Delt_Raise',
  'Barbell Upright Row': 'Upright_Barbell_Row', 'Cable Upright Row': 'Upright_Cable_Row', 'Dumbbell Upright Row': 'Standing_Dumbbell_Upright_Row',
  'Dumbbell External Rotation': 'External_Rotation', 'Hammer Curl': 'Hammer_Curls', 'Cross-Body Hammer Curl': 'Cross_Body_Hammer_Curl',
  'Rope Hammer Curl': 'Cable_Hammer_Curls_-_Rope_Attachment', 'EZ-Bar Preacher Curl': 'Preacher_Curl', 'Dumbbell Preacher Curl': 'One_Arm_Dumbbell_Preacher_Curl',
  'Preacher Curl Machine': 'Machine_Preacher_Curls', 'Concentration Curl': 'Concentration_Curls', 'Reverse Curl': 'Reverse_Barbell_Curl',
  'Triceps Rope Pushdown': 'Triceps_Pushdown_-_Rope_Attachment', 'Straight-Bar Pushdown': 'Triceps_Pushdown', 'V-Bar Pushdown': 'Triceps_Pushdown_-_V-Bar_Attachment',
  'Reverse-Grip Pushdown': 'Reverse_Grip_Triceps_Pushdown', 'Overhead Cable Triceps Extension': 'Cable_Rope_Overhead_Triceps_Extension',
  'EZ-Bar Skull Crusher': 'EZ-Bar_Skullcrusher', 'Triceps Extension Machine': 'Machine_Triceps_Extension', 'Seated Dip Machine': 'Dip_Machine',
  'Dumbbell Kickback': 'Tricep_Dumbbell_Kickback', 'Behind-the-Back Wrist Curl': 'Standing_Palms-Up_Barbell_Behind_The_Back_Wrist_Curl',
  'Barbell Back Squat': 'Barbell_Full_Squat', 'Front Squat': 'Front_Barbell_Squat', 'Seated Leg Extension Machine': 'Leg_Extensions',
  'Single-Leg Extension': 'Single-Leg_Leg_Extension', 'Split Squat': 'Split_Squat_with_Dumbbells', 'Dumbbell Lunge': 'Dumbbell_Lunges',
  'Walking Lunge': 'Bodyweight_Walking_Lunge', 'Reverse Lunge': 'Dumbbell_Rear_Lunge', 'Step-Up': 'Dumbbell_Step_Ups', 'Sissy Squat': 'Weighted_Sissy_Squat',
  'Jump Squat': 'Freehand_Jump_Squat', 'Box Jump': 'Front_Box_Jump', 'Lying Leg Curl': 'Lying_Leg_Curls', 'Barbell Hip Thrust': 'Barbell_Hip_Thrust',
  'Standing Calf Raise Machine': 'Standing_Calf_Raises', 'Donkey Calf Raise': 'Donkey_Calf_Raises', 'Kettlebell Swing': 'One-Arm_Kettlebell_Swings',
  'Lying Leg Raise': 'Flat_Bench_Lying_Leg_Raise', 'Weighted Decline Crunch': 'Decline_Crunch', 'Kettlebell Goblet Squat': 'Goblet_Squat',
  'Medicine Ball Slam': 'One-Arm_Medicine_Ball_Slam', 'Treadmill Run': 'Running_Treadmill', 'Incline Treadmill Walk': 'Walking_Treadmill',
  'Stationary Bike': 'Bicycling_Stationary', 'Outdoor Cycling': 'Bicycling', 'Rowing Machine': 'Rowing_Stationary', 'Elliptical': 'Elliptical_Trainer',
  'Stair Climber': 'Stairmaster', 'Jump Rope': 'Rope_Jumping', 'Sled Push': 'Sled_Push', 'Sled Pull': 'Sled_Drag_-_Harness',
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const slug = (s: string) => s.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

async function main() {
  const curated: Curated[] = JSON.parse(readFileSync('scripts/curated-exercises.json', 'utf8'))
  const problems = check(curated)
  if (problems.length) throw new Error('Curated list incomplete (npm run check:exercises):\n' + problems.join('\n'))

  const raw: Raw[] = await (await fetch(SRC)).json()
  const byId = new Map(raw.map((r) => [r.id, r])), byName = new Map(raw.map((r) => [norm(r.name), r]))
  for (const [name, id] of Object.entries(DATASET)) if (!byId.has(id)) throw new Error(`DATASET: no "${id}" (for ${name})`)

  let matched = 0
  const out = curated.map((c) => {
    const src = (DATASET[c.name] && byId.get(DATASET[c.name])) || [c.name, ...c.aliases].map((n) => byName.get(norm(n))).find(Boolean)
    if (src) matched++
    const primary = expand(c.primaryMuscles)
    return {
      id: slug(c.name), name: c.name, aliases: c.aliases, category: c.activity ? 'activity' : 'strength', classification: c.classification,
      equipment: c.classification === 'Body Weight/Weighted' ? 'body only' : c.classification.toLowerCase(),
      primaryMuscles: primary, secondaryMuscles: expand(c.secondaryMuscles).filter((m) => !primary.includes(m)),
      instructions: src?.instructions ?? [], images: src?.images ?? [], isCustom: false, notes: '',
      ...(c.timed && { timed: true }),
      // dataset id this replaces, so logged history from the old 876-exercise seed can be carried over
      ...(src && { legacyIds: [src.id] }),
    }
  })
  writeFileSync('src/data/exercises.seed.json', JSON.stringify(out))
  console.log(`Wrote ${out.length} exercises (${matched} with dataset instructions/photos)`)
}

main()
