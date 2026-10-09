import { describe, expect, it } from 'vitest'
import { derivePersonalBaseline } from './baseline'
import { roundSpeedUp } from './convert'
import { repetitionSession, sessionCapKm, trainingSpeedsKmh, vdotFromRace } from './daniels'
import { generatePersonalizedWorkout } from './generate'
import { calculateSectionMetrics, calculateWorkoutTotals } from './metrics'
import type { AnswerValues } from './questions'
import { runnablePlan } from './runnable'
import { planToSchema } from './schema'
import { validateWorkout } from './validation'
import { WORKOUTS, type WorkoutId } from '../workouts'

const TODAY = new Date(2026, 9, 8)
const VDOT = vdotFromRace(5, 1500)!
const SPEEDS = trainingSpeedsKmh(VDOT)!

const answers = (overrides: AnswerValues = {}): AnswerValues => ({
    fitness_method: 'recent_race', recent_race_distance: 5, recent_race_time: 1500,
    training_focus: '10k', weekly_volume: 40, running_days: 4, training_effort: 'advanced_quality', ...overrides,
})
const build = (category: WorkoutId, overrides: AnswerValues = {}, distanceKm?: number) =>
    generatePersonalizedWorkout({ category, baseline: derivePersonalBaseline(answers(overrides)), today: TODAY, distanceKm })
const main = (category: WorkoutId, overrides: AnswerValues = {}, distanceKm?: number) =>
    build(category, overrides, distanceKm).sections.find((s) => s.id === 'main')!

describe('derivePersonalBaseline', () => {
    it('computes VDOT from a recent race', () => {
        const baseline = derivePersonalBaseline(answers())
        expect(baseline.vdot).toBeCloseTo(VDOT, 10)
        expect(baseline.fitnessMethod).toBe('recent_race')
        expect(baseline.race).toEqual({ distanceKm: 5, seconds: 1500 })
        expect(baseline.weeklyKm).toBe(40)
        expect(baseline.daysPerWeek).toBe(4)
    })

    it('computes VDOT from an estimated race', () => {
        const baseline = derivePersonalBaseline(answers({ fitness_method: 'estimated_race', estimated_distance_time: { distanceKm: 10, seconds: 3000 } }))
        expect(baseline.vdot).toBeCloseTo(vdotFromRace(10, 3000)!, 10)
        expect(baseline.fitnessMethod).toBe('estimated_race')
    })

    it('reads only the chosen branch and ignores answers left over from another', () => {
        const baseline = derivePersonalBaseline(answers({ fitness_method: 'estimated_race', recent_race_time: 1 }))
        expect(baseline.vdot).toBeNull()
        expect(derivePersonalBaseline(answers({ fitness_method: 'easy_pace' })).vdot).toBeNull()
    })

    it('keeps an easy pace as a speed and does not invent a VDOT', () => {
        const baseline = derivePersonalBaseline(answers({ fitness_method: 'easy_pace', conversational_easy_pace: 420 }))
        expect(baseline.vdot).toBeNull()
        expect(baseline.reportedEasySpeedKmh).toBeCloseTo(3600 / 420, 10)
    })

    it('knows nothing from empty answers', () => {
        expect(derivePersonalBaseline({})).toEqual({
            vdot: null, fitnessMethod: null, race: null, reportedEasySpeedKmh: null, weeklyKm: null, daysPerWeek: null,
            trainingEffort: null, trainingFocus: null, goalRaceDate: null,
        })
    })
})

describe('generated sessions', () => {
    it('runs E running at the Daniels easy speed, rounded up, over the distance the week gives it', () => {
        const run = main('filler', {}, 7.25)
        expect(run.speedKmh).toBe(roundSpeedUp(SPEEDS.E))
        expect(run.target).toEqual({ basis: 'distance', distanceKm: 7.2 })
        expect(validateWorkout(build('filler', {}, 7.25)).ok).toBe(true)
    })

    it('offers only training sessions, without a test run', () => {
        expect(WORKOUTS.map((workout) => workout.id)).toEqual(['threshold', 'interval', 'repetition', 'long'])
        expect(WORKOUTS.map((workout) => workout.name).join(' ')).not.toMatch(/test run/i)
    })

    it('has no easy, tempo or cruise workout any more', () => {
        expect(WORKOUTS.map((workout) => workout.name).join(' ')).not.toMatch(/easy|tempo|cruise/i)
    })

    it('caps the long run at a share of the week, and at 150 minutes for a big week', () => {
        expect(main('long').target).toEqual({ basis: 'distance', distanceKm: 10 })
        const big = build('long', { weekly_volume: 300 })
        expect(big.sections[0].speedKmh).toBe(roundSpeedUp(SPEEDS.E))
        expect(calculateWorkoutTotals(big.sections).durationSeconds!).toBeLessThanOrEqual(150 * 60)
        expect(validateWorkout(big).ok).toBe(true)
    })

    it('flags an edited long run over 150 minutes', () => {
        const plan = build('long')
        plan.sections[0].target = { basis: 'time', durationSeconds: 151 * 60 }
        expect(validateWorkout(plan).ok).toBe(false)
    })

    it('sizes a threshold run at 20 minutes of T pace for a normal week, between easy warm-up and cool-down', () => {
        const plan = build('threshold', { weekly_volume: 60 })
        expect(plan.categoryName).toBe('Threshold run')
        expect(plan.sections.map((s) => s.type)).toEqual(['warmup', 'run', 'cooldown'])
        expect(plan.sections[1].target).toEqual({ basis: 'time', durationSeconds: 20 * 60 })
        expect(plan.sections[1].speedKmh).toBe(roundSpeedUp(SPEEDS.T))
        expect(plan.sections[1].runWalk).toBeUndefined()
        expect(plan.sections[0].speedKmh).toBe(roundSpeedUp(SPEEDS.E))
        expect(plan.sections[2].speedKmh).toBe(roundSpeedUp(SPEEDS.E))
    })

    it('shortens a threshold block to 10% of a small week without flagging it', () => {
        const plan = build('threshold', { weekly_volume: 20 })
        const km = calculateSectionMetrics(plan.sections[1]).distanceKm!
        expect(km).toBeLessThanOrEqual(2 + 0.01)
        expect(validateWorkout(plan).ok).toBe(true)
    })

    it('builds interval reps of three minutes at interval pace, capped by the session allowance', () => {
        const plan = build('interval')
        const reps = plan.sections[1]
        expect(reps.runWalk).toMatchObject({ runSeconds: 180, walkSeconds: 180 })
        expect(reps.speedKmh).toBe(roundSpeedUp(SPEEDS.I))
        const count = (reps.target as { durationSeconds: number }).durationSeconds / 360
        const repKm = (roundSpeedUp(SPEEDS.I) * 180) / 3600
        expect(count).toBe(Math.floor(sessionCapKm('I', 40) / repKm))
        expect(validateWorkout(plan).ok).toBe(true)
    })

    it('builds repetition reps of at most two minutes at R pace with recovery twice the work', () => {
        const plan = build('repetition')
        const reps = plan.sections[1]
        const speed = roundSpeedUp(SPEEDS.R)
        const expected = repetitionSession(40, speed)
        expect(plan.categoryName).toBe('Repetition run')
        expect(reps.speedKmh).toBe(speed)
        expect(reps.runWalk).toMatchObject({ runSeconds: expected.repSeconds, walkSeconds: 2 * expected.repSeconds, walkSpeedKmh: roundSpeedUp(SPEEDS.E) })
        expect(expected.repSeconds).toBeLessThanOrEqual(120)
        expect(reps.target).toEqual({ basis: 'time', durationSeconds: expected.reps * 3 * expected.repSeconds })
        expect(validateWorkout(plan).ok).toBe(true)
    })

    it('keeps repetition running inside the lesser of 5% of the week and five miles', () => {
        for (const weekly of [10, 40, 150, 400]) {
            const plan = build('repetition', { weekly_volume: weekly })
            const reps = plan.sections[1]
            const mix = reps.runWalk!
            const count = (reps.target as { durationSeconds: number }).durationSeconds / (mix.runSeconds + mix.walkSeconds)
            expect(count * (reps.speedKmh! * mix.runSeconds) / 3600).toBeLessThanOrEqual(sessionCapKm('R', weekly) + 1e-9)
            expect(validateWorkout(plan).ok).toBe(true)
        }
    })

    it('rejects an edited repetition block that exceeds the allowance', () => {
        const plan = build('repetition')
        const mix = plan.sections[1].runWalk!
        plan.sections[1].target = { basis: 'time', durationSeconds: 40 * (mix.runSeconds + mix.walkSeconds) }
        expect(validateWorkout(plan).ok).toBe(false)
    })

    it('blocks interval running when even one rep exceeds a tiny week, and allows a bigger one', () => {
        const small = build('interval', { weekly_volume: 1 })
        expect(validateWorkout(small).issues.some((i) => i.message.includes('allowance'))).toBe(true)
        expect(runnablePlan(small)).toBeNull()
        expect(validateWorkout(build('interval', { weekly_volume: 80 })).ok).toBe(true)
    })

    it('rejects an edited interval block that exceeds the allowance, including a partial rep', () => {
        const plan = build('interval')
        const mix = plan.sections[1].runWalk!
        plan.sections[1].target = { basis: 'time', durationSeconds: 20 * (mix.runSeconds + mix.walkSeconds) + 30 }
        expect(validateWorkout(plan).ok).toBe(false)
    })

    it('exports one step per rep and recovery', () => {
        const steps = planToSchema(build('interval', { weekly_volume: 60 }))
        const reps = steps.filter((s) => s.type === 'run').length
        expect(reps).toBeGreaterThan(1)
        expect(steps.filter((s) => s.type === 'rest')).toHaveLength(reps)
    })
})

describe('without a VDOT', () => {
    const easyPace = { fitness_method: 'easy_pace', conversational_easy_pace: 420 } as const

    it('runs easy at the reported pace and says why speed sessions have none', () => {
        const plan = build('long', easyPace)
        expect(plan.sections[0].speedKmh).toBe(roundSpeedUp(3600 / 420))
        expect(plan.explanation.join(' ')).toContain('No VDOT can be worked out')
    })

    it('gives speed sessions effort targets instead of paces, and they stay runnable', () => {
        for (const category of ['threshold', 'interval', 'repetition'] as const) {
            const plan = build(category, easyPace)
            expect(plan.sections[1].speedKmh).toBeNull()
            expect(plan.sections[1].targetRpe).toBeGreaterThan(0)
            expect(runnablePlan(plan)).not.toBeNull()
        }
    })

    it('times the long run when nothing is known yet', () => {
        const plan = generatePersonalizedWorkout({ category: 'long', baseline: derivePersonalBaseline({}) })
        expect(plan.sections[0].target).toEqual({ basis: 'time', durationSeconds: 45 * 60 })
        expect(plan.sections[0].speedKmh).toBeNull()
    })
})

describe('explanations', () => {
    it('shows the race, VDOT and all five Daniels paces', () => {
        const text = build('long').explanation.join(' ')
        expect(text).toContain('Your 5 km in 25:00 gives a VDOT of 38.3')
        for (const zone of ['easy', 'marathon', 'threshold', 'interval', 'repetition']) expect(text).toContain(zone)
    })

    it('marks an estimate as provisional', () => {
        const plan = build('long', { fitness_method: 'estimated_race', estimated_distance_time: { distanceKm: 5, seconds: 1500 } })
        expect(plan.explanation.join(' ')).toContain('provisional')
    })

    it('treats a speed session as optional when the effort is Base', () => {
        expect(build('threshold', { training_effort: 'base' }).adjustments.join(' ')).toContain('optional')
        expect(build('long', { training_effort: 'base' }).adjustments.join(' ')).not.toContain('optional')
        expect(build('threshold').adjustments.join(' ')).not.toContain('optional')
    })

    it('places the goal race in the ideal season', () => {
        const text = build('long', { goal_race_date: '2026-12-17' }).explanation.join(' ')
        expect(text).toContain('Transition Quality')
        expect(build('long', { goal_race_date: '2028-01-28' }).explanation.join(' ')).not.toContain('phase')
    })
})
