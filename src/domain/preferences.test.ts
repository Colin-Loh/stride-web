import { describe, expect, it } from 'vitest'
import { CHARACTER_NAMES, parseWeightKg, toCharacter, toWeightKg, WEIGHT_KG_LIMITS } from './preferences'

describe('toCharacter', () => {
    it('migrates the old cat and girl ids to Shooshy and keeps the current ids', () => {
        expect(['cat', 'girl', 'shooshy'].map(toCharacter)).toEqual(['shooshy', 'shooshy', 'shooshy'])
        expect(toCharacter('shiba')).toBe('shiba')
    })

    it('falls back to Shiba for anything else', () => {
        expect([undefined, null, 3, '', 'dog'].map(toCharacter)).toEqual(Array(5).fill('shiba'))
    })

    it('names Shooshy, never Cat, for the runner', () => {
        expect(CHARACTER_NAMES).toEqual({ shiba: 'Shiba', shooshy: 'Shooshy' })
    })
})

describe('toWeightKg', () => {
    it('accepts weights inside the limits, including the limits', () => {
        expect([60, 72.4, WEIGHT_KG_LIMITS.min, WEIGHT_KG_LIMITS.max].map(toWeightKg)).toEqual([60, 72.4, 20, 300])
    })

    it('rejects everything else', () => {
        expect([19.9, 300.1, 0, -5, NaN, Infinity, '60', null, undefined].map(toWeightKg)).toEqual(Array(9).fill(null))
    })
})

describe('parseWeightKg', () => {
    it('treats empty text as no weight, and reads comma decimals', () => {
        expect(parseWeightKg('')).toEqual({ ok: true, kg: null })
        expect(parseWeightKg('  ')).toEqual({ ok: true, kg: null })
        expect(parseWeightKg('61,5')).toEqual({ ok: true, kg: 61.5 })
        expect(parseWeightKg('70')).toEqual({ ok: true, kg: 70 })
    })

    it('flags text that is not a weight in range', () => {
        for (const text of ['abc', '5', '400', '-60', '60kg', '1e2e']) expect(parseWeightKg(text), text).toEqual({ ok: false, kg: null })
    })
})
