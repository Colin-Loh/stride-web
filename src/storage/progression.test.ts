import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SCHEMA_VERSION, type CompletedRun, type Progression } from '../domain/types'
import { generatePersonalizedWorkout } from '../plan/generate'
import { derivePersonalBaseline } from '../plan/baseline'
import { newRunSession } from '../run/session'
import { isCompletedRun, isProgression, isRunSession } from '../domain/guards'
import { localDateOf } from '../progression/localDate'
import {
    createLocalStorageRepositories, LocalStorageCompletedRunRepository, LocalStorageProgressionRepository,
    LocalStorageRunSessionRepository,
} from './localStorage'
import { clearStorageNotice, OUTDATED_NOTICE, storageNotice } from './notice'

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
afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

const STAMP = '2026-10-10T00:00:00.000Z'
const ANSWERS = {
    fitness_method: 'recent_race', recent_race_distance: 5, recent_race_time: 2100, training_focus: 'base',
    weekly_volume: 15, running_days: 3, training_effort: 'base',
} as const
const baseline = derivePersonalBaseline(ANSWERS)

const makeCompletedRun = (id = 'run-1'): CompletedRun => ({
    id, schemaVersion: SCHEMA_VERSION, createdAt: STAMP, updatedAt: STAMP,
    characterId: 'shooshy', workoutId: 'threshold', planSessionId: null,
    completedAt: STAMP, elapsedMs: 1_500_000, distanceKm: 5,
})

const makeProgression = (): Progression => ({
    id: 'progression', schemaVersion: SCHEMA_VERSION, createdAt: STAMP, updatedAt: STAMP,
    startDate: '2026-10-10',
    wallets: { shiba: 3, shooshy: 0 },
    lastClaimedDate: { shiba: '2026-10-10', shooshy: '2026-10-09' },
    rewardedRunIds: ['run-1'],
    inventory: { shiba: [], shooshy: [] },
    equipped: { shiba: null, shooshy: null },
})

describe('run log repository', () => {
    it('round-trips completed runs under stride.runlog and survives a new instance', async () => {
        const first = new LocalStorageCompletedRunRepository()
        const run = makeCompletedRun()
        await first.save(run)
        expect(values.has('stride.runlog')).toBe(true)
        expect(await new LocalStorageCompletedRunRepository().load('run-1')).toEqual(run)
        expect(storageNotice()).toBe('')
    })

    it('keeps the run log separate from the run session', async () => {
        await new LocalStorageCompletedRunRepository().save(makeCompletedRun())
        expect(await new LocalStorageRunSessionRepository().list()).toEqual([])
        expect(values.has('stride.session')).toBe(false)
    })

    it('discards a completed run with an unknown character and says so', async () => {
        values.set('stride.runlog', JSON.stringify([{ ...makeCompletedRun(), characterId: 'cat' }]))
        expect(await new LocalStorageCompletedRunRepository().list()).toEqual([])
        expect(storageNotice()).toBe(OUTDATED_NOTICE)
    })

    it('is exposed on the repositories bundle', async () => {
        const repositories = createLocalStorageRepositories()
        await repositories.completedRuns.save(makeCompletedRun())
        expect(await repositories.completedRuns.list()).toHaveLength(1)
    })
})

describe('run session additions', () => {
    const run = () => newRunSession(generatePersonalizedWorkout({ category: 'threshold', baseline }), 'session-1')

    it('accepts runs with and without the optional character and plan session fields', () => {
        expect(isRunSession(run())).toBe(true)
        expect(isRunSession({ ...run(), characterId: 'shiba', planSessionId: 'week-1-session-2' })).toBe(true)
        expect(isRunSession({ ...run(), characterId: null })).toBe(false)
        expect(isRunSession({ ...run(), planSessionId: 7 })).toBe(false)
    })

    it('round-trips the health snapshot through storage and keeps it after a reload', async () => {
        const first = createLocalStorageRepositories()
        const started = { ...run(), characterId: 'shiba' as const, healthAtStart: 'obese' as const }
        await first.runSessions.save(started)
        const reloaded = await createLocalStorageRepositories().runSessions.list()
        expect(reloaded).toEqual([started])
        expect(reloaded[0].healthAtStart).toBe('obese')
        expect(storageNotice()).toBe('')
    })

    it('discards a session with an unknown health value and reports it as outdated', async () => {
        values.set('stride.session', JSON.stringify([{ ...run(), healthAtStart: 'sick' }]))
        expect(await createLocalStorageRepositories().runSessions.list()).toEqual([])
        expect(storageNotice()).toContain('outdated')
        expect(values.has('stride.session')).toBe(false)
    })

    it('loads a session saved before the field existed with no snapshot', async () => {
        values.set('stride.session', JSON.stringify([run()]))
        const [loaded] = await createLocalStorageRepositories().runSessions.list()
        expect(loaded.healthAtStart).toBeUndefined()
        expect(storageNotice()).toBe('')
    })
})

describe('progression repository', () => {
    it('creates a progression on first load with today as startDate and zero wallets, and saves it at once', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2026, 9, 10, 9, 0))
        const repository = new LocalStorageProgressionRepository()
        const created = await repository.load()
        expect(created).toMatchObject({
            id: 'progression', schemaVersion: SCHEMA_VERSION, startDate: '2026-10-10',
            wallets: { shiba: 0, shooshy: 0 }, rewardedRunIds: [],
            inventory: { shiba: [], shooshy: [] }, equipped: { shiba: null, shooshy: null },
        })
        expect(isProgression(created)).toBe(true)
        expect(JSON.parse(values.get('stride.progression')!)).toEqual(JSON.parse(JSON.stringify(created)))
    })

    it('keeps the same startDate across reloads, even on a later day', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2026, 9, 10, 9, 0))
        const first = await new LocalStorageProgressionRepository().load()
        vi.setSystemTime(new Date(2026, 9, 14, 9, 0))
        const reloaded = await new LocalStorageProgressionRepository().load()
        expect(reloaded.startDate).toBe('2026-10-10')
        expect(reloaded).toEqual(first)
    })

    it('round-trips a saved progression without changing it', async () => {
        const repository = new LocalStorageProgressionRepository()
        const progression = makeProgression()
        await repository.save(progression)
        expect(await new LocalStorageProgressionRepository().load()).toEqual(progression)
        expect(storageNotice()).toBe('')
    })

    it('preserves a corrupt record under stride.progression.invalid, shows the notice, and creates a fresh one', async () => {
        const corrupt = JSON.stringify({ ...makeProgression(), wallets: { shiba: -4, shooshy: 0 } })
        values.set('stride.progression', corrupt)
        const loaded = await new LocalStorageProgressionRepository().load()
        expect(values.get('stride.progression.invalid')).toBe(corrupt)
        expect(storageNotice()).toBe(OUTDATED_NOTICE)
        expect(loaded.wallets).toEqual({ shiba: 0, shooshy: 0 })
        expect(JSON.parse(values.get('stride.progression')!).wallets).toEqual({ shiba: 0, shooshy: 0 })
    })

    it('preserves unparseable text too', async () => {
        values.set('stride.progression', '{not json')
        await new LocalStorageProgressionRepository().load()
        expect(values.get('stride.progression.invalid')).toBe('{not json')
        expect(storageNotice()).toBe(OUTDATED_NOTICE)
    })

    it('does not overwrite an earlier preserved copy', async () => {
        values.set('stride.progression.invalid', 'first copy')
        values.set('stride.progression', '[]')
        await new LocalStorageProgressionRepository().load()
        expect(values.get('stride.progression.invalid')).toBe('first copy')
        expect([...values.keys()].some((key) => key.startsWith('stride.progression.invalid.'))).toBe(true)
    })

    it('leaves the bad record in place when the backup cannot be written', async () => {
        const corrupt = '{"broken": true}'
        values.set('stride.progression', corrupt)
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => {
                if (key.startsWith('stride.progression.invalid')) throw new Error('quota')
                values.set(key, value)
            },
            removeItem: (key: string) => values.delete(key),
        })
        const loaded = await new LocalStorageProgressionRepository().load()
        expect(loaded.wallets).toEqual({ shiba: 0, shooshy: 0 })
        expect(values.get('stride.progression')).toBe(corrupt)
        expect(values.has('stride.progression.invalid')).toBe(false)
    })
})

describe('completed run guard', () => {
    it('accepts a valid completed run and rejects a bad plan session type', () => {
        expect(isCompletedRun(makeCompletedRun())).toBe(true)
        expect(isCompletedRun({ ...makeCompletedRun(), planSessionId: 3 })).toBe(false)
        expect(isCompletedRun({ ...makeCompletedRun(), completedAt: 'yesterday' })).toBe(false)
    })
})

describe('local date of a progression start', () => {
    it('matches the local day of the creation instant', () => {
        expect(localDateOf(new Date(2026, 9, 10, 23, 30).getTime())).toBe('2026-10-10')
    })
})
