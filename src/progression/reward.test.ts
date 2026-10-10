import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SCHEMA_VERSION, type Progression, type RunSession } from '../domain/types'
import { generatePersonalizedWorkout } from '../plan/generate'
import { derivePersonalBaseline } from '../plan/baseline'
import { newRunSession } from '../run/session'
import { createLocalStorageRepositories } from '../storage/localStorage'
import { clearStorageNotice } from '../storage/notice'
import { awardRunReward, completedRunFromSession, isQualifyingRun, QUALIFYING_RUN_MS, recordCompletedRun } from './reward'

let values: Map<string, string>
beforeEach(() => {
    values = new Map()
    clearStorageNotice()
    vi.stubGlobal('localStorage', {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
    })
})
afterEach(() => { vi.unstubAllGlobals() })

const STAMP = '2026-10-10T00:00:00.000Z'
const ANSWERS = {
    fitness_method: 'recent_race', recent_race_distance: 5, recent_race_time: 2100, training_focus: 'base',
    weekly_volume: 15, running_days: 3, training_effort: 'base',
} as const
const workout = generatePersonalizedWorkout({ category: 'threshold', baseline: derivePersonalBaseline(ANSWERS) })

const progression = (): Progression => ({
    id: 'progression', schemaVersion: SCHEMA_VERSION, createdAt: STAMP, updatedAt: STAMP, startDate: '2026-10-10',
    wallets: { shiba: 0, shooshy: 0 },
    lastClaimedDate: { shiba: '2026-10-10', shooshy: '2026-10-10' },
    rewardedRunIds: [], inventory: { shiba: [], shooshy: [] }, equipped: { shiba: null, shooshy: null },
})

/** A finished session as handleComplete leaves it. */
const finished = (elapsedMs: number, overrides: Partial<RunSession> = {}): RunSession => ({
    ...newRunSession(workout, 'run-1', new Date(STAMP), 'shooshy'),
    completed: true, paused: true, result: { elapsedMs, distanceKm: 1.2 }, ...overrides,
})

describe('qualifying run rule', () => {
    it('qualifies at exactly 300000 ms and not at 299999 ms', () => {
        expect(QUALIFYING_RUN_MS).toBe(300_000)
        expect(isQualifyingRun(finished(300_000))).toBe(true)
        expect(isQualifyingRun(finished(299_999))).toBe(false)
    })

    it('does not qualify an unfinished run or a run with no result', () => {
        expect(isQualifyingRun(finished(600_000, { completed: false }))).toBe(false)
        expect(isQualifyingRun(finished(600_000, { result: undefined }))).toBe(false)
    })

    it('makes no run log entry for a 90-second run', () => {
        expect(completedRunFromSession(finished(90_000))).toBeNull()
    })
})

describe('awardRunReward', () => {
    it('credits the chosen character with one unit and records the run id', () => {
        const run = { id: 'run-1', characterId: 'shooshy' as const }
        const { progression: next, awarded } = awardRunReward(progression(), run, new Date('2026-10-10T05:00:00.000Z'))
        expect(awarded).toBe(true)
        expect(next.wallets).toEqual({ shiba: 0, shooshy: 1 })
        expect(next.rewardedRunIds).toEqual(['run-1'])
        expect(next.updatedAt).toBe('2026-10-10T05:00:00.000Z')
    })

    it('credits Chase bones to shiba and leaves shooshy unchanged', () => {
        const { progression: next } = awardRunReward(progression(), { id: 'r', characterId: 'shiba' })
        expect(next.wallets).toEqual({ shiba: 1, shooshy: 0 })
    })

    it('returns awarded=false the second time for the same run and changes nothing', () => {
        const first = awardRunReward(progression(), { id: 'run-1', characterId: 'shiba' }).progression
        const second = awardRunReward(first, { id: 'run-1', characterId: 'shiba' })
        expect(second.awarded).toBe(false)
        expect(second.progression).toBe(first)
        expect(second.progression.wallets.shiba).toBe(1)
    })

    it('does not mutate the input progression', () => {
        const before = progression()
        awardRunReward(before, { id: 'run-1', characterId: 'shiba' })
        expect(before).toEqual(progression())
    })
})

describe('recordCompletedRun', () => {
    it('keeps an obese-start snapshot through a qualifying completion, and the next run can start healthy', async () => {
        const repos = createLocalStorageRepositories()
        const obeseStart = finished(1_500_000, { characterId: 'shiba', id: 'obese-start', healthAtStart: 'obese' })
        expect((await recordCompletedRun(repos, obeseStart)).awarded).toBe(true)
        expect((await repos.completedRuns.load('obese-start'))?.characterId).toBe('shiba')
        // The run log entry has no health field: the snapshot lives on the session only.
        expect(await repos.runSessions.load('obese-start')).toBeNull()
        expect((await repos.progression.load()).wallets.shiba).toBe(1)
        const next = newRunSession(workout, 'next-run', new Date(STAMP), 'shiba', 'healthy')
        expect(next.healthAtStart).toBe('healthy')
    })

    it('pays Chase for a qualifying run started as Chase and writes the run log', async () => {
        const repos = createLocalStorageRepositories()
        const run = finished(1_500_000, { characterId: 'shiba', id: 'chase-run' })
        expect((await recordCompletedRun(repos, run)).awarded).toBe(true)
        const saved = await repos.progression.load()
        expect(saved.wallets).toEqual({ shiba: 1, shooshy: 0 })
        expect((await repos.completedRuns.load('chase-run'))?.characterId).toBe('shiba')
    })

    it('pays Shooshy fish for a run started as Shooshy', async () => {
        const repos = createLocalStorageRepositories()
        await recordCompletedRun(repos, finished(1_500_000, { characterId: 'shooshy', id: 'shoo-run' }))
        expect((await repos.progression.load()).wallets).toEqual({ shiba: 0, shooshy: 1 })
    })

    it('does not award or log a 90-second run', async () => {
        const repos = createLocalStorageRepositories()
        expect((await recordCompletedRun(repos, finished(90_000, { id: 'short' }))).awarded).toBe(false)
        expect(await repos.completedRuns.load('short')).toBeNull()
        expect((await repos.progression.load()).wallets).toEqual({ shiba: 0, shooshy: 0 })
    })

    it('credits a legacy session without characterId to Chase', async () => {
        const repos = createLocalStorageRepositories()
        const legacy = finished(1_500_000, { id: 'legacy' })
        delete legacy.characterId
        await recordCompletedRun(repos, legacy)
        expect((await repos.progression.load()).wallets).toEqual({ shiba: 1, shooshy: 0 })
        expect((await repos.completedRuns.load('legacy'))?.characterId).toBe('shiba')
    })

    it('does not award again when the same session is re-saved with a new updatedAt', async () => {
        const repos = createLocalStorageRepositories()
        const run = finished(1_500_000, { characterId: 'shooshy', id: 'edited' })
        await recordCompletedRun(repos, run)
        await recordCompletedRun(repos, { ...run, updatedAt: '2026-10-10T06:00:00.000Z' })
        expect((await repos.progression.load()).wallets.shooshy).toBe(1)
        expect((await repos.completedRuns.load('edited'))).not.toBeNull()
        expect(values.get('stride.runlog')?.match(/"id":"edited"/g)).toHaveLength(1)
    })

    it('does not award again after a reload (a fresh repository instance reads the same storage)', async () => {
        const run = finished(1_500_000, { characterId: 'shiba', id: 'reload' })
        await recordCompletedRun(createLocalStorageRepositories(), run)
        await recordCompletedRun(createLocalStorageRepositories(), run)
        expect((await createLocalStorageRepositories().progression.load()).wallets.shiba).toBe(1)
    })

    it('adds a missing run log entry on a repeat without a second unit', async () => {
        const repos = createLocalStorageRepositories()
        const run = finished(1_500_000, { characterId: 'shiba', id: 'partial' })
        // Simulate a crash after the progression write and before the run log write.
        await repos.progression.save(awardRunReward(await repos.progression.load(), { id: 'partial', characterId: 'shiba' }).progression)
        expect((await recordCompletedRun(repos, run)).awarded).toBe(false)
        expect((await repos.completedRuns.load('partial'))).not.toBeNull()
        expect((await repos.progression.load()).wallets.shiba).toBe(1)
    })
})
