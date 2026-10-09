import { describe, expect, it } from 'vitest'
import {
    intervalSession, isExtrapolatedVdot, LONG_RUN_MAX_SECONDS, longRunCapKm, oxygenCost, planWeekCount, predictRaceSeconds,
    HARD_DAYS_PER_WEEK_CAP, hardDayPositions, PROGRESSION, qualityKinds, TAPER_FINAL_WEEK_HARD_CAP, taperFractions, taperWeeks, qualitySessionsPerWeek, RACE_DISTANCES, repetitionSession, weekStructure, weeklyVolumes, seasonPhase, sessionCapKm, sustainableFraction, thresholdSessionSeconds, trainingSpeedsKmh,
    vdotFromRace, ZONES, type Zone,
} from './vdot'

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

describe('weekly progression', () => {
    const STEP = 3 * MILE

    it('holds the start volume for four weeks, then adds one mile per run (research example: 15 km, 3 runs)', () => {
        const volumes = weeklyVolumes(15, 3, 12)
        expect(volumes).toHaveLength(12)
        expect(volumes.slice(0, 4)).toEqual([15, 15, 15, 15])
        for (const week of [4, 5, 6, 7]) expect(volumes[week]).toBeCloseTo(15 + STEP, 10)
        for (const week of [8, 9, 10, 11]) expect(volumes[week]).toBeCloseTo(15 + 2 * STEP, 10)
        expect(STEP).toBeCloseTo(4.828032, 6)
    })

    it('caps a single step at ten miles', () => {
        const volumes = weeklyVolumes(50, 14, 5)
        expect(volumes[4]).toBeCloseTo(50 + 10 * MILE, 10)
        expect(PROGRESSION.maxIncreaseKm).toBeCloseTo(16.09344, 5)
    })

    it('never decreases and needs a positive start and week count', () => {
        const volumes = weeklyVolumes(20, 5, 30)
        volumes.slice(1).forEach((km, i) => expect(km).toBeGreaterThanOrEqual(volumes[i]))
        expect(weeklyVolumes(0, 3, 12)).toEqual([])
        expect(weeklyVolumes(15, 3, 0)).toEqual([])
        expect(weeklyVolumes(15, 0, 6)).toEqual(Array(6).fill(15))
    })

    it('plans at least 12 weeks, or until the goal race, up to a limit', () => {
        expect(planWeekCount(null)).toBe(12)
        expect(planWeekCount(5)).toBe(12)
        expect(planWeekCount(20.2)).toBe(21)
        expect(planWeekCount(500)).toBe(52)
    })
})

describe('week structure', () => {
    it('keeps hard days (speed plus steady) at the cap or fewer, spread so none touch', () => {
        expect(weekStructure(3, 'base')).toEqual({ long: 1, quality: 0, steady: 1, easy: 1 })
        expect(weekStructure(3, 'advanced_quality')).toEqual({ long: 1, quality: 1, steady: 0, easy: 1 })
        expect(weekStructure(4, 'advanced_quality')).toEqual({ long: 1, quality: 2, steady: 0, easy: 1 })
        expect(weekStructure(5, 'advanced_quality')).toEqual({ long: 1, quality: 2, steady: 0, easy: 2 })
        expect(weekStructure(5, 'base_quality')).toEqual({ long: 1, quality: 1, steady: 1, easy: 2 })
        expect(weekStructure(5, 'base')).toEqual({ long: 1, quality: 0, steady: 2, easy: 2 })
        expect(weekStructure(6, 'base')).toEqual({ long: 1, quality: 0, steady: 2, easy: 3 })
        expect(weekStructure(2, 'base_quality')).toEqual({ long: 1, quality: 0, steady: 1, easy: 0 })
        expect(weekStructure(1, 'base')).toEqual({ long: 1, quality: 0, steady: 0, easy: 0 })
        expect(weekStructure(0, null)).toEqual({ long: 0, quality: 0, steady: 0, easy: 0 })
        expect(HARD_DAYS_PER_WEEK_CAP).toBe(2)
        for (let runs = 0; runs <= 14; runs++) {
            for (const effort of [null, 'base', 'base_quality', 'advanced_quality']) {
                const week = weekStructure(runs, effort)
                expect(week.long + week.quality + week.steady + week.easy).toBe(runs)
                expect(week.quality + week.steady).toBeLessThanOrEqual(HARD_DAYS_PER_WEEK_CAP)
                expect(week.quality + week.steady).toBeLessThanOrEqual(Math.ceil((runs - week.long) / 2))
            }
        }
    })

    it('takes a lower cap, as in the last taper week', () => {
        expect(weekStructure(5, 'advanced_quality', TAPER_FINAL_WEEK_HARD_CAP)).toEqual({ long: 1, quality: 1, steady: 0, easy: 3 })
        expect(weekStructure(5, 'base', 0)).toEqual({ long: 1, quality: 0, steady: 0, easy: 4 })
    })

    it('puts hard days on every other day', () => {
        expect(hardDayPositions(4, 2)).toEqual([0, 2])
        expect(hardDayPositions(2, 2)).toEqual([0])
        expect(hardDayPositions(5, 0)).toEqual([])
    })

    it('rotates speed sessions in the order R, I, T, one emphasis per level', () => {
        expect(qualityKinds(0, 1)).toEqual(['repetition'])
        expect(qualityKinds(4, 1)).toEqual(['interval'])
        expect(qualityKinds(8, 1)).toEqual(['threshold'])
        expect(qualityKinds(0, 2)).toEqual(['repetition', 'interval'])
        expect(qualityKinds(0, 0)).toEqual([])
    })
})

describe('interval and repetition sizing', () => {
    const SPEED_I = 12
    const SPEED_R = 14

    it('fits as many 3-minute I bouts as the cap allows, with an equal jog', () => {
        const session = intervalSession(40, SPEED_I)
        expect(session).toEqual({ reps: 5, repSeconds: 180, recoverySeconds: 180 })
        expect((session.reps * SPEED_I * session.repSeconds) / 3600).toBeLessThanOrEqual(sessionCapKm('I', 40))
    })

    it('shrinks to one shorter I bout, never below a minute, when a full bout exceeds the cap', () => {
        const session = intervalSession(6, SPEED_I)
        expect(session.reps).toBe(1)
        expect(session.repSeconds).toBe(Math.floor((sessionCapKm('I', 6) / SPEED_I) * 3600))
        expect((SPEED_I * session.repSeconds) / 3600).toBeLessThanOrEqual(sessionCapKm('I', 6))
        expect(intervalSession(1, SPEED_I).repSeconds).toBe(60)
    })

    it('builds R reps of 400 m or two minutes at most, with recovery twice the work, inside the R cap', () => {
        const session = repetitionSession(40, SPEED_R)
        expect(session.repSeconds).toBeLessThanOrEqual(120)
        expect(session.repSeconds).toBe(Math.floor((0.4 / SPEED_R) * 3600))
        expect(session.recoverySeconds).toBe(2 * session.repSeconds)
        expect(session.reps).toBe(Math.floor(sessionCapKm('R', 40) / ((SPEED_R * session.repSeconds) / 3600) + 1e-9))
        expect((session.reps * SPEED_R * session.repSeconds) / 3600).toBeLessThanOrEqual(sessionCapKm('R', 40))
    })

    it('limits R work to the lesser of 5% of the week or five miles', () => {
        const huge = repetitionSession(400, SPEED_R)
        expect((huge.reps * SPEED_R * huge.repSeconds) / 3600).toBeLessThanOrEqual(5 * MILE)
        expect((huge.reps * SPEED_R * huge.repSeconds) / 3600).toBeGreaterThan(5 * MILE - 0.4)
    })

    it('shortens one R rep to fit a tiny week and caps slow runners at two minutes', () => {
        const tiny = repetitionSession(5, SPEED_R)
        expect(tiny.reps).toBe(1)
        expect((SPEED_R * tiny.repSeconds) / 3600).toBeLessThanOrEqual(sessionCapKm('R', 5))
        expect(repetitionSession(40, 6).repSeconds).toBe(120)
    })

    it('falls back to placeholder reps when no pace or weekly distance is known', () => {
        expect(intervalSession(null, null).reps).toBe(4)
        expect(repetitionSession(40, null).reps).toBe(4)
        expect(repetitionSession(null, SPEED_R).reps).toBe(4)
    })
})

describe('taperWeeks', () => {
    const flat = Array(12).fill(30)
    const rising = weeklyVolumes(20, 4, 12)

    it('applies 0.75 then 0.50 to the last two weeks before a half marathon', () => {
        // 73 days out: week 10 starts 63 days in (10 days out), week 11 starts 3 days out.
        const weeks = taperWeeks(flat, 73, 'half_marathon')
        expect(weeks.map((week) => week.taper)).toEqual([...Array(9).fill(false), true, true, false])
        expect(weeks[9].targetKm).toBeCloseTo(22.5, 9)
        expect(weeks[10].targetKm).toBeCloseTo(15, 9)
        expect(weeks.map((week) => week.final)).toEqual([...Array(10).fill(false), true, false])
        expect(weeks[11].targetKm).toBe(30)
    })

    it('uses the last full week before the taper as the baseline, not the stepped-up volumes', () => {
        const weeks = taperWeeks(rising, 84, 'marathon')
        expect(weeks[10].targetKm).toBeCloseTo(rising[9] * 0.75, 9)
        expect(weeks[11].targetKm).toBeCloseTo(rising[9] * 0.5, 9)
        expect(weeks.slice(0, 10).map((week) => week.targetKm)).toEqual(rising.slice(0, 10))
    })

    it('tapers one week for 5K and 10K, none for Base or no focus, and the shortest taper for other focuses', () => {
        expect(taperWeeks(flat, 80, '10k').filter((week) => week.taper)).toHaveLength(1)
        expect(taperWeeks(flat, 80, '10k').find((week) => week.taper)!.targetKm).toBeCloseTo(18, 9)
        expect(taperWeeks(flat, 80, 'base').some((week) => week.taper)).toBe(false)
        expect(taperWeeks(flat, 80, null).some((week) => week.taper)).toBe(false)
        expect(taperFractions('ultra')).toEqual([0.6])
    })

    it('starts inside the taper when the race is less than two weeks away, and ignores a past race', () => {
        const near = taperWeeks(flat, 10, 'half_marathon')
        expect(near.slice(0, 2).map((week) => week.targetKm)).toEqual([22.5, 15])
        expect(near[2].taper).toBe(false)
        expect(taperWeeks(flat, -3, 'half_marathon').some((week) => week.taper)).toBe(false)
        expect(taperWeeks([], 10, 'marathon')).toEqual([])
    })

    it('does not change its input', () => {
        const input = [...flat]
        taperWeeks(input, 73, 'half_marathon')
        expect(input).toEqual(flat)
    })
})
