import { describe, expect, it } from 'vitest'
import { derivePersonalBaseline, missingBaselineFields } from './baseline'
import { formatDuration, paceSecondsPerKmFromSpeed, parseDuration } from './convert'
import { danielsSpeeds, predictRaceSeconds, vdotFromEasySpeed, vdotFromRace } from './vdot'
import type { BaselineAnswers } from './types'

/**
 * Daniels' published table, seconds per km: fast and slow ends of Easy, Threshold,
 * Repetition. From https://sport-calculator.com/blog/jack-daniels-running-table,
 * cross-checked against https://www.brenoamelo.com/blog/vdot-pace-chart-printable.
 */
const PUBLISHED = [
    { vdot: 30, easy: [459, 503], threshold: 384, repetition: 342 },
    { vdot: 35, easy: [407, 448], threshold: 340, repetition: 299 },
    { vdot: 40, easy: [367, 404], threshold: 306, repetition: 265 },
    { vdot: 45, easy: [334, 368], threshold: 278, repetition: 239 },
    { vdot: 50, easy: [307, 338], threshold: 255, repetition: 217 },
    { vdot: 55, easy: [284, 313], threshold: 236, repetition: 200 },
    { vdot: 60, easy: [265, 292], threshold: 220, repetition: 185 },
]

const pace = (kmh: number) => paceSecondsPerKmFromSpeed(kmh)

describe('Daniels-Gilbert equations', () => {
    it('reproduce the published VDOT table to within a second per km', () => {
        for (const row of PUBLISHED) {
            const zones = danielsSpeeds(row.vdot)
            expect(Math.abs(pace(zones.easyFastKmh) - row.easy[0])).toBeLessThanOrEqual(1)
            expect(Math.abs(pace(zones.easySlowKmh) - row.easy[1])).toBeLessThanOrEqual(1)
            expect(Math.abs(pace(zones.thresholdKmh) - row.threshold)).toBeLessThanOrEqual(1)
            expect(Math.abs(pace(zones.repetitionKmh) - row.repetition)).toBeLessThanOrEqual(1)
        }
    })

    it('turn a race into the published VDOT', () => {
        expect(vdotFromRace(5, 19 * 60 + 57)).toBeCloseTo(50, 0)
        expect(vdotFromRace(5, 30 * 60 + 40)).toBeCloseTo(30, 0)
    })

    it('predict the same race back from its VDOT', () => {
        const vdot = vdotFromRace(10, 50 * 60)
        expect(predictRaceSeconds(vdot, 10)).toBeCloseTo(50 * 60, 0)
    })

    it('read an easy pace as the fast end of the easy range', () => {
        // 7:39/km is the fast end of VDOT 30's easy range.
        expect(vdotFromEasySpeed(3600 / 459)).toBeCloseTo(30, 0)
    })
})

const answers = (overrides: Partial<BaselineAnswers> = {}): BaselineAnswers => ({
    raceKnown: false, weeklyKm: 30, daysPerWeek: 4,
    continuity: 'continuous', paceKnown: true, paceMinutes: 7, paceSeconds: 0,
    availableMinutes: 60, ...overrides,
})

describe('baseline from a race', () => {
    it('takes VDOT from the race and drops the comfortable-pace question', () => {
        const race = { raceKnown: true, raceDistanceKm: 5, raceSeconds: 25 * 60, paceKnown: undefined }
        expect(missingBaselineFields(answers(race))).not.toContain('pace')
        const baseline = derivePersonalBaseline(answers(race))
        expect(baseline.vdotSource).toBe('race')
        expect(baseline.vdot).toBeCloseTo(vdotFromRace(5, 25 * 60), 6)
        // No reported pace: easy running sits in the middle of Daniels' easy range.
        const zones = danielsSpeeds(baseline.vdot!)
        expect(baseline.speedKmh!).toBeGreaterThan(zones.easySlowKmh)
        expect(baseline.speedKmh!).toBeLessThan(zones.easyFastKmh)
    })

    it('keeps a reported easy pace inside the range and moves one outside it', () => {
        const race = { raceKnown: true, raceDistanceKm: 5, raceSeconds: 25 * 60 }
        // A 25:00 5K is VDOT ~38.3: easy roughly 6:20-6:58/km.
        const inside = derivePersonalBaseline(answers({ ...race, paceMinutes: 6, paceSeconds: 40 }))
        expect(inside.speedSource).toBe('reported-pace')
        const tooFast = derivePersonalBaseline(answers({ ...race, paceMinutes: 5, paceSeconds: 30 }))
        expect(tooFast.speedSource).toBe('race')
        expect(tooFast.speedKmh).toBeCloseTo(danielsSpeeds(tooFast.vdot!).easyFastKmh, 6)
    })

    it('rejects a race that does not add up', () => {
        const typo = answers({ raceKnown: true, raceDistanceKm: 5, raceSeconds: 5 * 60 })
        expect(missingBaselineFields(typo)).toContain('race')
        expect(derivePersonalBaseline(typo).vdot).toBe(derivePersonalBaseline(answers()).vdot)
    })

    it('falls back to the comfortable pace without a race', () => {
        const baseline = derivePersonalBaseline(answers())
        expect(baseline.vdotSource).toBe('easy-pace')
        expect(baseline.speedSource).toBe('reported-pace')
    })

    it('asks the new questions of runners who answered before they existed', () => {
        const old = answers({ raceKnown: undefined, weeklyKm: undefined, daysPerWeek: undefined })
        expect(missingBaselineFields(old)).toEqual(['race', 'weekly', 'days'])
    })
})

describe('race time input', () => {
    it('parses m:ss and h:mm:ss and formats them back', () => {
        expect(parseDuration('27:30')).toBe(27 * 60 + 30)
        expect(parseDuration('1:58:00')).toBe(118 * 60)
        for (const invalid of ['1:60', '1:5', 'abc', '0:00', '1:2:3']) expect(parseDuration(invalid)).toBeNull()
        expect(formatDuration(118 * 60)).toBe('1:58:00')
        expect(formatDuration(27 * 60 + 30)).toBe('27:30')
    })
})
