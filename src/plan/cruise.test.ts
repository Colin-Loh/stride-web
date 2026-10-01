import { describe, expect, it } from 'vitest'
import { derivePersonalBaseline } from './baseline'
import { calculateWorkoutTotals, generatePersonalizedWorkout, planToSchema, validateWorkout } from './generate'
import { paceSecondsPerKmFromSpeed } from './convert'
import { PROPOSED_CRUISE_SHAPE } from './rules'
import { runProgress } from '../run/engine'
import type { BaselineAnswers } from './types'

const answers = (overrides: Partial<BaselineAnswers> = {}): BaselineAnswers => ({
    weeklyKm: 30, daysPerWeek: 4,
    continuity: 'continuous', paceKnown: true, paceMinutes: 7, paceSeconds: 0,
    availableMinutes: 60, ...overrides,
})

const build = (overrides: Partial<BaselineAnswers> = {}) =>
    generatePersonalizedWorkout({ category: 'cruise', baseline: derivePersonalBaseline(answers(overrides)) })

const spec = PROPOSED_CRUISE_SHAPE
const repsOf = (plan: ReturnType<typeof build>) => {
    const target = plan.sections[1].target
    const mix = plan.sections[1].runWalk!
    return target.basis === 'time' ? target.durationSeconds / (mix.runSeconds + mix.walkSeconds) : 0
}

describe('cruise intervals', () => {
    it('builds the three-part sandwich with a repeating cruise block', () => {
        const plan = build()
        expect(plan.sections.map(s => s.type)).toEqual(['warmup', 'run', 'cooldown'])
        expect(plan.sections[0].runWalk).toBeUndefined()
        expect(plan.sections[2].runWalk).toBeUndefined()
        // Daniels: about 1 minute of rest per 5 minutes of running, rounded to 15 s.
        const mix = plan.sections[1].runWalk!
        expect(mix.walkSeconds).toBe(Math.round(mix.runSeconds / 5 / 15) * 15)
        expect(validateWorkout(plan).ok).toBe(true)
    })

    it('sizes each rep from the distance and the runner\'s own tempo pace', () => {
        const plan = build()
        const mix = plan.sections[1].runWalk!
        const repSpeed = plan.sections[1].speedKmh!
        // One rep's distance at the derived rep speed should match the rep's time, within a rounding second.
        const expectedSeconds = (spec.repDistanceKm / repSpeed) * 3600
        expect(mix.runSeconds).toBeCloseTo(expectedSeconds, 0)
    })

    it('uses the same tempo pace as a Tempo run, not an invented number', () => {
        const cruise = build()
        const tempo = generatePersonalizedWorkout({ category: 'tempo', baseline: derivePersonalBaseline(answers()) })
        expect(cruise.sections[1].speedKmh).toBeCloseTo(tempo.sections[1].speedKmh!, 10)
    })

    it('sets rep pace to Daniels threshold pace for the runner\'s easy pace', () => {
        // 7:00/km easy as the fast end of the easy range is VDOT 33.7, threshold about 5:51/km.
        const pace = paceSecondsPerKmFromSpeed(build().sections[1].speedKmh!)
        expect(pace).toBeGreaterThanOrEqual(5 * 60 + 45)
        expect(pace).toBeLessThanOrEqual(5 * 60 + 55)
    })

    it('keeps each 1 km rep inside Daniels\' 3-10 minute window', () => {
        for (const paceMinutes of [5, 6, 7, 8, 9]) {
            const runSeconds = build({ paceMinutes }).sections[1].runWalk!.runSeconds
            expect(runSeconds).toBeGreaterThanOrEqual(180)
            expect(runSeconds).toBeLessThanOrEqual(600)
        }
    })

    it('recovers at an easy jog slower than rep pace, not a full stop', () => {
        const plan = build()
        const mix = plan.sections[1].runWalk!
        expect(mix.walkSpeedKmh!).toBeLessThan(plan.sections[1].speedKmh!)
        expect(mix.walkSpeedKmh!).toBeGreaterThan(0)
    })

    it('gives a bigger week more reps', () => {
        expect(repsOf(build({ weeklyKm: 20 }))).toBeLessThan(repsOf(build({ weeklyKm: 40 })))
    })

    it('keeps the whole sandwich inside the available time', () => {
        for (const minutes of [35, 45, 60, 90]) {
            const plan = build({ availableMinutes: minutes })
            const total = calculateWorkoutTotals(plan.sections).durationSeconds!
            expect(total).toBeLessThanOrEqual(minutes * 60 + 0.01)
            expect(validateWorkout(plan).ok).toBe(true)
        }
    })

    it('trims reps rather than skipping the warm-up when time is short', () => {
        const short = build({ weeklyKm: 60, availableMinutes: 40 })
        expect(repsOf(short)).toBeLessThan(repsOf(build({ weeklyKm: 60 })))
        const warmup = short.sections[0].target
        expect(warmup.basis === 'time' && warmup.durationSeconds).toBeGreaterThan(0)
        expect(short.adjustments.length).toBeGreaterThan(0)
    })

    it('never drops below the minimum rep count', () => {
        expect(repsOf(build({ availableMinutes: 10 }))).toBeGreaterThanOrEqual(spec.minReps)
    })

    it('never cuts the warm-up below its floor, even when time is very short', () => {
        for (const minutes of [10, 20, 30, 40]) {
            const warmup = build({ availableMinutes: minutes }).sections[0].target
            expect(warmup.basis === 'time' && warmup.durationSeconds).toBeGreaterThanOrEqual(spec.minWarmupSeconds)
        }
    })

    it('flags a session that cannot fit safely instead of squeezing the warm-up', () => {
        const plan = build({ availableMinutes: 10 })
        expect(plan.adjustments.join(' ')).toContain('Allow more time')
        expect(validateWorkout(plan).ok).toBe(false)
    })

    it('starts a runner who does not know their pace from the beginner default', () => {
        const plan = build({ paceKnown: false })
        expect(plan.sections.every(s => s.speedKmh !== null)).toBe(true)
        // 9:00/km easy is VDOT ~24, where Daniels' threshold pace is about 7:34/km.
        const pace = paceSecondsPerKmFromSpeed(plan.sections[1].speedKmh!)
        expect(pace).toBeGreaterThanOrEqual(7 * 60 + 25)
        expect(pace).toBeLessThanOrEqual(7 * 60 + 40)
        expect(plan.sections[1].targetRpe).toBe(7)
        expect(plan.explanation.join(' ')).toContain('9:00/km')
        expect(validateWorkout(plan).ok).toBe(true)
    })

    it('carries an audio cue and RPE on every section', () => {
        for (const item of build().sections) {
            expect(item.audioCue).toBeTruthy()
            expect(item.targetRpe).toBeGreaterThan(0)
        }
    })

    it('alternates rep and easy-jog phases when replayed', () => {
        const plan = build()
        const mix = plan.sections[1].runWalk!
        const warmup = plan.sections[0].target
        const start = (warmup.basis === 'time' ? warmup.durationSeconds : 0) * 1000
        expect(runProgress(plan, [], start + 1000).phase).toBe('run')
        expect(runProgress(plan, [], start + (mix.runSeconds + 1) * 1000).phase).toBe('walk')
        expect(runProgress(plan, [], start + (mix.runSeconds + mix.walkSeconds + 1) * 1000).cycle).toBe(1)
    })

    it('exports a flat step schema with one entry per rep and recovery', () => {
        const plan = build()
        const steps = planToSchema(plan)
        const reps = repsOf(plan)
        expect(steps[0].type).toBe('warmup')
        expect(steps.at(-1)?.type).toBe('cooldown')
        expect(steps.filter(s => s.type === 'run')).toHaveLength(reps)
        expect(steps.filter(s => s.type === 'rest')).toHaveLength(reps)
        expect(steps.every(s => s.duration_seconds > 0 && s.audio_cue.length > 0)).toBe(true)
    })
})
