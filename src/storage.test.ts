import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { clearStorageNotice, elapsedMs, loadBaseline, loadMuted, loadPlan, loadProfile, loadSession,
  newSession, saveMuted, saveSession, storageNotice } from './storage'
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
