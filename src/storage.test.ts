import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { clearStorageNotice, elapsedMs, loadBaseline, loadMuted, loadPlan, loadProfile, loadSession,
  newSession, saveBaseline, saveMuted, saveSession, storageNotice } from './storage'
import { generatePersonalizedWorkout } from './plan/generate'
import { derivePersonalBaseline } from './plan/baseline'
let values: Map<string, string>
beforeEach(() => {
  values = new Map(); clearStorageNotice()
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) })
})
afterEach(() => vi.unstubAllGlobals())
const session = () => newSession(generatePersonalizedWorkout({ category: 'test', baseline: derivePersonalBaseline({}) }))
it('round-trips the complete run snapshot and speed history', () => {
  const run = { ...session(), startedAt: 1000, speedChanges: [{ atMs: 5000, offset: 0.1 }] }
  saveSession(run); expect(loadSession()).toEqual(run)
})
it('rejects old sessions rather than inventing missing history', () => {
  values.set('stride.session', JSON.stringify({ workoutId: 'easy', startedAt: 1, pausedMs: 0 }))
  expect(loadSession()).toBeNull(); expect(storageNotice()).toContain('outdated')
})
it('keeps valid profile when a session is damaged', () => {
  values.set('stride.profile', JSON.stringify({ name: 'Alex', level: 'beginner' }))
  values.set('stride.session', '{bad json')
  expect(loadSession()).toBeNull(); expect(loadProfile().name).toBe('Alex')
})
it('rejects malformed plan structures', () => {
  values.set('stride.plan', JSON.stringify({ sections: [null] }))
  expect(loadPlan()).toBeNull()
})
it('rejects invalid or out-of-order speed events', () => {
  values.set('stride.session', JSON.stringify({ ...session(), speedChanges: [{ atMs: 2, offset: 1 }, { atMs: 1, offset: 1 }] }))
  expect(loadSession()).toBeNull()
})
it('handles storage failure without crashing', () => {
  vi.stubGlobal('localStorage', { getItem: () => { throw Error('blocked') }, setItem: () => { throw Error('quota') } })
  expect(loadBaseline()).toEqual({}); expect(loadMuted()).toBe(false)
  expect(() => saveSession(session())).not.toThrow(); expect(storageNotice()).toContain('cannot be saved')
})
it('migrates numeric mute preference and saves boolean preference', () => {
  values.set('stride.muted', '1'); expect(loadMuted()).toBe(true)
  saveMuted(false); expect(loadMuted()).toBe(false)
})
it('excludes current and previous pauses; completion freezes actual time', () => {
  const run = { ...session(), startedAt: 1000, pausedMs: 2000, paused: true, pauseStartedAt: 8000 }
  expect(elapsedMs(run, 20_000)).toBe(5000)
  expect(elapsedMs({ ...run, completed: true, result: { elapsedMs: 4500, distanceKm: null } }, 999_999)).toBe(4500)
})
it('round-trips answers in the new question format', () => {
  const answers = { fitness_method: 'recent_race', recent_race_distance: 5, recent_race_time: 1500, weekly_volume: 30 } as const
  saveBaseline(answers); expect(loadBaseline()).toEqual(answers); expect(storageNotice()).toBe('')
})
it('discards answers saved in the old question format with the usual notice', () => {
  values.set('stride.baseline', JSON.stringify({ raceKnown: true, raceDistanceKm: 5, raceSeconds: 1500, weeklyKm: 30,
    daysPerWeek: 3, continuity: 'run-walk', paceKnown: true, paceMinutes: 6, paceSeconds: 0 }))
  expect(loadBaseline()).toEqual({}); expect(storageNotice()).toContain('outdated')
})
it('discards a plan and session saved with the old baseline shape instead of crashing', () => {
  const old = { ...session(), plan: { ...session().plan, baseline: { speedKmh: 8, speedSource: 'race', continuity: 'continuous',
    walkSpeedKmh: null, availableSeconds: null, missing: [] } } }
  values.set('stride.plan', JSON.stringify(old.plan)); values.set('stride.session', JSON.stringify(old))
  expect(loadPlan()).toBeNull(); expect(loadSession()).toBeNull(); expect(storageNotice()).toContain('outdated')
})
it('round-trips a plan built from the new answers', () => {
  const plan = generatePersonalizedWorkout({ category: 'interval', today: new Date(2026, 9, 8), baseline: derivePersonalBaseline({
    fitness_method: 'recent_race', recent_race_distance: 5, recent_race_time: 1500, weekly_volume: 40, running_days: 4, training_effort: 'base' }) })
  values.set('stride.plan', JSON.stringify(plan)); expect(loadPlan()).toEqual(plan)
})
