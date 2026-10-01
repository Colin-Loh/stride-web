import { describe, expect, it } from 'vitest'
import { derivePersonalBaseline } from './baseline'
import {
    distanceFromSpeed,
    durationFromDistance,
    paceSecondsPerKmFromSpeed,
    speedFromDistanceDuration,
    speedFromPaceSecondsPerKm,
} from './convert'
import {
    calculateSectionMetrics,
    calculateWorkoutTotals,
    generatePersonalizedWorkout,
    setSectionSpeed,
    validateWorkout,
} from './generate'
import type { PersonalBaseline, PlanSection } from './types'

const timeSection: PlanSection = {
    id: 'main',
    type: 'run',
    label: 'Run',
    target: { basis: 'time', durationSeconds: 900 },
    speedKmh: 8,
    effort: 'steady',
}

function baseline(overrides: Partial<PersonalBaseline> = {}): PersonalBaseline {
    return {
        speedKmh: 10,
        speedSource: 'reported-pace',
        weeklyKm: 30,
        daysPerWeek: 3,
        continuity: 'continuous',
        walkSpeedKmh: null,
        availableSeconds: 3600,
        missing: [],
        ...overrides,
    }
}

describe('conversions', () => {
    it('8 km/h for 15 minutes gives 2 km and 7:30/km', () => {
        expect(distanceFromSpeed(8, 900)).toBeCloseTo(2, 10)
        expect(paceSecondsPerKmFromSpeed(8)).toBe(450)
    })

    it('2 km at 8 km/h gives 15 minutes', () => {
        expect(durationFromDistance(2, 8)).toBeCloseTo(900, 10)
    })

    it('5:00/km gives 12 km/h', () => {
        expect(speedFromPaceSecondsPerKm(300)).toBeCloseTo(12, 10)
    })

    it('derives speed from a distance and its time', () => {
        expect(speedFromDistanceDuration(5, 1800)).toBeCloseTo(10, 10)
    })


})

describe('derivePersonalBaseline', () => {
    it('uses a reported pace', () => {
        const result = derivePersonalBaseline({
            paceKnown: true,
            paceMinutes: 5,
            paceSeconds: 0,
            weeklyKm: 30,
            availableMinutes: 45,
        })
        expect(result.speedKmh).toBeCloseTo(12, 10)
        expect(result.speedSource).toBe('reported-pace')
    })

    it('starts at a gentle 9:00/km when the runner does not know their pace', () => {
        const result = derivePersonalBaseline({ raceKnown: false, paceKnown: false, weeklyKm: 15 })
        expect(paceSecondsPerKmFromSpeed(result.speedKmh!)).toBe(9 * 60)
        expect(result.speedSource).toBe('default')
        expect(result.vdot).toBeGreaterThan(20)
    })

    it('treats the time available as optional', () => {
        const result = derivePersonalBaseline({ raceKnown: false, paceKnown: false, weeklyKm: 15, daysPerWeek: 3, continuity: 'continuous' })
        expect(result.availableSeconds).toBeNull()
        expect(result.missing).toEqual([])
    })

    it('rejects pace seconds outside 00-59', () => {
        const result = derivePersonalBaseline({
            paceKnown: true,
            paceMinutes: 5,
            paceSeconds: 90,
        })
        expect(result.speedKmh).toBeNull()
    })
})

describe('section metrics', () => {
    it('derives distance for a time-based section', () => {
        const metrics = calculateSectionMetrics(timeSection)
        expect(metrics.durationSeconds).toBe(900)
        expect(metrics.distanceKm).toBeCloseTo(2, 10)
        expect(metrics.distanceEstimated).toBe(true)
        expect(metrics.paceSecondsPerKm).toBe(450)
    })

    it('derives duration for a distance-based section', () => {
        const metrics = calculateSectionMetrics({
            ...timeSection,
            target: { basis: 'distance', distanceKm: 2 },
        })
        expect(metrics.distanceKm).toBe(2)
        expect(metrics.durationSeconds).toBeCloseTo(900, 10)
        expect(metrics.durationEstimated).toBe(true)
    })

    it('never invents a distance or pace when the speed is unknown', () => {
        const metrics = calculateSectionMetrics({ ...timeSection, speedKmh: null })
        expect(metrics.durationSeconds).toBe(900)
        expect(metrics.distanceKm).toBeNull()
        expect(metrics.paceSecondsPerKm).toBeNull()
    })

    it('treats a non-finite speed as unknown', () => {
        expect(
            calculateSectionMetrics({ ...timeSection, speedKmh: Number.NaN }).distanceKm,
        ).toBeNull()
        expect(
            calculateSectionMetrics({ ...timeSection, speedKmh: 0 }).distanceKm,
        ).toBeNull()
    })
})

describe('editing preserves the target basis', () => {
    it('keeps duration and recalculates distance for a time section', () => {
        const edited = setSectionSpeed(timeSection, 12)
        expect(edited.target).toEqual({ basis: 'time', durationSeconds: 900 })
        const metrics = calculateSectionMetrics(edited)
        expect(metrics.distanceKm).toBeCloseTo(3, 10)
    })

    it('keeps distance and recalculates duration for a distance section', () => {
        const distanceSection: PlanSection = {
            ...timeSection,
            target: { basis: 'distance', distanceKm: 2 },
        }
        const edited = setSectionSpeed(distanceSection, 12)
        expect(edited.target).toEqual({ basis: 'distance', distanceKm: 2 })
        expect(calculateSectionMetrics(edited).durationSeconds).toBeCloseTo(600, 10)
    })


})

describe('totals', () => {
    const sections: PlanSection[] = [
        { ...timeSection, id: 'w', target: { basis: 'time', durationSeconds: 600 }, speedKmh: 6 },
        { ...timeSection, id: 'm', target: { basis: 'time', durationSeconds: 1800 }, speedKmh: 12 },
    ]

    it('adds durations and distances', () => {
        const totals = calculateWorkoutTotals(sections)
        expect(totals.durationSeconds).toBe(2400)
        expect(totals.distanceKm).toBeCloseTo(1 + 6, 10)
        expect(totals.distanceComplete).toBe(true)
    })

    it('takes overall pace from the totals, not an average of paces', () => {
        const totals = calculateWorkoutTotals(sections)
        // 7 km in 2400 s -> 10.5 km/h, 342.857 s/km. The mean of 600 and 300 is 450.
        expect(totals.averageSpeedKmh).toBeCloseTo(10.5, 10)
        expect(totals.paceSecondsPerKm).toBe(343)
    })

    it('marks distance incomplete instead of counting an unknown as zero', () => {
        const totals = calculateWorkoutTotals([
            sections[0],
            { ...sections[1], speedKmh: null },
        ])
        expect(totals.distanceComplete).toBe(false)
        expect(totals.distanceKm).toBeNull()
        expect(totals.paceSecondsPerKm).toBeNull()
        expect(totals.durationSeconds).toBe(2400)
    })
})

describe('generatePersonalizedWorkout', () => {
    it('produces warm-up, main and cool-down that fit the available time', () => {
        const workout = generatePersonalizedWorkout({
            category: 'easy',
            baseline: baseline(),
        })
        expect(workout.sections.map((s) => s.type)).toEqual([
            'warmup',
            'run',
            'cooldown',
        ])
        const totals = calculateWorkoutTotals(workout.sections)
        expect(totals.durationSeconds).toBeLessThanOrEqual(3600)
        expect(validateWorkout(workout).ok).toBe(true)
    })

    it('grounds speeds in the runner pace rather than a fixed speed', () => {
        const slow = generatePersonalizedWorkout({
            category: 'easy',
            baseline: baseline({ speedKmh: 8 }),
        })
        const fast = generatePersonalizedWorkout({
            category: 'easy',
            baseline: baseline({ speedKmh: 12 }),
        })
        expect(slow.sections[1].speedKmh).toBeCloseTo(8, 10)
        expect(fast.sections[1].speedKmh).toBeCloseTo(12, 10)
    })

    it('keeps every speed null when the pace is unknown', () => {
        const workout = generatePersonalizedWorkout({
            category: 'easy',
            baseline: baseline({ speedKmh: null, speedSource: 'unknown' }),
        })
        expect(workout.sections.every((s) => s.speedKmh === null)).toBe(true)
        const totals = calculateWorkoutTotals(workout.sections)
        expect(totals.distanceKm).toBeNull()
        expect(totals.durationSeconds).toBeGreaterThan(0)
    })

    it('shrinks sections rather than producing zero or negative targets', () => {
        const workout = generatePersonalizedWorkout({
            category: 'easy',
            baseline: baseline({ availableSeconds: 300 }),
        })
        for (const item of workout.sections) {
            const value =
                item.target.basis === 'time'
                    ? item.target.durationSeconds
                    : item.target.distanceKm
            expect(value).toBeGreaterThan(0)
        }
        expect(workout.adjustments.length).toBeGreaterThan(0)
    })

    it('sizes the tempo block from the week', () => {
        const workout = generatePersonalizedWorkout({ category: 'tempo', baseline: baseline() })
        // 10% of a 30 km week at threshold pace.
        const target = workout.sections[1].target
        const threshold = workout.sections[1].speedKmh!
        expect(target.basis === 'time' && target.durationSeconds).toBeCloseTo((3 / threshold) * 3600, -1)
    })

    it('splits the week across running days without touching speed', () => {
        const easyFor = (daysPerWeek: number) => {
            const workout = generatePersonalizedWorkout({ category: 'easy', baseline: baseline({ availableSeconds: null, daysPerWeek }) })
            const target = workout.sections[1].target
            return { km: target.basis === 'distance' ? target.distanceKm : 0, speedKmh: workout.sections[1].speedKmh }
        }
        // 30 km over 5 days is 6 km; over 6 days, 5 km. Two days would be 15 km, so the 30% long-run cap (9 km) applies.
        expect(easyFor(5).km).toBe(6)
        expect(easyFor(6).km).toBe(5)
        expect(easyFor(2).km).toBe(9)
        expect(easyFor(2).speedKmh).toBe(easyFor(6).speedKmh)
    })
})

describe('validateWorkout', () => {
    it('flags a section with a non-positive target', () => {
        const workout = generatePersonalizedWorkout({
            category: 'easy',
            baseline: baseline(),
        })
        workout.sections[0].target = { basis: 'time', durationSeconds: 0 }
        expect(validateWorkout(workout).ok).toBe(false)
    })

    it('flags a workout that overruns the available time', () => {
        const workout = generatePersonalizedWorkout({
            category: 'easy',
            baseline: baseline({ availableSeconds: 1800 }),
        })
        workout.sections[1].target = { basis: 'time', durationSeconds: 7200 }
        const result = validateWorkout(workout)
        expect(result.ok).toBe(false)
        expect(result.issues.some((i) => i.message.includes('longer than'))).toBe(true)
    })
})

describe('behaviour regressions', () => {
    it('makes Test run exactly 90 seconds regardless of the week or available time', () => {
        const plan = generatePersonalizedWorkout({ category: 'test', baseline: baseline({ availableSeconds: 60 }) })
        expect(plan.sections.map(s => s.target)).toEqual(Array(3).fill({ basis: 'time', durationSeconds: 30 }))
        expect(calculateWorkoutTotals(plan.sections).durationSeconds).toBe(90)
        expect(validateWorkout(plan).ok).toBe(true)
    })
    it('creates timed, runnable sections when pace is unknown', () => {
        const plan = generatePersonalizedWorkout({ category: 'easy', baseline: baseline({
            speedKmh: null, weeklyKm: 15,
        }) })
        expect(plan.sections.every(s => s.target.basis === 'time')).toBe(true)
        expect(validateWorkout(plan).ok).toBe(true)
        expect(calculateWorkoutTotals(plan.sections).distanceKm).toBeNull()
    })
    it('creates editable run/walk intervals and includes walking in the time budget', () => {
        const plan = generatePersonalizedWorkout({ category: 'easy', baseline: baseline({
            continuity: 'run-walk', walkSpeedKmh: 5, weeklyKm: 15, availableSeconds: 1800,
        }) })
        expect(plan.sections[1].runWalk).toEqual({ runSeconds: 120, walkSeconds: 60, walkSpeedKmh: 5 })
        expect(calculateWorkoutTotals(plan.sections).durationSeconds).toBeLessThanOrEqual(1800)
        expect(validateWorkout(plan).ok).toBe(true)
    })
    it('does not invent distance for unknown walking speed', () => {
        const plan = generatePersonalizedWorkout({ category: 'easy', baseline: baseline({
            continuity: 'run-walk', walkSpeedKmh: null, weeklyKm: 15,
        }) })
        expect(plan.sections[1].target.basis).toBe('time')
        expect(calculateWorkoutTotals(plan.sections).distanceKm).toBeNull()
        expect(validateWorkout(plan).ok).toBe(true)
    })
    it('rounds generated speeds upward to one decimal before computing metrics', () => {
        const plan = generatePersonalizedWorkout({ category: 'easy', baseline: baseline({ speedKmh: 8.21 }) })
        expect(plan.sections[1].speedKmh).toBe(8.3)
        for (const s of plan.sections) expect(s.speedKmh! * 10).toBeCloseTo(Math.round(s.speedKmh! * 10))
    })
    it('fits short sessions inside the reported time', () => {
        const plan = generatePersonalizedWorkout({ category: 'easy', baseline: baseline({ availableSeconds: 300 }) })
        expect(calculateWorkoutTotals(plan.sections).durationSeconds).toBe(300)
        expect(validateWorkout(plan).ok).toBe(true)
    })
    it('rejects out-of-range speeds and invalid intervals without crashing', () => {
        const plan = generatePersonalizedWorkout({ category: 'test', baseline: baseline() })
        plan.sections[1].speedKmh = 30
        plan.sections[1].runWalk = { runSeconds: 0, walkSeconds: 0, walkSpeedKmh: 5 }
        expect(validateWorkout(plan).ok).toBe(false)
    })
})
