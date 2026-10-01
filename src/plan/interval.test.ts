import { describe, expect, it } from 'vitest'
import { derivePersonalBaseline } from './baseline'
import { calculateWorkoutTotals, generatePersonalizedWorkout, planToSchema, validateWorkout } from './generate'
import { paceSecondsPerKmFromSpeed } from './convert'
import { PROPOSED_INTERVAL_SHAPE } from './rules'
import { runProgress } from '../run/engine'
import type { BaselineAnswers } from './types'

const answers = (overrides: Partial<BaselineAnswers> = {}): BaselineAnswers => ({
    weeklyKm: 30, daysPerWeek: 4,
    continuity: 'continuous', paceKnown: true, paceMinutes: 7, paceSeconds: 0,
    availableMinutes: 45, ...overrides,
})

const build = (overrides: Partial<BaselineAnswers> = {}) =>
    generatePersonalizedWorkout({ category: 'interval', baseline: derivePersonalBaseline(answers(overrides)) })

const spec = PROPOSED_INTERVAL_SHAPE
const cycle = spec.repSeconds + spec.recoverySeconds
const repsOf = (plan: ReturnType<typeof build>) => {
    const target = plan.sections[1].target
    return target.basis === 'time' ? target.durationSeconds / cycle : 0
}

describe('interval run', () => {
    it('builds the three-part sandwich with a repeating interval block', () => {
        const plan = build()
        expect(plan.sections.map(s => s.type)).toEqual(['warmup', 'run', 'cooldown'])
        expect(plan.sections[0].runWalk).toBeUndefined()
        expect(plan.sections[2].runWalk).toBeUndefined()
        expect(plan.sections[1].runWalk).toMatchObject({ runSeconds: spec.repSeconds, walkSeconds: spec.recoverySeconds })
        expect(validateWorkout(plan).ok).toBe(true)
    })

    it('recovers for longer than it works, so every rep starts fresh', () => {
        const mix = build().sections[1].runWalk!
        expect(mix.walkSeconds).toBeGreaterThan(mix.runSeconds)
    })

    it('gives a bigger week more reps, within Daniels\' 5% and the session cap', () => {
        expect(repsOf(build({ weeklyKm: 15 }))).toBeLessThan(repsOf(build({ weeklyKm: 30 })))
        expect(repsOf(build({ weeklyKm: 200, availableMinutes: 120 }))).toBe(spec.maxReps)
        // 5% of 30 km is 1.5 km; each 40 s rep at ~5:08/km covers about 130 m.
        const plan = build({ availableMinutes: 120 })
        const repKm = (plan.sections[1].speedKmh! * spec.repSeconds) / 3600
        expect(repsOf(plan) * repKm).toBeLessThanOrEqual(1.5)
    })

    it('runs reps faster than easy pace while recovery stays slower', () => {
        const plan = build()
        const easy = generatePersonalizedWorkout({ category: 'easy', baseline: derivePersonalBaseline(answers()) })
        const repSpeed = plan.sections[1].speedKmh!
        expect(repSpeed).toBeGreaterThan(easy.sections[1].speedKmh!)
        expect(plan.sections[1].runWalk!.walkSpeedKmh!).toBeLessThan(repSpeed)
    })

    it('sets rep pace to Daniels repetition pace for the runner\'s easy pace', () => {
        // 7:00/km easy sits between VDOT 30 and 35, where Daniels' repetition pace is about 5:10/km.
        const pace = paceSecondsPerKmFromSpeed(build().sections[1].speedKmh!)
        expect(pace).toBeGreaterThanOrEqual(5 * 60 + 5)
        expect(pace).toBeLessThanOrEqual(5 * 60 + 15)
    })

    it('keeps the whole sandwich inside the available time', () => {
        for (const minutes of [20, 30, 45, 75]) {
            const plan = build({ availableMinutes: minutes })
            const total = calculateWorkoutTotals(plan.sections).durationSeconds!
            expect(total).toBeLessThanOrEqual(minutes * 60 + 0.01)
            expect(validateWorkout(plan).ok).toBe(true)
        }
    })

    it('trims reps rather than skipping the warm-up when time is short', () => {
        const short = build({ availableMinutes: 20 })
        expect(repsOf(short)).toBeLessThan(repsOf(build()))
        expect(short.sections[0].target).toMatchObject({ basis: 'time' })
        const warmup = short.sections[0].target
        expect(warmup.basis === 'time' && warmup.durationSeconds).toBeGreaterThan(0)
        expect(short.adjustments.length).toBeGreaterThan(0)
    })

    it('never drops below the minimum rep count', () => {
        expect(repsOf(build({ availableMinutes: 5 }))).toBeGreaterThanOrEqual(spec.minReps)
    })

    it('starts a runner who does not know their pace from the beginner default', () => {
        const plan = build({ paceKnown: false })
        expect(plan.sections.every(s => s.speedKmh !== null)).toBe(true)
        // 9:00/km easy is VDOT ~24, where Daniels' repetition pace is about 6:40/km.
        const pace = paceSecondsPerKmFromSpeed(plan.sections[1].speedKmh!)
        expect(pace).toBeGreaterThanOrEqual(6 * 60 + 30)
        expect(pace).toBeLessThanOrEqual(6 * 60 + 50)
        expect(plan.sections[1].targetRpe).toBe(9)
        expect(plan.explanation.join(' ')).toContain('9:00/km')
        expect(validateWorkout(plan).ok).toBe(true)
    })

    it('carries an audio cue and RPE on every section', () => {
        for (const item of build().sections) {
            expect(item.audioCue).toBeTruthy()
            expect(item.targetRpe).toBeGreaterThan(0)
        }
    })

    it('alternates rep and recovery phases when replayed', () => {
        const plan = build()
        const warmup = plan.sections[0].target
        const start = (warmup.basis === 'time' ? warmup.durationSeconds : 0) * 1000
        expect(runProgress(plan, [], start + 1000).phase).toBe('run')
        expect(runProgress(plan, [], start + (spec.repSeconds + 1) * 1000).phase).toBe('walk')
        expect(runProgress(plan, [], start + (cycle + 1) * 1000).cycle).toBe(1)
    })

    it('exports a flat step schema with one entry per rep and recovery', () => {
        const plan = build()
        const steps = planToSchema(plan)
        const reps = repsOf(plan)
        expect(steps[0].type).toBe('warmup')
        expect(steps.at(-1)?.type).toBe('cooldown')
        expect(steps.filter(s => s.type === 'run')).toHaveLength(reps)
        expect(steps.filter(s => s.type === 'rest')).toHaveLength(reps)
        expect(steps.find(s => s.type === 'run')?.audio_cue).toContain('Rep 1 of')
        expect(steps.every(s => s.duration_seconds > 0 && s.audio_cue.length > 0)).toBe(true)
    })
})
