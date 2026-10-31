import { expect, test } from 'vitest'
import { bests, dateKey, e1rm, fmtClock, fmtDuration, fmtVolume, fromDisplay, fromKey, isLogged, isPRSet, sessionEnd, toDisplay, volume } from './lib'

test('e1rm', () => {
  expect(e1rm(100, 1)).toBe(100)
  expect(e1rm(100, 10)).toBeCloseTo(133.33, 1)
  expect(e1rm(0, 5)).toBe(0)
})

test('bests: heaviest, ties broken by reps', () => {
  const b = bests([{ weight: 100, reps: 5 }, { weight: 100, reps: 8 }, { weight: 80, reps: 15 }, { weight: 120, reps: null }])
  expect(b.top).toEqual({ weight: 100, reps: 8 })
  expect(b.e1rm).toBeCloseTo(e1rm(100, 8))
  expect(bests([]).top).toBeNull()
  expect(bests([{ weight: null, reps: 12 }]).top).toEqual({ weight: null, reps: 12 })
})

test('isPRSet: heaviest weight, ties broken by reps', () => {
  const prev = [{ weight: 100, reps: 5 }, { weight: 80, reps: 10 }]
  expect(isPRSet([], { weight: 50, reps: 5 })).toBe(false)
  expect(isPRSet(prev, { weight: 105, reps: 1 })).toBe(true)
  expect(isPRSet(prev, { weight: 100, reps: 6 })).toBe(true)
  expect(isPRSet(prev, { weight: 80, reps: 20 })).toBe(false) // more reps at a lighter weight is not a PR
  expect(isPRSet(prev, { weight: 95, reps: 8 })).toBe(false) // better e1RM but lighter
  expect(isPRSet(prev, { weight: 100, reps: null })).toBe(false)
  expect(isPRSet([{ weight: null, reps: 10 }], { weight: null, reps: 12 })).toBe(true) // bodyweight
})

test('isLogged needs both fields', () => {
  const o = { bodyweight: false, timed: false }
  expect(isLogged({ weight: 20, reps: null }, o)).toBe(false)
  expect(isLogged({ weight: null, reps: 8 }, o)).toBe(false)
  expect(isLogged({ weight: 20, reps: 8 }, o)).toBe(true)
  expect(isLogged({ weight: null, reps: 8 }, { bodyweight: true, timed: false })).toBe(true)
  expect(isLogged({ weight: null, reps: null, durationSec: 45 }, { bodyweight: true, timed: true })).toBe(true)
})

test('volume counts R and L separately (spec example = 1,300 kg)', () => {
  const sets = [
    { weight: 20, reps: 25 }, { weight: 20, reps: 25 }, // R + L
    { weight: 25, reps: 6 }, { weight: 25, reps: 6 },
  ]
  expect(volume(sets)).toBe(1300)
  expect(fmtVolume(1300, 'kg')).toBe('1.3k kgs')
  expect(fmtVolume(4700, 'kg')).toBe('4.7k kgs')
  expect(fmtVolume(850, 'kg')).toBe('850 kgs')
  expect(volume([{ weight: null, reps: 10 }])).toBe(0)
})

test('formatting and dates', () => {
  expect(fmtDuration(63 * 60e3)).toBe('1h 3m')
  expect(fmtDuration(24 * 60e3)).toBe('24m')
  expect(fmtClock(65)).toBe('01:05')
  expect(toDisplay(100, 'lb')).toBe(220.46)
  expect(toDisplay(fromDisplay(225, 'lb'), 'lb')).toBe(225)
  expect(dateKey(fromKey('2026-10-19'))).toBe('2026-10-19')
})

test('sessionEnd stops the clock at the last set after a 30+ min gap', () => {
  expect(sessionEnd(1000, 1000 + 31 * 60e3)).toBe(1000)
  expect(sessionEnd(1000, 1000 + 5 * 60e3)).toBe(1000 + 5 * 60e3)
  expect(sessionEnd(0, 99)).toBe(99)
})

// ---- streaks
import { streaks } from './lib'
const at = (k: string, workoutId?: string) => ({ startedAt: fromKey(k) + 9 * 3600e3, workoutId })
const wk = (date: string, workoutId = 'w') => ({ date, type: 'workout' as const, workoutId })
const rest = (date: string) => ({ date, type: 'rest' as const })
// 2026-11-02 is a Monday
const MON = '2026-11-02', TUE = '2026-11-03', WED = '2026-11-04', THU = '2026-11-05', FRI = '2026-11-06'

test('streak: example from the spec (Mon, Tue, rest Wed, Thu)', () => {
  const plans = [wk(MON), wk(TUE), rest(WED), wk(THU)]
  expect(streaks(plans, [at(MON), at(TUE)], WED)).toEqual({ current: 2, best: 2 })
  expect(streaks(plans, [at(MON), at(TUE)], THU)).toEqual({ current: 2, best: 2 }) // Thu still open
  expect(streaks(plans, [at(MON), at(TUE), at(THU)], THU)).toEqual({ current: 3, best: 3 })
})
test('streak: a missed planned day resets to 0 but keeps the best', () => {
  const plans = [wk(MON), wk(TUE), rest(WED), wk(THU)]
  expect(streaks(plans, [at(MON), at(TUE)], FRI)).toEqual({ current: 0, best: 2 })
})
test('streak: rest days and unplanned days neither add nor break', () => {
  const plans = [wk(MON), rest(TUE), wk(THU)]
  expect(streaks(plans, [at(MON), at(THU)], FRI)).toEqual({ current: 2, best: 2 })
})
test('streak: pending today does not break; a past planned day with no log does', () => {
  expect(streaks([wk(MON), wk(TUE)], [at(MON)], TUE)).toEqual({ current: 1, best: 1 })
  expect(streaks([wk(MON)], [], TUE)).toEqual({ current: 0, best: 0 })
})
test('streak: a workout on an unplanned day is ignored; empty history is 0', () => {
  expect(streaks([wk(MON)], [at(TUE)], FRI)).toEqual({ current: 0, best: 0 })
  expect(streaks([], [], FRI)).toEqual({ current: 0, best: 0 })
  expect(streaks([], [at(MON)], FRI)).toEqual({ current: 0, best: 0 })
})
test('streak: a planned workout done a day early on a rest day counts for its planned day', () => {
  const plans = [wk(MON), rest(TUE), wk(WED, 'chest')]
  expect(streaks(plans, [at(MON), at(TUE, 'chest')], FRI)).toEqual({ current: 2, best: 2 })
  expect(streaks(plans, [at(MON), at(TUE, 'legs')], FRI)).toEqual({ current: 0, best: 1 }) // different workout: still a miss
  expect(streaks(plans, [at(MON), at(TUE)], FRI)).toEqual({ current: 0, best: 1 }) // freestyle: still a miss
})
