import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SCHEMA_VERSION, type CompletedRun, type Progression } from '../domain/types'
import { generatePersonalizedWorkout } from '../plan/generate'
import { derivePersonalBaseline } from '../plan/baseline'
import { newRunSession } from '../run/session'
import { isCompletedRun, isProgression, isRunSession } from '../domain/guards'
import { LEGACY_ITEMS } from '../cosmetics/legacy'
import { nothingWorn } from '../cosmetics/catalog'
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
    grantsApplied: ['test-currency-20', 'refund-legacy-accessories-v1'],
    inventory: { shiba: [], shooshy: [] },
    equipped: { shiba: nothingWorn(), shooshy: nothingWorn() },
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
    it('creates a progression on first load with today as startDate, 20 in each wallet, and the grant recorded, and saves it at once', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2026, 9, 10, 9, 0))
        const repository = new LocalStorageProgressionRepository()
        const created = await repository.load()
        expect(created).toMatchObject({
            id: 'progression', schemaVersion: SCHEMA_VERSION, startDate: '2026-10-10',
            wallets: { shiba: 20, shooshy: 20 }, rewardedRunIds: [], grantsApplied: ['test-currency-20', 'refund-legacy-accessories-v1'],
            inventory: { shiba: [], shooshy: [] }, equipped: { shiba: { face: null, head: null, body: null }, shooshy: { face: null, head: null, body: null } },
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

    it('grants 20 to each wallet once for a record saved before grants existed, and a second load adds nothing', async () => {
        const { grantsApplied: _omitted, ...legacy } = makeProgression()
        values.set('stride.progression', JSON.stringify(legacy))
        const first = await new LocalStorageProgressionRepository().load()
        expect(first.wallets).toEqual({ shiba: 23, shooshy: 20 })
        expect(first.grantsApplied).toEqual(['refund-legacy-accessories-v1', 'test-currency-20'])
        expect(JSON.parse(values.get('stride.progression')!)).toEqual(JSON.parse(JSON.stringify(first)))
        expect(storageNotice()).toBe('')
        const second = await new LocalStorageProgressionRepository().load()
        expect(second.wallets).toEqual({ shiba: 23, shooshy: 20 })
        expect(second.grantsApplied).toEqual(['refund-legacy-accessories-v1', 'test-currency-20'])
    })

    it('leaves wallets unchanged for a record that already has the grant id', async () => {
        values.set('stride.progression', JSON.stringify(makeProgression()))
        const loaded = await new LocalStorageProgressionRepository().load()
        expect(loaded.wallets).toEqual({ shiba: 3, shooshy: 0 })
        expect(storageNotice()).toBe('')
    })

    it('preserves a corrupt record under stride.progression.invalid, shows the notice, and creates a fresh one', async () => {
        const corrupt = JSON.stringify({ ...makeProgression(), wallets: { shiba: -4, shooshy: 0 } })
        values.set('stride.progression', corrupt)
        const loaded = await new LocalStorageProgressionRepository().load()
        expect(values.get('stride.progression.invalid')).toBe(corrupt)
        expect(storageNotice()).toBe(OUTDATED_NOTICE)
        expect(loaded.wallets).toEqual({ shiba: 20, shooshy: 20 })
        expect(JSON.parse(values.get('stride.progression')!).wallets).toEqual({ shiba: 20, shooshy: 20 })
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
        expect(loaded.wallets).toEqual({ shiba: 20, shooshy: 20 })
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

describe('legacy accessory migration and slot load', () => {
    const legacyId = (price: number, character: 'shiba' | 'shooshy') =>
        LEGACY_ITEMS.find((item) => item.price === price && item.character === character)!.id
    const MARKER = 'refund-legacy-accessories-v1'

    it('refunds owned legacy items once, removes them, clears their slots, and a second load changes nothing', async () => {
        const medal = legacyId(5, 'shiba')
        const scarf = legacyId(3, 'shooshy')
        const legacy = {
            ...makeProgression(),
            wallets: { shiba: 0, shooshy: 0 },
            grantsApplied: ['test-currency-20'],
            inventory: { shiba: [medal], shooshy: [scarf] },
            equipped: { shiba: medal, shooshy: scarf },
        }
        values.set('stride.progression', JSON.stringify(legacy))
        const first = await new LocalStorageProgressionRepository().load()
        expect(first.wallets).toEqual({ shiba: 5, shooshy: 3 })
        expect(first.inventory).toEqual({ shiba: [], shooshy: [] })
        expect(first.equipped).toEqual({ shiba: nothingWorn(), shooshy: nothingWorn() })
        expect(first.grantsApplied.filter((id) => id === MARKER)).toHaveLength(1)
        const second = await new LocalStorageProgressionRepository().load()
        expect(second.wallets).toEqual({ shiba: 5, shooshy: 3 })
        expect(second.grantsApplied.filter((id) => id === MARKER)).toHaveLength(1)
    })

    it('loads a legacy-shape equipped record as all-null slots', async () => {
        values.set('stride.progression', JSON.stringify({
            ...makeProgression(),
            equipped: { shiba: null, shooshy: null },
        }))
        const loaded = await new LocalStorageProgressionRepository().load()
        expect(loaded.equipped).toEqual({ shiba: nothingWorn(), shooshy: nothingWorn() })
    })

    it('clears an invalid stored slot id and keeps the valid slots', async () => {
        values.set('stride.progression', JSON.stringify({
            ...makeProgression(),
            inventory: { shiba: ['chase-black-sunglasses'], shooshy: [] },
            equipped: { shiba: { face: 'chase-black-sunglasses', head: 'chase-sushi-hat', body: null }, shooshy: nothingWorn() },
        }))
        const loaded = await new LocalStorageProgressionRepository().load()
        expect(loaded.equipped.shiba).toEqual({ face: 'chase-black-sunglasses', head: null, body: null })
    })

    it('keeps all worn slots through a save and reload', async () => {
        const worn = {
            ...makeProgression(),
            inventory: { shiba: ['chase-black-sunglasses', 'chase-sushi-hat'], shooshy: [] },
            equipped: { shiba: { face: 'chase-black-sunglasses', head: 'chase-sushi-hat', body: null }, shooshy: nothingWorn() },
        }
        await new LocalStorageProgressionRepository().save(worn)
        const reloaded = await new LocalStorageProgressionRepository().load()
        expect(reloaded.equipped).toEqual(worn.equipped)
    })
})
