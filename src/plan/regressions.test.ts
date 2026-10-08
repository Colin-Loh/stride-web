import { describe, expect, it } from 'vitest'
import { derivePersonalBaseline } from './baseline'
import { generatePersonalizedWorkout } from './generate'
import { planToSchema } from './schema'
import { intervalCount } from './intervals'
import type { PlanSection } from './types'

describe('partial interval export', () => {
  it.each([20, 120, 150, 180, 200, 360, 360.25])('preserves %s seconds exactly', seconds => {
    const plan = generatePersonalizedWorkout({ category: 'test', baseline: derivePersonalBaseline({}) })
    const main: PlanSection = { id: 'main', label: 'Run', type: 'run', effort: 'steady', speedKmh: 12,
      target: { basis: 'time', durationSeconds: seconds }, runWalk: { runSeconds: 120, walkSeconds: 60, walkSpeedKmh: 6 } }
    plan.sections = [main]
    const steps = planToSchema(plan)
    expect(steps.reduce((sum, step) => sum + step.duration_seconds, 0)).toBeCloseTo(seconds)
    expect(steps.every(step => step.duration_seconds > 0)).toBe(true)
    expect(steps.filter(step => step.type === 'run')).toHaveLength(intervalCount(seconds, 120, 60))
  })
  it('counts a final partial repetition but no extra repetition at a boundary', () => {
    expect(intervalCount(200, 120, 60)).toBe(2)
    expect(intervalCount(180, 120, 60)).toBe(1)
  })
})
