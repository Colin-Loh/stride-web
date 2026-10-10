import { describe, expect, it } from 'vitest'
import { generatePersonalizedWorkout } from '../plan/generate'
import { derivePersonalBaseline } from '../plan/baseline'
import { newRunSession } from '../run/session'
import { isRunSession } from './guards'

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
