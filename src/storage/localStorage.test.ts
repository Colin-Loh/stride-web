import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SCHEMA_VERSION, type Answers } from '../domain/types'
import { derivePersonalBaseline } from '../plan/baseline'
import { generatePersonalizedWorkout } from '../plan/generate'
import { generateTrainingPlan } from '../plan/trainingPlan'
import { elapsedMs, newRunSession } from '../run/session'
import {
    createLocalStorageRepositories, LocalStorageAnswersRepository, LocalStoragePlanRepository,
    LocalStoragePreferencesRepository, LocalStorageRunSessionRepository,
} from './localStorage'
import { clearStorageNotice, storageNotice } from './notice'
import type { PlanRepository } from './repository'

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
afterEach(() => vi.unstubAllGlobals())

const ANSWERS = {
    fitness_method: 'recent_race', recent_race_distance: 5, recent_race_time: 2100, training_focus: 'base',
    weekly_volume: 15, running_days: 3, training_effort: 'base',
} as const
const makePlan = (id: string, now = new Date(2026, 9, 8)) =>
    generateTrainingPlan({ baseline: derivePersonalBaseline(ANSWERS), now, newId: () => id })!
const makeRun = (id = 'run-1') => newRunSession(generatePersonalizedWorkout({ category: 'threshold', baseline: derivePersonalBaseline(ANSWERS) }), id)
const makeAnswers = (): Answers => {
    const stamp = '2026-10-08T12:00:00.000Z'
    return { id: 'answers-1', schemaVersion: SCHEMA_VERSION, createdAt: stamp, updatedAt: stamp, values: ANSWERS }
}

describe('repository round-trips', () => {
    it('saves, loads, lists and deletes plans without changing them', async () => {
        const repository: PlanRepository = new LocalStoragePlanRepository()
        const first = makePlan('plan-a', new Date(2026, 9, 8))
        const second = makePlan('plan-b', new Date(2026, 9, 9))
        await repository.save(first)
        await repository.save(second)
        expect(await repository.load('plan-a')).toEqual(first)
        expect((await repository.list()).map((plan) => plan.id)).toEqual(['plan-b', 'plan-a'])
        await repository.save({ ...first, notes: ['changed'], updatedAt: '2026-10-20T00:00:00.000Z' })
        expect((await repository.list()).map((plan) => plan.id)).toEqual(['plan-a', 'plan-b'])
        expect((await repository.load('plan-a'))?.notes).toEqual(['changed'])
        await repository.delete('plan-a')
        expect(await repository.load('plan-a')).toBeNull()
        expect(await repository.list()).toHaveLength(1)
        expect(storageNotice()).toBe('')
    })

    it('stores plain JSON: what comes back equals what a JSON round-trip of the plan gives', async () => {
        const repository = new LocalStoragePlanRepository()
        const plan = makePlan('plan-a')
        await repository.save(plan)
        expect(JSON.parse(values.get('stride.plan')!)).toEqual([JSON.parse(JSON.stringify(plan))])
    })

    it('round-trips answers and a run snapshot with its speed history', async () => {
        const answers = new LocalStorageAnswersRepository()
        await answers.save(makeAnswers())
        expect(await answers.load('answers-1')).toEqual(makeAnswers())
        const runs = new LocalStorageRunSessionRepository()
        const run = { ...makeRun(), startedAt: 1000, speedChanges: [{ atMs: 5000, offset: 0.1 }] }
        await runs.save(run)
        expect(await runs.list()).toEqual([run])
        await runs.delete(run.id)
        expect(await runs.list()).toEqual([])
        expect(values.has('stride.session')).toBe(false)
        expect(storageNotice()).toBe('')
    })

    it('excludes current and previous pauses; completion freezes actual time', () => {
        const run = { ...makeRun(), startedAt: 1000, pausedMs: 2000, paused: true, pauseStartedAt: 8000 }
        expect(elapsedMs(run, 20_000)).toBe(5000)
        expect(elapsedMs({ ...run, completed: true, result: { elapsedMs: 4500, distanceKm: null } }, 999_999)).toBe(4500)
    })

    it('exposes all four repositories behind the interfaces', async () => {
        const repositories = createLocalStorageRepositories()
        await repositories.plans.save(makePlan('plan-a'))
        expect(await repositories.plans.list()).toHaveLength(1)
        expect(await repositories.answers.list()).toEqual([])
    })
})

describe('old and invalid data is discarded with the notice, without crashing', () => {
    it('rejects the old single-plan shape with the old workout ids', async () => {
        const oldWorkout = (category: string) => ({
            category, categoryName: 'Old', explanation: [], adjustments: [],
            baseline: { vdot: null, fitnessMethod: null, race: null, reportedEasySpeedKmh: null, weeklyKm: 15, daysPerWeek: 3, trainingEffort: null, trainingFocus: null, goalRaceDate: null },
            sections: [{ id: 'main', type: 'run', label: 'Run', effort: 'x', speedKmh: 8, target: { basis: 'time', durationSeconds: 600 } }],
        })
        for (const category of ['easy', 'tempo', 'cruise']) {
            clearStorageNotice()
            values.set('stride.plan', JSON.stringify(oldWorkout(category)))
            expect(await new LocalStoragePlanRepository().list()).toEqual([])
            expect(storageNotice()).toContain('outdated or invalid')
        }
    })

    it('rejects a plan whose sessions use an old workout id, or that lacks a schema version', async () => {
        const plan = makePlan('plan-a')
        for (const kind of ['easy', 'tempo', 'cruise']) {
            clearStorageNotice()
            const old = {
                ...plan, weeks: plan.weeks.map((week, index) => index === 0
                    ? { ...week, sessions: week.sessions.map((session) => ({ ...session, kind })) } : week)
            }
            values.set('stride.plan', JSON.stringify([old]))
            const repository = new LocalStoragePlanRepository()
            expect(await repository.load('plan-a')).toBeNull()
            expect(storageNotice()).toContain('outdated or invalid')
            expect(values.has('stride.plan')).toBe(false)
        }
        clearStorageNotice()
        const { schemaVersion: _removed, ...unversioned } = plan
        values.set('stride.plan', JSON.stringify([unversioned]))
        expect(await new LocalStoragePlanRepository().list()).toEqual([])
        expect(storageNotice()).toContain('outdated')
        clearStorageNotice()
        values.set('stride.plan', JSON.stringify([{ ...plan, schemaVersion: SCHEMA_VERSION + 1 }]))
        expect(await new LocalStoragePlanRepository().list()).toEqual([])
        expect(storageNotice()).toContain('outdated')
    })

    it('keeps the valid records when only some are old', async () => {
        const plan = makePlan('plan-a')
        values.set('stride.plan', JSON.stringify([plan, { category: 'easy' }]))
        expect(await new LocalStoragePlanRepository().list()).toEqual([plan])
        expect(storageNotice()).toContain('outdated')
        expect(JSON.parse(values.get('stride.plan')!)).toEqual([plan])
    })

    it('rejects an old run session (version 2, easy workout) and an invalid speed history', async () => {
        const run = makeRun()
        values.set('stride.session', JSON.stringify({ version: 2, workoutId: 'easy', plan: { ...run.plan, category: 'easy' }, startedAt: 1, pausedMs: 0 }))
        expect(await new LocalStorageRunSessionRepository().list()).toEqual([])
        expect(storageNotice()).toContain('outdated')
        clearStorageNotice()
        values.set('stride.session', JSON.stringify([{ ...run, speedChanges: [{ atMs: 2, offset: 1 }, { atMs: 1, offset: 1 }] }]))
        expect(await new LocalStorageRunSessionRepository().list()).toEqual([])
        expect(storageNotice()).toContain('outdated')
    })

    it('rejects answers saved as the old bare map, or with removed questions', async () => {
        values.set('stride.baseline', JSON.stringify(ANSWERS))
        expect(await new LocalStorageAnswersRepository().list()).toEqual([])
        expect(storageNotice()).toContain('outdated')
        clearStorageNotice()
        values.set('stride.baseline', JSON.stringify([{ ...makeAnswers(), values: { ...ANSWERS, preferred_days: ['sat'] } }]))
        expect(await new LocalStorageAnswersRepository().list()).toEqual([])
        expect(storageNotice()).toContain('outdated')
    })

    it('reads damaged JSON as empty with a notice, and keeps a valid profile', async () => {
        values.set('stride.profile', JSON.stringify({ name: 'Alex', level: 'beginner' }))
        values.set('stride.session', '{bad json')
        expect(await new LocalStorageRunSessionRepository().list()).toEqual([])
        expect(storageNotice()).toContain('could not be read')
        expect((await new LocalStoragePreferencesRepository().load()).name).toBe('Alex')
    })

    it('does not throw when storage is blocked', async () => {
        vi.stubGlobal('localStorage', { getItem: () => { throw Error('blocked') }, setItem: () => { throw Error('quota') } })
        expect(await new LocalStorageAnswersRepository().list()).toEqual([])
        expect((await new LocalStoragePreferencesRepository().load()).muted).toBe(false)
        await expect(new LocalStorageRunSessionRepository().save(makeRun())).resolves.toBeUndefined()
        expect(storageNotice()).toContain('cannot be saved')
    })
})

describe('preferences', () => {
    it('round-trips the name, character and mute setting, and reads the numeric mute of older saves', async () => {
        const repository = new LocalStoragePreferencesRepository()
        expect(await repository.load()).toEqual({ name: null, character: 'shiba', muted: false })
        await repository.save({ name: 'Alex', character: 'cat', muted: true })
        expect(await repository.load()).toEqual({ name: 'Alex', character: 'cat', muted: true })
        values.set('stride.muted', '1')
        expect((await repository.load()).muted).toBe(true)
        await repository.save({ name: null, character: 'cat', muted: false })
        expect(await repository.load()).toEqual({ name: null, character: 'cat', muted: false })
        expect(storageNotice()).toBe('')
    })
})
