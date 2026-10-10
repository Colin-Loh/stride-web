import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION, type CompletedRun } from '../domain/types'
import { deriveHealth, MIN_QUALIFYING_ELAPSED_MS } from './health'

const STAMP = '2026-10-01T00:00:00.000Z'

// Local calendar day D is 2026-10-10. Month index 9 is October.
const D = 10

const at = (day: number, hour = 9, minute = 0) => new Date(2026, 9, day, hour, minute)

const makeRun = (overrides: Partial<CompletedRun> & Pick<CompletedRun, 'id' | 'characterId' | 'completedAt'>): CompletedRun => ({
    schemaVersion: SCHEMA_VERSION, createdAt: STAMP, updatedAt: STAMP,
    workoutId: 'easyRun', planSessionId: null, elapsedMs: 1_500_000, distanceKm: 5,
    ...overrides,
})

const runOn = (id: string, characterId: CompletedRun['characterId'], day: number, hour = 9, minute = 0, elapsedMs = 1_500_000) =>
    makeRun({ id, characterId, completedAt: at(day, hour, minute).toISOString(), elapsedMs })

describe('deriveHealth', () => {
    it('starts both characters obese with no runs, on day one', () => {
        const health = deriveHealth([], at(D))
        expect(health.shiba.status).toBe('obese')
        expect(health.shooshy.status).toBe('obese')
        expect(health.shiba.label).toBe('Chase is obese')
        expect(health.shooshy.label).toBe('Shooshy is obese')
    })

    it('a qualifying run today makes that character healthy at once', () => {
        const health = deriveHealth([runOn('r1', 'shiba', D)], at(D, 18))
        expect(health.shiba.status).toBe('healthy')
        expect(health.shiba.label).toBe('Chase is very healthy')
        expect(health.shooshy.status).toBe('obese')
    })

    it('a run at D stays in the window through D+6, and drops out at D+7', () => {
        const runs = [runOn('r1', 'shooshy', D)]
        expect(deriveHealth(runs, at(D + 6)).shooshy.status).toBe('healthy')
        expect(deriveHealth(runs, at(D + 7)).shooshy.status).toBe('obese')
    })

    it('a run on D+3 keeps the character healthy through D+9 and obese at D+10', () => {
        const runs = [runOn('r1', 'shiba', D + 3)]
        expect(deriveHealth(runs, at(D + 9)).shiba.status).toBe('healthy')
        const later = deriveHealth(runs, at(D + 10))
        expect(later.shiba.status).toBe('obese')
        expect(later.shooshy.status).toBe('obese')
    })

    it('a run at 23:50 on the first day of the window counts', () => {
        const runs = [runOn('r1', 'shiba', D + 3, 23, 50)]
        expect(deriveHealth(runs, at(D + 9, 0, 5)).shiba.status).toBe('healthy')
    })

    it('a run at 00:10 the day after the window end does not count', () => {
        // Window at D+9 is D+3..D+9. A run at 00:10 on D+10 is after today.
        const runs = [runOn('r1', 'shiba', D + 10, 0, 10)]
        expect(deriveHealth(runs, at(D + 9, 23, 59)).shiba.status).toBe('obese')
    })

    it('a run on the day before the window start does not count', () => {
        // Window at D+9 starts D+3. A run at 23:50 on D+2 is outside it.
        const runs = [runOn('r1', 'shiba', D + 2, 23, 50)]
        expect(deriveHealth(runs, at(D + 9)).shiba.status).toBe('obese')
    })

    it('a run of 299999 ms does not count, and 300000 ms does', () => {
        expect(MIN_QUALIFYING_ELAPSED_MS).toBe(300_000)
        const short = [runOn('r1', 'shiba', D, 9, 0, 299_999)]
        const exact = [runOn('r2', 'shiba', D, 9, 0, 300_000)]
        expect(deriveHealth(short, at(D, 12)).shiba.status).toBe('obese')
        expect(deriveHealth(exact, at(D, 12)).shiba.status).toBe('healthy')
    })

    it('runs credited to Shooshy never make Chase healthy', () => {
        const health = deriveHealth([runOn('r1', 'shooshy', D)], at(D, 12))
        expect(health.shiba.status).toBe('obese')
        expect(health.shooshy.status).toBe('healthy')
    })

    it('counts plan sessions in the window as information only, without changing status', () => {
        const runs = [
            makeRun({ id: 'p1', characterId: 'shiba', completedAt: at(D, 8).toISOString(), planSessionId: 'week-1-session-1' }),
            makeRun({ id: 'f1', characterId: 'shiba', completedAt: at(D + 1, 8).toISOString(), planSessionId: null }),
            makeRun({ id: 'p2', characterId: 'shiba', completedAt: at(D - 9, 8).toISOString(), planSessionId: 'week-0-session-1' }),
        ]
        const health = deriveHealth(runs, at(D + 2))
        expect(health.shiba.planSessionsInWindow).toBe(1)
        expect(health.shiba.status).toBe('healthy')
        expect(deriveHealth([runs[0]], at(D + 2)).shiba.status).toBe('healthy')
    })

    it('is deterministic for the same runs and clock', () => {
        const runs = [runOn('r1', 'shiba', D + 1)]
        expect(deriveHealth(runs, at(D + 4))).toEqual(deriveHealth(runs, at(D + 4)))
    })
})
