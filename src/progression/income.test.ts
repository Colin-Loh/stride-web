import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION, type Progression } from '../domain/types'
import { BACKLOG_CAP, claimIncome, pendingIncome } from './income'

const base = (overrides: Partial<Progression> = {}): Progression => ({
    id: 'progression',
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date(2026, 0, 1).toISOString(),
    updatedAt: new Date(2026, 0, 1).toISOString(),
    startDate: '2026-01-01',
    wallets: { shiba: 0, shooshy: 0 },
    lastClaimedDate: { shiba: '2026-01-01', shooshy: '2026-01-01' },
    rewardedRunIds: [], grantsApplied: [],
    inventory: { shiba: [], shooshy: [] },
    equipped: { shiba: null, shooshy: null },
    ...overrides,
})

const day = (d: number) => new Date(2026, 0, d, 9, 0)

describe('pendingIncome', () => {
    it('is 0 on the start day and 1 the day after', () => {
        const p = base()
        expect(pendingIncome(p, 'shiba', day(1))).toBe(0)
        expect(pendingIncome(p, 'shiba', day(2))).toBe(1)
    })

    it('counts every unclaimed day', () => {
        expect(pendingIncome(base(), 'shiba', day(6))).toBe(5)
    })

    it('caps the backlog at 14 after 30 days away', () => {
        const p = base()
        expect(pendingIncome(p, 'shiba', day(31))).toBe(BACKLOG_CAP)
        expect(BACKLOG_CAP).toBe(14)
    })

    it('counts from startDate when lastClaimedDate is the start', () => {
        const p = base({ startDate: '2026-01-10', lastClaimedDate: { shiba: '2026-01-10', shooshy: '2026-01-10' } })
        expect(pendingIncome(p, 'shiba', day(12))).toBe(2)
    })

    it('is 0 when the clock is earlier than lastClaimedDate', () => {
        const p = base({ lastClaimedDate: { shiba: '2026-01-10', shooshy: '2026-01-10' } })
        expect(pendingIncome(p, 'shiba', day(5))).toBe(0)
    })

    it('is 0 when the clock is earlier than startDate', () => {
        const p = base({ startDate: '2026-01-10', lastClaimedDate: { shiba: '2026-01-10', shooshy: '2026-01-10' } })
        expect(pendingIncome(p, 'shiba', day(5))).toBe(0)
    })

    it('uses the local calendar day, so late evening counts as today', () => {
        const p = base()
        expect(pendingIncome(p, 'shiba', new Date(2026, 0, 2, 23, 59))).toBe(1)
    })
})

describe('claimIncome', () => {
    it('adds pending units to the claimed wallet and stamps today', () => {
        const p = base()
        const { progression, claimed } = claimIncome(p, 'shiba', day(6))
        expect(claimed).toBe(5)
        expect(progression.wallets).toEqual({ shiba: 5, shooshy: 0 })
        expect(progression.lastClaimedDate.shiba).toBe('2026-01-06')
        expect(pendingIncome(progression, 'shiba', day(6))).toBe(0)
    })

    it('forfeits days beyond the cap', () => {
        const { progression, claimed } = claimIncome(base(), 'shiba', day(31))
        expect(claimed).toBe(14)
        expect(progression.wallets.shiba).toBe(14)
        expect(progression.lastClaimedDate.shiba).toBe('2026-01-31')
        expect(pendingIncome(progression, 'shiba', day(31))).toBe(0)
    })

    it('returns 0 and the same progression on a second claim the same day', () => {
        const first = claimIncome(base(), 'shiba', day(4))
        const second = claimIncome(first.progression, 'shiba', day(4))
        expect(second.claimed).toBe(0)
        expect(second.progression).toBe(first.progression)
        expect(second.progression.wallets.shiba).toBe(3)
    })

    it('leaves the progression unchanged when the clock moved backwards', () => {
        const p = base({ lastClaimedDate: { shiba: '2026-01-10', shooshy: '2026-01-10' } })
        const { progression, claimed } = claimIncome(p, 'shiba', day(5))
        expect(claimed).toBe(0)
        expect(progression).toBe(p)
    })

    it('keeps Chase and Shooshy claims independent', () => {
        const afterChase = claimIncome(base(), 'shiba', day(3))
        expect(afterChase.progression.lastClaimedDate.shooshy).toBe('2026-01-01')
        expect(pendingIncome(afterChase.progression, 'shooshy', day(3))).toBe(2)

        const afterShooshy = claimIncome(afterChase.progression, 'shooshy', day(4))
        expect(afterShooshy.claimed).toBe(3)
        expect(afterShooshy.progression.wallets).toEqual({ shiba: 2, shooshy: 3 })
        expect(afterShooshy.progression.lastClaimedDate).toEqual({ shiba: '2026-01-03', shooshy: '2026-01-04' })
    })

    it('does not change the input progression', () => {
        const p = base()
        claimIncome(p, 'shiba', day(4))
        expect(p.wallets.shiba).toBe(0)
        expect(p.lastClaimedDate.shiba).toBe('2026-01-01')
    })
})
