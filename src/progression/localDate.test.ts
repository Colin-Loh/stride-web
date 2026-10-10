import { describe, expect, it } from 'vitest'
import { localDateOf } from './localDate'

// Dates are built from local parts, so these tests give the same answer in every timezone.
describe('localDateOf', () => {
    it('gives the local calendar day just before and just after local midnight', () => {
        expect(localDateOf(new Date(2026, 9, 10, 0, 0).getTime())).toBe('2026-10-10')
        expect(localDateOf(new Date(2026, 9, 10, 0, 1).getTime())).toBe('2026-10-10')
        expect(localDateOf(new Date(2026, 9, 9, 23, 59).getTime())).toBe('2026-10-09')
        expect(localDateOf(new Date(2026, 9, 9, 23, 59, 59, 999).getTime())).toBe('2026-10-09')
    })

    it('accepts an ISO date-time string and reads it as the same instant', () => {
        const local = new Date(2026, 9, 10, 0, 30)
        expect(localDateOf(local.toISOString())).toBe('2026-10-10')
    })

    it('pads single-digit months and days', () => {
        expect(localDateOf(new Date(2026, 0, 5, 12).getTime())).toBe('2026-01-05')
    })

    it('uses the local date across a year boundary', () => {
        expect(localDateOf(new Date(2026, 11, 31, 23, 59).getTime())).toBe('2026-12-31')
        expect(localDateOf(new Date(2027, 0, 1, 0, 0).getTime())).toBe('2027-01-01')
    })

    it('rejects a value that is not a date', () => {
        expect(() => localDateOf('not a date')).toThrow(RangeError)
    })
})
