import { describe, expect, it } from 'vitest'
import { activeKcal } from './calories'

describe('activeKcal', () => {
    it('is about one kcal per kg per km for level running', () => {
        expect(activeKcal(60, 5.2)).toBeCloseTo(312, 9)
        expect(activeKcal(80, 10)).toBeCloseTo(800, 9)
        expect(activeKcal(1, 1)).toBeCloseTo(1, 12)
    })

    it('matches the ACSM algebra: 0.2 ml/kg/m x metres x kg x 5 kcal/L', () => {
        expect(activeKcal(72.5, 3.37)).toBeCloseTo((0.2 * 3370 * 72.5 * 5) / 1000, 9)
    })

    it('is linear in weight and distance', () => {
        expect(activeKcal(60, 4)! * 2).toBeCloseTo(activeKcal(120, 4)!, 9)
        expect(activeKcal(60, 4)! * 2).toBeCloseTo(activeKcal(60, 8)!, 9)
    })

    it('returns null without a weight or a positive, finite distance, never zero', () => {
        expect(activeKcal(null, 5)).toBeNull()
        expect(activeKcal(60, null)).toBeNull()
        expect(activeKcal(60, 0)).toBeNull()
        expect(activeKcal(0, 5)).toBeNull()
        expect(activeKcal(-60, 5)).toBeNull()
        expect(activeKcal(60, Infinity)).toBeNull()
        expect(activeKcal(NaN, 5)).toBeNull()
    })
})
