import { describe, expect, it } from 'vitest'
import { derivePersonalBaseline } from './baseline'
import { roundSpeedUp } from './convert'
import { currentWeekIndex } from './dates'
import { longRunCapKm, sessionCapKm, trainingSpeedsKmh, vdotFromRace, weeklyVolumes } from './vdot'
import { calculateSectionMetrics } from './metrics'
import { buildPaceSet } from './paces'
import type { AnswerValues } from './questions'
import { generateTrainingPlan, sessionWorkout, withSessionSections } from './trainingPlan'
import { validateWorkout } from './validation'

const NOW = new Date(2026, 9, 8, 12, 0, 0)
const REPORT: AnswerValues = {
    fitness_method: 'recent_race', recent_race_distance: 5, recent_race_time: 35 * 60,
    training_focus: 'base', weekly_volume: 15, running_days: 3, training_effort: 'base',
}
const counter = () => { let n = 0; return () => `id${++n}` }
const plan = (overrides: AnswerValues = {}, now = NOW) =>
    generateTrainingPlan({ baseline: derivePersonalBaseline({ ...REPORT, ...overrides }), now, newId: counter() })!

describe('paces', () => {
    it('gives all five VDOT paces for a known VDOT, with treadmill speeds rounded up', () => {
        const vdot = vdotFromRace(5, 1500)!
        const speeds = trainingSpeedsKmh(vdot)!
        const set = buildPaceSet(derivePersonalBaseline({ ...REPORT, recent_race_time: 1500 }), 'p', '2026-10-08T12:00:00.000Z')
        for (const zone of ['E', 'M', 'T', 'I', 'R'] as const) {
            expect(set.zones[zone]).toEqual({ paceSecondsPerKm: Math.round(3600 / speeds[zone]), speedKmh: roundSpeedUp(speeds[zone]) })
        }
        expect(set.vdot).toBeCloseTo(vdot, 10)
        // VDOT 38.3: published table paces within a couple of seconds (E ~6:07, T ~5:03, I ~4:36).
        expect(set.zones.T!.paceSecondsPerKm).toBeLessThan(set.zones.E!.paceSecondsPerKm)
        expect(set.zones.I!.paceSecondsPerKm).toBeLessThan(set.zones.T!.paceSecondsPerKm)
        expect(set.zones.R!.paceSecondsPerKm).toBeLessThan(set.zones.I!.paceSecondsPerKm)
        expect(set.zones.M!.paceSecondsPerKm).toBeGreaterThan(set.zones.T!.paceSecondsPerKm)
        expect(set.zones.M!.paceSecondsPerKm).toBeLessThan(set.zones.E!.paceSecondsPerKm)
    })

    it('gives only E from a reported easy pace', () => {
        const set = buildPaceSet(derivePersonalBaseline({ fitness_method: 'easy_pace', conversational_easy_pace: 420 }), 'p', 'x')
        expect(set.zones.E).toEqual({ paceSecondsPerKm: 420, speedKmh: roundSpeedUp(3600 / 420) })
        expect([set.zones.M, set.zones.T, set.zones.I, set.zones.R]).toEqual([null, null, null, null])
        expect(set.vdot).toBeNull()
    })
})

describe('generateTrainingPlan', () => {
    it('builds 12 weeks following weeklyVolumes, each with a long run and E running (Base effort)', () => {
        const result = plan()
        expect(result.weeks).toHaveLength(12)
        expect(result.weeks.map((week) => week.targetKm)).toEqual(weeklyVolumes(15, 3, 12))
        for (const week of result.weeks) {
            expect(week.sessions.map((session) => session.kind)).toEqual(['filler', 'filler', 'long'])
        }
    })

    it('adds the speed sessions the training effort allows, rotating R, I, T by level', () => {
        const result = plan({ running_days: 5, training_effort: 'advanced_quality', weekly_volume: 40 })
        const kinds = (week: number) => result.weeks[week].sessions.map((session) => session.kind)
        expect(kinds(0)).toEqual(['repetition', 'filler', 'interval', 'filler', 'long'])
        expect(kinds(4)).toEqual(['interval', 'filler', 'threshold', 'filler', 'long'])
        expect(kinds(8)).toEqual(['threshold', 'filler', 'repetition', 'filler', 'long'])
        const threeDays = plan({ running_days: 3, training_effort: 'advanced_quality' })
        expect(threeDays.weeks[0].sessions.map((session) => session.kind)).toEqual(['repetition', 'filler', 'long'])
        expect(threeDays.notes.join(' ')).toContain('speed days were left out')
    })

    it('sizes every session inside its VDOT cap for that week', () => {
        const result = plan({ running_days: 5, training_effort: 'advanced_quality', weekly_volume: 40 })
        for (const week of result.weeks) {
            for (const session of week.sessions) {
                const workout = sessionWorkout(result, week, session)
                expect(validateWorkout(workout).ok, `${session.kind} in week ${week.number}`).toBe(true)
                if (session.kind === 'long') {
                    const km = calculateSectionMetrics(session.sections[0]).distanceKm!
                    expect(km).toBeLessThanOrEqual(longRunCapKm(week.targetKm, session.sections[0].speedKmh) + 1e-9)
                }
                if (session.kind === 'interval' || session.kind === 'repetition') {
                    const reps = session.sections[1]
                    const mix = reps.runWalk!
                    const count = (reps.target as { durationSeconds: number }).durationSeconds / (mix.runSeconds + mix.walkSeconds)
                    const km = (count * reps.speedKmh! * mix.runSeconds) / 3600
                    expect(km).toBeLessThanOrEqual(sessionCapKm(session.kind === 'interval' ? 'I' : 'R', week.targetKm) + 1e-9)
                }
            }
        }
    })

    it('fills the rest of the week with E running and reports the long-run cap conflict', () => {
        const result = plan()
        const week = result.weeks[0]
        const km = week.sessions.map((session) => calculateSectionMetrics(session.sections[0]).distanceKm!)
        expect(km[0]).toBe(km[1])
        expect(km[2]).toBeCloseTo(15 * 0.25, 1)
        expect(km[0] + km[1] + km[2]).toBeLessThanOrEqual(15 + 1e-9)
        expect(km[0] + km[1] + km[2]).toBeGreaterThan(15 - 0.3)
        expect(result.notes.join(' ')).toContain('longer than your long run')
    })

    it('runs until the goal race when it is further than 12 weeks away, and highlights the current week', () => {
        const result = plan({ training_focus: '10k', goal_race_date: '2027-03-04' })
        expect(result.weeks).toHaveLength(21)
        expect(currentWeekIndex(result.startDate, result.weeks.length, NOW)).toBe(0)
        expect(currentWeekIndex(result.startDate, result.weeks.length, new Date(2026, 10, 12))).toBe(5)
        expect(currentWeekIndex(result.startDate, result.weeks.length, new Date(2030, 0, 1))).toBe(20)
        expect(currentWeekIndex(result.startDate, result.weeks.length, new Date(2020, 0, 1))).toBe(0)
    })

    it('is plain JSON with unique stable ids, schema versions and ISO timestamps', () => {
        const result = plan({ running_days: 4, training_effort: 'base_quality' })
        expect(JSON.parse(JSON.stringify(result))).toEqual(result)
        const records = [result, result.paces, ...result.weeks, ...result.weeks.flatMap((week) => week.sessions)]
        expect(new Set(records.map((record) => record.id)).size).toBe(records.length)
        for (const record of records) {
            expect(record.schemaVersion).toBe(1)
            expect(record.createdAt).toBe(NOW.toISOString())
            expect(record.updatedAt).toBe(NOW.toISOString())
        }
        expect(result.weeks[1].startDate).toBe('2026-10-15')
    })

    it('still builds a plan from an easy pace alone, with speed sessions by effort', () => {
        const result = plan({ fitness_method: 'easy_pace', conversational_easy_pace: 420, running_days: 4, training_effort: 'base_quality' })
        expect(result.paces.zones.T).toBeNull()
        const quality = result.weeks[0].sessions.find((session) => session.kind === 'repetition')!
        expect(quality.sections[1].speedKmh).toBeNull()
        expect(validateWorkout(sessionWorkout(result, result.weeks[0], quality)).ok).toBe(true)
    })

    it('returns null without the weekly distance or running days', () => {
        expect(generateTrainingPlan({ baseline: derivePersonalBaseline({}), now: NOW })).toBeNull()
    })

    it('replaces the sections of one session and stamps the change', () => {
        const result = plan()
        const target = result.weeks[2].sessions[1]
        const later = new Date(2026, 9, 9)
        const edited = withSessionSections(result, target.id, [{ ...target.sections[0], speedKmh: 9 }], later)
        expect(edited.weeks[2].sessions[1].sections[0].speedKmh).toBe(9)
        expect(edited.weeks[2].sessions[1].updatedAt).toBe(later.toISOString())
        expect(edited.weeks[2].sessions[0]).toBe(result.weeks[2].sessions[0])
        expect(edited.weeks[3]).toBe(result.weeks[3])
    })
})
