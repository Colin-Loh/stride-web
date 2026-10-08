import { describe, expect, it } from 'vitest'
import { derivePersonalBaseline } from './baseline'
import { calculateSectionMetrics, calculateWorkoutTotals, generatePersonalizedWorkout, validateWorkout } from './generate'
import { paceSecondsPerKmFromSpeed } from './convert'
import { PROPOSED_TEMPO_SHAPE } from './rules'
import { danielsSpeeds } from './vdot'
import type { BaselineAnswers } from './types'
import type { WorkoutId } from '../workouts'

const answers = (overrides: Partial<BaselineAnswers> = {}): BaselineAnswers => ({
    raceKnown: true, raceDistanceKm: 5, raceSeconds: 25 * 60,
    weeklyKm: 40, daysPerWeek: 4,
    continuity: 'continuous', availableMinutes: 180, ...overrides,
})

const build = (category: WorkoutId, overrides: Partial<BaselineAnswers> = {}) =>
    generatePersonalizedWorkout({ category, baseline: derivePersonalBaseline(answers(overrides)) })

const mainSeconds = (plan: ReturnType<typeof build>) => calculateSectionMetrics(plan.sections[1]).durationSeconds!

describe('tempo run', () => {
    it('runs the main block at Daniels threshold pace for the race', () => {
        const plan = build('tempo')
        const threshold = danielsSpeeds(plan.baseline.vdot!).thresholdKmh
        expect(Math.abs(paceSecondsPerKmFromSpeed(plan.sections[1].speedKmh!) - paceSecondsPerKmFromSpeed(threshold))).toBeLessThanOrEqual(2)
    })

    it('holds a steady 20 minutes when the week is big enough', () => {
        expect(mainSeconds(build('tempo', { weeklyKm: 60 }))).toBe(20 * 60)
    })

    it('caps threshold work at 10% of a small week', () => {
        // 25 km/week -> 2.5 km at threshold, well under 20 minutes.
        const plan = build('tempo', { weeklyKm: 25 })
        const threshold = plan.sections[1].speedKmh!
        expect(mainSeconds(plan)).toBeCloseTo(Math.max(PROPOSED_TEMPO_SHAPE.minMainSeconds, (2.5 / threshold) * 3600), -1)
        expect(mainSeconds(plan)).toBeLessThan(20 * 60)
    })

    it('never cuts the warm-up below its floor, even when time is very short', () => {
        for (const minutes of [10, 20, 25, 30, 45]) {
            const warmup = build('tempo', { availableMinutes: minutes }).sections[0].target
            expect(warmup.basis === 'time' && warmup.durationSeconds).toBeGreaterThanOrEqual(PROPOSED_TEMPO_SHAPE.minWarmupSeconds)
        }
    })

    it('fits inside the available time when the floors leave room', () => {
        const plan = build('tempo', { availableMinutes: 30 })
        expect(calculateWorkoutTotals(plan.sections).durationSeconds!).toBeLessThanOrEqual(30 * 60 + 0.01)
        expect(validateWorkout(plan).ok).toBe(true)
    })

    it('flags a session that cannot fit safely instead of squeezing the warm-up', () => {
        const plan = build('tempo', { availableMinutes: 20 })
        expect(plan.adjustments.join(' ')).toContain('Allow more time')
        expect(validateWorkout(plan).ok).toBe(false)
    })
})

describe('long run', () => {
    it('takes 30% of a week under 64 km', () => {
        const target = build('long', { weeklyKm: 40 }).sections[1].target
        expect(target).toEqual({ basis: 'distance', distanceKm: 12 })
    })

    it('takes 25% of a week from 64 km up', () => {
        const plan = build('long', { weeklyKm: 80 })
        expect(calculateWorkoutTotals(plan.sections).durationSeconds).toBeLessThanOrEqual(150 * 60)
        expect(calculateSectionMetrics(plan.sections[1]).distanceKm).toBeLessThanOrEqual(20)
    })

    it('never runs past 150 minutes', () => {
        const plan = build('long', { weeklyKm: 160, availableMinutes: 240 })
        expect(mainSeconds(plan)).toBeLessThanOrEqual(150 * 60)
        expect(plan.adjustments.join(' ')).toContain('150 minutes')
    })

    it('runs at Daniels easy pace', () => {
        const plan = build('long')
        const zones = danielsSpeeds(plan.baseline.vdot!)
        expect(plan.sections[1].speedKmh!).toBeGreaterThanOrEqual(zones.easySlowKmh)
        expect(plan.sections[1].speedKmh!).toBeLessThanOrEqual(zones.easyFastKmh + 0.1)
    })

})

describe('easy run', () => {
    it('splits the week across the running days', () => {
        // 45 km over 3 days is 15 km, capped at the 30% long-run limit: 13.5 km.
        expect(build('easy', { weeklyKm: 45, daysPerWeek: 3 }).sections[1].target).toEqual({ basis: 'distance', distanceKm: 13.5 })
        // 50 km over 5 days is 10 km, well inside its 15 km cap.
        expect(build('easy', { weeklyKm: 50, daysPerWeek: 5 }).sections[1].target).toEqual({ basis: 'distance', distanceKm: 10 })
    })

    it('is never longer than a Daniels long run', () => {
        // Running twice a week: half of 20 km is 10 km, but the long-run cap is 30% = 6 km.
        expect(build('easy', { weeklyKm: 20, daysPerWeek: 2 }).sections[1].target).toEqual({ basis: 'distance', distanceKm: 6 })
    })

    it('needs a whole number of days from 1 to 7', () => {
        for (const daysPerWeek of [0, 8, 2.5]) {
            expect(derivePersonalBaseline(answers({ daysPerWeek })).missing.join(' ')).toContain('days a week')
        }
    })
})

describe('no time limit', () => {
    const noTime = { availableMinutes: undefined }

    it('gives hard sessions 10 minutes of easy running either side', () => {
        for (const category of ['tempo', 'cruise', 'interval'] as WorkoutId[]) {
            const plan = build(category, noTime)
            expect(plan.sections[0].target).toEqual({ basis: 'time', durationSeconds: 600 })
            expect(plan.sections[2].target).toEqual({ basis: 'time', durationSeconds: 600 })
            expect(validateWorkout(plan).ok).toBe(true)
        }
    })

    it('still holds Daniels\' limits and says so', () => {
        expect(mainSeconds(build('tempo', { ...noTime, weeklyKm: 60 }))).toBe(20 * 60)
        expect(mainSeconds(build('long', { ...noTime, weeklyKm: 160 }))).toBeLessThanOrEqual(150 * 60)
        expect(build('easy', noTime).explanation.join(' ')).toContain('did not set a time limit')
    })
})

describe('cruise intervals', () => {
    const repsOf = (plan: ReturnType<typeof build>) => {
        const mix = plan.sections[1].runWalk!
        return Math.round(mainSeconds(plan) / (mix.runSeconds + mix.walkSeconds))
    }

    it('caps reps at 10% of the week', () => {
        expect(repsOf(build('cruise', { weeklyKm: 40 }))).toBe(4)
        expect(repsOf(build('cruise', { weeklyKm: 60 }))).toBe(6)
    })

    it('never drops below two reps for a small week', () => {
        expect(repsOf(build('cruise', { weeklyKm: 12 }))).toBe(2)
    })

    it('rests about a fifth of the rep time', () => {
        const mix = build('cruise').sections[1].runWalk!
        expect(Math.abs(mix.walkSeconds - mix.runSeconds / 5)).toBeLessThanOrEqual(7.5)
    })
})

describe('explanation', () => {
    it('shows the race, VDOT and Daniels paces on every plan', () => {
        for (const category of ['easy', 'long', 'tempo', 'cruise', 'interval'] as WorkoutId[]) {
            const first = build(category).explanation[0]
            expect(first).toContain('5 km in 25:00')
            expect(first).toContain('VDOT')
        }
    })
})
