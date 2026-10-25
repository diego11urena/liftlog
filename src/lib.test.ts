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
