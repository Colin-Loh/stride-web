import { describe, expect, it } from 'vitest'
import {
    isExtrapolatedVdot, LONG_RUN_MAX_SECONDS, longRunCapKm, oxygenCost, predictRaceSeconds, qualitySessionsPerWeek,
    RACE_DISTANCES, seasonPhase, sessionCapKm, sustainableFraction, thresholdSessionSeconds, trainingSpeedsKmh,
    vdotFromRace, ZONES, type Zone,
} from './daniels'

const secondsPerKm = (speedKmh: number) => 3600 / speedKmh
const mmss = (minutes: number, seconds: number) => minutes * 60 + seconds
const MILE = 1.609344

describe('equations', () => {
    it('computes oxygen cost and the sustainable fraction from the published constants', () => {
        expect(oxygenCost(300)).toBeCloseTo(-4.6 + 0.182258 * 300 + 0.000104 * 300 ** 2, 10)
        expect(sustainableFraction(0)).toBeCloseTo(0.8 + 0.1894393 + 0.2989558, 10)
        // The fraction is a 0-1 value that falls towards 0.8 as the race gets longer.
        expect(sustainableFraction(600)).toBeCloseTo(0.8, 3)
    })

    it.each([
        [5, mmss(20, 0), 49.8062],
        [5, mmss(30, 41), 29.9976],
        [5, mmss(25, 0), 38.3094],
    ])('matches the spec smoke test: %s km in %s s', (km, seconds, expected) => {
        expect(vdotFromRace(km, seconds)).toBeCloseTo(expected, 3)
    })

    it('rejects non-positive and non-finite inputs', () => {
        for (const [km, seconds] of [[0, 600], [5, 0], [-5, 600], [5, Number.NaN], [Infinity, 600]]) {
            expect(vdotFromRace(km, seconds)).toBeNull()
        }
        // Slower than a walk: the oxygen cost is negative, so there is no VDOT.
        expect(vdotFromRace(1, 24 * 3600)).toBeNull()
        expect(predictRaceSeconds(0, 5)).toBeNull()
        expect(predictRaceSeconds(50, 0)).toBeNull()
        expect(trainingSpeedsKmh(0)).toBeNull()
    })

    it('gives a higher VDOT for a faster time over the same distance', () => {
        let previous = Infinity
        for (let seconds = 900; seconds <= 3600; seconds += 60) {
            const vdot = vdotFromRace(5, seconds)!
            expect(vdot).toBeLessThan(previous)
            previous = vdot
        }
    })
})

describe('race-time prediction', () => {
    it.each(RACE_DISTANCES.map((race) => race.km))('inverts vdotFromRace over %s km', (km) => {
        for (const vdot of [30, 40, 50, 60, 70, 85]) {
            const seconds = predictRaceSeconds(vdot, km)!
            expect(vdotFromRace(km, seconds)).toBeCloseTo(vdot, 6)
        }
    })

    it('predicts a 20:00 5 km for the VDOT that 20:00 produced', () => {
        expect(predictRaceSeconds(vdotFromRace(5, 1200)!, 5)).toBeCloseTo(1200, 3)
    })

    it('predicts longer distances as slower in pace', () => {
        const pace = (km: number) => predictRaceSeconds(50, km)! / km
        expect(pace(5)).toBeLessThan(pace(10))
        expect(pace(10)).toBeLessThan(pace(42.195))
    })

    it('refuses answers outside the solver window instead of extrapolating', () => {
        expect(predictRaceSeconds(1, 5)).toBeNull()
        expect(predictRaceSeconds(1000, 5)).toBeNull()
    })
})

/**
 * Anchor rows from the spec [6], in seconds per km. The source is a secondary computed table, not
 * the printed book, so the tolerance is a few seconds. R is a mile-race pace, which the spec only
 * calls "approximate", so it gets a looser percentage.
 */
const ANCHORS: [number, Record<Zone, number>][] = [
    [30, { E: mmss(7, 39), M: mmss(6, 52), T: mmss(6, 24), I: mmss(5, 56), R: mmss(5, 34) }],
    [40, { E: mmss(6, 7), M: mmss(5, 27), T: mmss(5, 6), I: mmss(4, 43), R: mmss(4, 25) }],
    [50, { E: mmss(5, 7), M: mmss(4, 31), T: mmss(4, 15), I: mmss(3, 56), R: mmss(3, 41) }],
    [60, { E: mmss(4, 25), M: mmss(3, 52), T: mmss(3, 40), I: mmss(3, 23), R: mmss(3, 11) }],
]

describe('training paces against the anchor rows', () => {
    describe.each(ANCHORS)('VDOT %s', (vdot, expected) => {
        const speeds = trainingSpeedsKmh(vdot)!
        it.each(['E', 'M', 'T', 'I'] as const)('%s pace is within 2 s/km', (zone) => {
            expect(Math.abs(secondsPerKm(speeds[zone]) - expected[zone])).toBeLessThanOrEqual(2)
        })
        it('R pace is within 4% of the equivalent sustained pace', () => {
            expect(Math.abs(secondsPerKm(speeds.R) / expected.R - 1)).toBeLessThan(0.04)
        })
    })

    it('orders the zones from easiest to fastest', () => {
        const speeds = trainingSpeedsKmh(50)!
        expect(speeds.E).toBeLessThan(speeds.M)
        expect(speeds.M).toBeLessThan(speeds.T)
        expect(speeds.T).toBeLessThan(speeds.I)
        expect(speeds.I).toBeLessThan(speeds.R)
    })

    it('keeps fractions of VDOT inside the official VO2max ranges', () => {
        for (const zone of ['E', 'T', 'I'] as const) {
            const pace = ZONES[zone].pace
            const range = ZONES[zone].vo2MaxPercent!
            if (pace.kind !== 'vdot-fraction') throw new Error('expected a fraction')
            expect(pace.fraction * 100).toBeGreaterThanOrEqual(range[0])
            expect(pace.fraction * 100).toBeLessThanOrEqual(range[1])
        }
    })

    it('makes M the equivalent marathon pace and R the equivalent mile pace', () => {
        const speeds = trainingSpeedsKmh(48)!
        expect(speeds.M).toBeCloseTo(42.195 / predictRaceSeconds(48, 42.195)! * 3600, 8)
        expect(speeds.R).toBeCloseTo(MILE / predictRaceSeconds(48, MILE)! * 3600, 8)
    })

    it('flags VDOTs outside the published 30-85 tables', () => {
        expect([29.9, 30, 85, 85.1].map(isExtrapolatedVdot)).toEqual([true, false, false, true])
    })
})

describe('volume limits', () => {
    it('caps I at the lesser of 8% of the week or 10 km', () => {
        expect(sessionCapKm('I', 50)).toBeCloseTo(4, 10)
        expect(sessionCapKm('I', 200)).toBe(10)
    })

    it('caps R at the lesser of 5% of the week or 5 miles', () => {
        expect(sessionCapKm('R', 40)).toBeCloseTo(2, 10)
        expect(sessionCapKm('R', 400)).toBeCloseTo(5 * MILE, 10)
    })

    it('caps M at the lesser of 20% of the week or 18 miles', () => {
        expect(sessionCapKm('M', 50)).toBeCloseTo(10, 10)
        expect(sessionCapKm('M', 300)).toBeCloseTo(18 * MILE, 10)
    })

    it('caps the long run by share of the week and by 150 minutes', () => {
        expect(longRunCapKm(40, 10)).toBeCloseTo(10, 10)
        expect(longRunCapKm(200, 10)).toBeCloseTo(25, 10)
        expect(longRunCapKm(40, null)).toBeCloseTo(10, 10)
        expect(LONG_RUN_MAX_SECONDS).toBe(150 * 60)
    })

    it('sizes a steady threshold block at 20 minutes, or 10% of the week when that is shorter', () => {
        expect(thresholdSessionSeconds(60, 12)).toBe(20 * 60)
        expect(thresholdSessionSeconds(20, 12)).toBeCloseTo(600, 8)
        expect(thresholdSessionSeconds(null, 12)).toBe(20 * 60)
        expect(thresholdSessionSeconds(40, null)).toBe(20 * 60)
    })
})

describe('plan structure', () => {
    it('maps training effort to speed days', () => {
        expect(['base', 'base_quality', 'advanced_quality', 'other'].map(qualitySessionsPerWeek)).toEqual([0, 1, 2, 0])
    })

    it('places a runner in the ideal 24-week season counting back from the goal', () => {
        expect(seasonPhase(24)?.name).toBe('Foundation')
        expect(seasonPhase(18)?.name).toBe('Early Quality')
        expect(seasonPhase(12)?.name).toBe('Transition Quality')
        expect(seasonPhase(6)?.name).toBe('Final Quality')
        expect(seasonPhase(0.5)?.name).toBe('Final Quality')
        expect(seasonPhase(25)).toBeNull()
        expect(seasonPhase(0)).toBeNull()
    })
})
