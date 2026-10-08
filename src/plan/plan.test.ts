import { describe, expect, it } from 'vitest'
import {
    distanceFromSpeed,
    durationFromDistance,
    paceSecondsPerKmFromSpeed,
    parsePace,
    roundSpeedUp,
    speedFromPaceSecondsPerKm,
} from './convert'
import {
    calculateSectionMetrics,
    calculateWorkoutTotals,
    setSectionSpeed,
} from './generate'
import type { PlanSection } from './types'

const timeSection: PlanSection = {
    id: 'main',
    type: 'run',
    label: 'Run',
    target: { basis: 'time', durationSeconds: 900 },
    speedKmh: 8,
    effort: 'steady',
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


describe('speed and pace parsing', () => {
    it('rounds speed upward without bumping exact tenths', () => {
        expect(roundSpeedUp(8.21)).toBe(8.3)
        expect(roundSpeedUp(8.2)).toBe(8.2)
        expect(roundSpeedUp(8.200000000000001)).toBe(8.2)
    })

    it('validates pace consistently, including seconds and signs', () => {
        expect(parsePace('5:30')).toBe(330)
        for (const invalid of ['5:90', '-1:30', '1:2', '1.5:00', 'abc', '0:00']) expect(parsePace(invalid)).toBeNull()
    })
})
