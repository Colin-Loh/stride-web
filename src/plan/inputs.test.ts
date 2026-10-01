import { expect, it } from 'vitest'
import { parsePace, roundSpeedUp } from './convert'
import { missingBaselineFields } from './baseline'
it('rounds speed upward without bumping exact tenths', () => {
  expect(roundSpeedUp(8.21)).toBe(8.3)
  expect(roundSpeedUp(8.2)).toBe(8.2)
  expect(roundSpeedUp(8.200000000000001)).toBe(8.2)
})
it('validates pace consistently, including seconds and signs', () => {
  expect(parsePace('5:30')).toBe(330)
  for (const invalid of ['5:90', '-1:30', '1:2', '1.5:00', 'abc', '0:00']) expect(parsePace(invalid)).toBeNull()
})
it('requires pace values and newly selected walking answers', () => {
  expect(missingBaselineFields({ paceKnown: true })).toContain('pace')
  expect(missingBaselineFields({ continuity: 'run-walk', walkPaceKnown: true })).toContain('walkPace')
  expect(missingBaselineFields({ continuity: 'run-walk' })).toContain('walkPace')
})
