import { describe, expect, it } from 'vitest'
import { derivePersonalBaseline } from './baseline'
import {
    distanceFromSpeed,
    durationFromDistance,
    formatPacePerKm,
    paceSecondsPerKmFromSpeed,
    speedFromDistanceDuration,
    speedFromPaceSecondsPerKm,
} from './convert'
import {
    calculateSectionMetrics,
    calculateWorkoutTotals,
    generatePersonalizedWorkout,
    setSectionBasis,
    setSectionSpeed,
    validateWorkout,
} from './generate'
import type { PersonalBaseline, PlanSection } from './types'
import type { RunnerLevel, WorkoutId } from '../workouts'

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
        comfortableCapacity: { basis: 'time', durationSeconds: 1800 },
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
        expect(formatPacePerKm(8)).toBe('7:30')
    })

    it('2 km at 8 km/h gives 15 minutes', () => {
        expect(durationFromDistance(2, 8)).toBeCloseTo(900, 10)
    })

    it('5:00/km gives 12 km/h', () => {
        expect(speedFromPaceSecondsPerKm(300)).toBeCloseTo(12, 10)
        expect(formatPacePerKm(12)).toBe('5:00')
    })

    it('derives speed from a distance and its time', () => {
        expect(speedFromDistanceDuration(5, 1800)).toBeCloseTo(10, 10)
    })

    it('returns no pace for an unknown or invalid speed', () => {
        expect(formatPacePerKm(null)).toBeNull()
        expect(formatPacePerKm(0)).toBeNull()
        expect(formatPacePerKm(Number.NaN)).toBeNull()
        expect(formatPacePerKm(Number.POSITIVE_INFINITY)).toBeNull()
    })
})

describe('derivePersonalBaseline', () => {
    it('uses a reported pace', () => {
        const result = derivePersonalBaseline({
            paceKnown: true,
            paceMinutes: 5,
            paceSeconds: 0,
            capacityBasis: 'time',
            capacityMinutes: 30,
            availableMinutes: 45,
        })
        expect(result.speedKmh).toBeCloseTo(12, 10)
        expect(result.speedSource).toBe('reported-pace')
    })

    it('never derives a speed from a distance alone', () => {
        const result = derivePersonalBaseline({
            capacityBasis: 'distance',
            capacityDistanceKm: 5,
            availableMinutes: 45,
        })
        expect(result.speedKmh).toBeNull()
        expect(result.speedSource).toBe('unknown')
    })

    it('derives a speed from a distance plus its time', () => {
        const result = derivePersonalBaseline({
            capacityBasis: 'distance',
            capacityDistanceKm: 5,
            capacityTimeMinutes: 30,
            availableMinutes: 45,
        })
        expect(result.speedKmh).toBeCloseTo(10, 10)
        expect(result.speedSource).toBe('distance-and-time')
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

    it('only changes basis when explicitly asked', () => {
        const switched = setSectionBasis(timeSection, 'distance')
        expect(switched.target).toEqual({ basis: 'distance', distanceKm: 2 })
        expect(setSectionBasis(timeSection, 'time')).toBe(timeSection)
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
            level: 'intermediate',
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

    it('grounds speeds in the runner pace rather than a fixed level speed', () => {
        const slow = generatePersonalizedWorkout({
            category: 'easy',
            level: 'beginner',
            baseline: baseline({ speedKmh: 8 }),
        })
        const fast = generatePersonalizedWorkout({
            category: 'easy',
            level: 'beginner',
            baseline: baseline({ speedKmh: 12 }),
        })
        expect(slow.sections[1].speedKmh).toBeCloseTo(8, 10)
        expect(fast.sections[1].speedKmh).toBeCloseTo(12, 10)
    })

    it('keeps every speed null when the pace is unknown', () => {
        const workout = generatePersonalizedWorkout({
            category: 'easy',
            level: 'advanced',
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
            level: 'intermediate',
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

    it('adapts rather than intensifies when a beginner picks a harder category', () => {
        const workout = generatePersonalizedWorkout({
            category: 'tempo',
            level: 'beginner',
            baseline: baseline(),
        })
        expect(workout.adjustments.join(' ')).toContain('comfortable capacity')
        // Intensity still comes from the runner's own pace, never a level bonus.
        const easy = generatePersonalizedWorkout({
            category: 'tempo',
            level: 'advanced',
            baseline: baseline(),
        })
        expect(workout.sections[1].speedKmh).toBeCloseTo(
            easy.sections[1].speedKmh as number,
            10,
        )
    })

    it('scales main-run volume by level without touching speed', () => {
        const mainOf = (level: RunnerLevel, category: WorkoutId) => {
            const workout = generatePersonalizedWorkout({
                category,
                level,
                baseline: baseline(),
            })
            const target = workout.sections[1].target
            return {
                volume:
                    target.basis === 'time'
                        ? target.durationSeconds
                        : target.distanceKm,
                speedKmh: workout.sections[1].speedKmh,
            }
        }

        for (const category of ['easy', 'tempo', 'long'] as WorkoutId[]) {
            const b = mainOf('beginner', category)
            const i = mainOf('intermediate', category)
            const a = mainOf('advanced', category)

            expect(b.volume).toBeLessThan(i.volume)
            expect(a.volume).toBeGreaterThan(i.volume)

            // Speed is identical across levels -- only volume moves.
            expect(b.speedKmh).toBeCloseTo(i.speedKmh as number, 10)
            expect(a.speedKmh).toBeCloseTo(i.speedKmh as number, 10)
        }
    })

    it('leaves the test run identical for every level', () => {
        const targets = (['beginner', 'intermediate', 'advanced'] as RunnerLevel[]).map(
            (level) =>
                generatePersonalizedWorkout({
                    category: 'test',
                    level,
                    baseline: baseline(),
                }).sections[1].target,
        )
        expect(targets[0]).toEqual(targets[1])
        expect(targets[1]).toEqual(targets[2])
    })
})

describe('validateWorkout', () => {
    it('flags a section with a non-positive target', () => {
        const workout = generatePersonalizedWorkout({
            category: 'easy',
            level: 'intermediate',
            baseline: baseline(),
        })
        workout.sections[0].target = { basis: 'time', durationSeconds: 0 }
        expect(validateWorkout(workout).ok).toBe(false)
    })

    it('flags a workout that overruns the available time', () => {
        const workout = generatePersonalizedWorkout({
            category: 'easy',
            level: 'intermediate',
            baseline: baseline({ availableSeconds: 1800 }),
        })
        workout.sections[1].target = { basis: 'time', durationSeconds: 7200 }
        const result = validateWorkout(workout)
        expect(result.ok).toBe(false)
        expect(result.issues.some((i) => i.message.includes('longer than'))).toBe(true)
    })
})
