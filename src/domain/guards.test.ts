import { describe, expect, it } from 'vitest'
import { generatePersonalizedWorkout } from '../plan/generate'
import { derivePersonalBaseline } from '../plan/baseline'
import { newRunSession } from '../run/session'
import { isProgression, isRunSession } from './guards'
import { SCHEMA_VERSION, type Progression } from './types'

const ANSWERS = {
    fitness_method: 'recent_race', recent_race_distance: 5, recent_race_time: 2100, training_focus: 'base',
    weekly_volume: 15, running_days: 3, training_effort: 'base',
} as const
const run = () => newRunSession(generatePersonalizedWorkout({ category: 'threshold', baseline: derivePersonalBaseline(ANSWERS) }), 'session-1')

describe('isRunSession healthAtStart', () => {
    it('accepts an absent field, healthy and obese', () => {
        expect(isRunSession(run())).toBe(true)
        expect(isRunSession({ ...run(), healthAtStart: 'healthy' })).toBe(true)
        expect(isRunSession({ ...run(), healthAtStart: 'obese' })).toBe(true)
    })

    it('rejects any other value', () => {
        for (const healthAtStart of [null, '', 'Obese', 'sick', 0, true]) {
            expect(isRunSession({ ...run(), healthAtStart })).toBe(false)
        }
    })
})

describe('isProgression grantsApplied', () => {
    const progression = (): Progression => ({
        id: 'progression', schemaVersion: SCHEMA_VERSION, createdAt: '2026-10-10T00:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z',
        startDate: '2026-10-10', wallets: { shiba: 0, shooshy: 0 }, lastClaimedDate: { shiba: '2026-10-10', shooshy: '2026-10-10' },
        rewardedRunIds: [], grantsApplied: [], inventory: { shiba: [], shooshy: [] }, equipped: { shiba: null, shooshy: null },
    })

    it('accepts a legacy record without grantsApplied', () => {
        const { grantsApplied: _omitted, ...legacy } = progression()
        expect(isProgression(legacy)).toBe(true)
    })

    it('accepts a record with grantsApplied as a string list', () => {
        expect(isProgression({ ...progression(), grantsApplied: ['test-currency-20'] })).toBe(true)
    })

    it('rejects a record whose grantsApplied is not a string list', () => {
        expect(isProgression({ ...progression(), grantsApplied: 'test-currency-20' })).toBe(false)
        expect(isProgression({ ...progression(), grantsApplied: [1] })).toBe(false)
    })
})
