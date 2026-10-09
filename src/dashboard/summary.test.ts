import { describe, expect, it } from 'vitest'
import { derivePersonalBaseline } from '../plan/baseline'
import { generatePersonalizedWorkout } from '../plan/generate'
import type { PersonalizedWorkout, PlanSection } from '../plan/types'
import { runProgress } from '../run/engine'
import { newRunSession } from '../run/session'
import type { RunSession } from '../domain/types'
import { summarizeRun } from './summary'

const timed = (id: string, type: PlanSection['type'], seconds: number, speed: number | null, extra: Partial<PlanSection> = {}): PlanSection => ({
    id, type, label: id, effort: 'x', speedKmh: speed, target: { basis: 'time', durationSeconds: seconds }, ...extra,
})

/** The design fixture, with the cool-down speed on the treadmill's 0.1 km/h grid: 5.206 km in 40:12. */
const FIXTURE: PlanSection[] = [
    timed('Warm-up', 'warmup', 480, 7),
    timed('Main', 'run', 1440, 8.7),
    timed('Cool-down', 'cooldown', 492, 5.8),
]

function finished(category: PersonalizedWorkout['category'], sections: PlanSection[], speedChanges: RunSession['speedChanges'] = [], pausedMs = 0): RunSession {
    const base = generatePersonalizedWorkout({ category: 'threshold', baseline: derivePersonalBaseline({}) })
    const plan = { ...base, category, sections }
    const end = runProgress(plan, speedChanges, Infinity)
    return { ...newRunSession(plan, 'run-1'), speedChanges, pausedMs, completed: true, paused: true, result: { elapsedMs: end.elapsedMs, distanceKm: end.distanceKm } }
}

describe('summarizeRun', () => {
    it('reproduces the design fixture: 5.21 km, 40:12, 7:43/km, 312 kcal at 60 kg', () => {
        const summary = summarizeRun(finished('marathon', FIXTURE), 60)
        expect(summary.distanceKm).toBeCloseTo(5.206, 6)
        expect(summary.activeSeconds).toBeCloseTo(2412, 6)
        expect(summary.paceSecondsPerKm).toBeCloseTo(463.31, 2)
        expect(summary.averageKmh).toBeCloseTo(7.7701, 3)
        expect(summary.kcal).toBeCloseTo(312.36, 2)
        expect(summary.sectionsDone).toBe(3)
        expect(summary.sectionsPlanned).toBe(3)
    })

    it('splits time by prescribed zone: warm-up and cool-down E, the main run in the workout zone', () => {
        const summary = summarizeRun(finished('marathon', FIXTURE), 60)
        expect(summary.zoneTimes.map((item) => [item.zone, Math.round(item.seconds)])).toEqual([['E', 972], ['M', 1440]])
        expect(summarizeRun(finished('threshold', FIXTURE), null).zoneTimes.map((item) => item.zone)).toEqual(['E', 'T'])
        expect(summary.rows.map((row) => [row.label, row.zone, Math.round(row.actualSeconds), row.plannedSeconds])).toEqual([
            ['Warm-up', 'E', 480, 480], ['Main', 'M', 1440, 1440], ['Cool-down', 'E', 492, 492],
        ])
        expect(summary.rows[1].distanceKm).toBeCloseTo(3.48, 6)
        expect(summary.rows[1].averageKmh).toBeCloseTo(8.7, 6)
    })

    it('shows no calories without a weight, and never zero', () => {
        const summary = summarizeRun(finished('marathon', FIXTURE), null)
        expect(summary.kcal).toBeNull()
        expect(summary.distanceKm).toBeGreaterThan(0)
    })

    it('follows the speed the runner set, and keeps the planned speed for the dashed line', () => {
        const summary = summarizeRun(finished('marathon', FIXTURE, [{ atMs: 480_000, offset: 0.5 }]), 60)
        const main = summary.steps.filter((step) => step.index === 1)
        expect(main).toHaveLength(1)
        expect(main[0].speedKmh).toBeCloseTo(9.2, 9)
        expect(main[0].plannedKmh).toBe(8.7)
        expect(summary.distanceKm).toBeCloseTo(5.206 + (0.5 * 24) / 60 + 0.5 * (492 / 3600), 6)
    })

    it('files the recovery of rep sessions under its own category and merges equal steps', () => {
        const sections = [
            timed('Warm-up', 'warmup', 300, 7),
            timed('Reps', 'run', 360, 12, { runWalk: { runSeconds: 120, walkSeconds: 60, walkSpeedKmh: 6 } }),
        ]
        const summary = summarizeRun(finished('interval', sections), 70)
        const byZone = Object.fromEntries(summary.zoneTimes.map((item) => [item.zone, item.seconds]))
        expect(byZone).toEqual({ E: 300, I: 240, recovery: 120 })
        expect(summary.steps.map((step) => step.zone)).toEqual(['E', 'I', 'recovery', 'I', 'recovery'])
    })

    it('has no distance, pace, speed or calories when a section has no speed', () => {
        const summary = summarizeRun(finished('long', [timed('Easy', 'run', 600, null)]), 60)
        expect(summary.distanceKm).toBeNull()
        expect(summary.paceSecondsPerKm).toBeNull()
        expect(summary.averageKmh).toBeNull()
        expect(summary.kcal).toBeNull()
        expect(summary.activeSeconds).toBe(600)
        expect(summary.rows[0].averageKmh).toBeNull()
        expect(summary.steps[0].speedKmh).toBeNull()
    })

    it('handles an empty result without pace, and reports pauses', () => {
        const session = finished('long', [timed('Easy', 'run', 600, 8)], [], 90_000)
        const empty = { ...session, result: { elapsedMs: 0, distanceKm: 0 } }
        const summary = summarizeRun(empty, 60)
        expect(summary.paceSecondsPerKm).toBeNull()
        expect(summary.kcal).toBeNull()
        expect(summary.rows).toEqual([])
        expect(summarizeRun(session, 60).pausedSeconds).toBe(90)
    })

    it('counts the sections finished when the result stops early', () => {
        const session = finished('marathon', FIXTURE)
        const early = { ...session, result: { elapsedMs: 600_000, distanceKm: 1.5 } }
        const summary = summarizeRun(early, 60)
        expect(summary.sectionsDone).toBe(1)
        expect(summary.sectionsPlanned).toBe(3)
    })
})
