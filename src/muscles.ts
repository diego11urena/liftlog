// Canonical muscle regions (CLAUDE.md "Muscle regions"). Shared by the app, the diagram and the build scripts.

export const MUSCLES = [
  'chest-upper', 'chest-lower', 'delt-front', 'delt-side', 'delt-rear', 'rotator-cuff', 'biceps', 'brachialis',
  'triceps-long', 'triceps-lateral', 'triceps-medial', 'forearm-flexors', 'forearm-extensors', 'brachioradialis',
  'abs-upper', 'abs-lower', 'obliques', 'serratus', 'hip-flexors', 'traps-upper', 'traps-middle', 'traps-lower',
  'rhomboids', 'lats', 'teres', 'erector-spinae', 'glutes-max', 'glutes-med', 'quads-rectus-femoris',
  'quads-vastus-lateralis', 'quads-vastus-medialis', 'adductors', 'abductors', 'hamstrings-biceps-femoris',
  'hamstrings-semitendinosus', 'calves-gastrocnemius', 'soleus', 'tibialis', 'neck',
] as const
export type Muscle = (typeof MUSCLES)[number]

export const MUSCLE_LABEL: Record<Muscle, string> = {
  'chest-upper': 'Upper Chest', 'chest-lower': 'Lower Chest', 'delt-front': 'Front Delts', 'delt-side': 'Side Delts',
  'delt-rear': 'Rear Delts', 'rotator-cuff': 'Rotator Cuff', biceps: 'Biceps', brachialis: 'Brachialis',
  'triceps-long': 'Triceps (Long Head)', 'triceps-lateral': 'Triceps (Lateral Head)', 'triceps-medial': 'Triceps (Medial Head)',
  'forearm-flexors': 'Forearm Flexors', 'forearm-extensors': 'Forearm Extensors', brachioradialis: 'Brachioradialis',
  'abs-upper': 'Upper Abs', 'abs-lower': 'Lower Abs', obliques: 'Obliques', serratus: 'Serratus', 'hip-flexors': 'Hip Flexors',
  'traps-upper': 'Upper Traps', 'traps-middle': 'Middle Traps', 'traps-lower': 'Lower Traps', rhomboids: 'Rhomboids',
  lats: 'Lats', teres: 'Teres', 'erector-spinae': 'Lower Back', 'glutes-max': 'Glutes', 'glutes-med': 'Glute Medius',
  'quads-rectus-femoris': 'Rectus Femoris', 'quads-vastus-lateralis': 'Outer Quad', 'quads-vastus-medialis': 'Inner Quad',
  adductors: 'Adductors', abductors: 'Abductors', 'hamstrings-biceps-femoris': 'Outer Hamstring',
  'hamstrings-semitendinosus': 'Inner Hamstring', 'calves-gastrocnemius': 'Calves', soleus: 'Soleus', tibialis: 'Tibialis', neck: 'Neck',
}

/** Coarse groups for the "Muscle Group" filter. */
export const MUSCLE_GROUPS: Record<string, Muscle[]> = {
  Chest: ['chest-upper', 'chest-lower'],
  Back: ['traps-upper', 'traps-middle', 'traps-lower', 'rhomboids', 'lats', 'teres', 'erector-spinae'],
  Shoulders: ['delt-front', 'delt-side', 'delt-rear', 'rotator-cuff'],
  Arms: ['biceps', 'brachialis', 'triceps-long', 'triceps-lateral', 'triceps-medial', 'forearm-flexors', 'forearm-extensors', 'brachioradialis'],
  Core: ['abs-upper', 'abs-lower', 'obliques', 'serratus', 'hip-flexors'],
  Legs: ['glutes-max', 'glutes-med', 'quads-rectus-femoris', 'quads-vastus-lateralis', 'quads-vastus-medialis', 'adductors', 'abductors',
    'hamstrings-biceps-femoris', 'hamstrings-semitendinosus', 'calves-gastrocnemius', 'soleus', 'tibialis'],
  Neck: ['neck'],
}

/** Shorthands usable in scripts/curated-exercises.json; the build expands them to regions. */
export const SHORTHAND: Record<string, Muscle[]> = {
  chest: ['chest-upper', 'chest-lower'],
  triceps: ['triceps-long', 'triceps-lateral', 'triceps-medial'],
  forearms: ['forearm-flexors', 'forearm-extensors', 'brachioradialis'],
  abs: ['abs-upper', 'abs-lower'],
  traps: ['traps-upper', 'traps-middle', 'traps-lower'],
  'mid-back': ['traps-middle', 'rhomboids'],
  glutes: ['glutes-max', 'glutes-med'],
  quads: ['quads-rectus-femoris', 'quads-vastus-lateralis', 'quads-vastus-medialis'],
  hamstrings: ['hamstrings-biceps-femoris', 'hamstrings-semitendinosus'],
  calves: ['calves-gastrocnemius', 'soleus'],
}

/** Old 20-muscle enum (before 2026-10-19) → regions. Used to upgrade custom/legacy exercises in place. */
const LEGACY: Record<string, Muscle[]> = {
  chest: SHORTHAND.chest, 'front-delts': ['delt-front'], 'side-delts': ['delt-side'], 'rear-delts': ['delt-rear'],
  triceps: SHORTHAND.triceps, forearms: SHORTHAND.forearms, abs: SHORTHAND.abs, traps: ['traps-upper'],
  'upper-back': ['traps-middle', 'rhomboids'], 'lower-back': ['erector-spinae'], glutes: SHORTHAND.glutes,
  quads: SHORTHAND.quads, hamstrings: SHORTHAND.hamstrings, calves: SHORTHAND.calves,
}
export const upgradeMuscles = (list: string[]) =>
  [...new Set(list.flatMap((m) => LEGACY[m] ?? ((MUSCLES as readonly string[]).includes(m) ? [m as Muscle] : [])))]

export const CLASSIFICATIONS = ['Barbell', 'Dumbbell', 'Machine', 'Smith Machine', 'Cable', 'Kettlebell', 'Band', 'Body Weight/Weighted', 'Cardio', 'Other']
