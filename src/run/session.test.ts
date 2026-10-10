import { describe, expect, it } from 'vitest'
import { generatePersonalizedWorkout } from '../plan/generate'
import { derivePersonalBaseline } from '../plan/baseline'
import { SCHEMA_VERSION } from '../domain/types'
import { newRunSession, withHealthSnapshot } from './session'

const ANSWERS = {
    fitness_method: 'recent_race', recent_race_distance: 5, recent_race_time: 2100, training_focus: 'base',
    weekly_volume: 15, running_days: 3, training_effort: 'base',
} as const
const workout = generatePersonalizedWorkout({ category: 'threshold', baseline: derivePersonalBaseline(ANSWERS) })
const NOW = new Date('2026-10-10T05:00:00.000Z')

describe('newRunSession health snapshot', () => {
    it('stores healthAtStart when given', () => {
        expect(newRunSession(workout, 'run-1', NOW, 'shiba', 'obese').healthAtStart).toBe('obese')
        expect(newRunSession(workout, 'run-2', NOW, 'shooshy', 'healthy').healthAtStart).toBe('healthy')
    })

    it('leaves the field absent when not given, so the key is not written at all', () => {
        const run = newRunSession(workout, 'run-1', NOW, 'shiba')
        expect('healthAtStart' in run).toBe(false)
        expect(newRunSession(workout, 'run-1', NOW).healthAtStart).toBeUndefined()
    })

    it('keeps the stored schema version at 1', () => {
        expect(newRunSession(workout, 'run-1', NOW, 'shiba', 'healthy').schemaVersion).toBe(SCHEMA_VERSION)
        expect(SCHEMA_VERSION).toBe(1)
    })
})

describe('withHealthSnapshot', () => {
    it('fills in the health when the session has none', () => {
        const run = newRunSession(workout, 'run-1', NOW, 'shiba')
        expect(withHealthSnapshot(run, 'obese').healthAtStart).toBe('obese')
        expect(run.healthAtStart).toBeUndefined()
    })

    it('never overwrites a snapshot that is already there', () => {
        const run = newRunSession(workout, 'run-1', NOW, 'shiba', 'healthy')
        expect(withHealthSnapshot(run, 'obese')).toBe(run)
    })

    it('returns the session unchanged when there is no health to give', () => {
        const run = newRunSession(workout, 'run-1', NOW, 'shiba')
        expect(withHealthSnapshot(run, undefined)).toBe(run)
    })
})
