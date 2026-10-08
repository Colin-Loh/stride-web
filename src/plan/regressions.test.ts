import { describe, expect, it } from 'vitest'
import { derivePersonalBaseline } from './baseline'
import { generatePersonalizedWorkout } from './generate'
import { calculateWorkoutTotals } from './metrics'
import { validateWorkout } from './validation'
import { planToSchema } from './schema'
import { intervalCount } from './intervals'
import { runnablePlan } from './runnable'
import type { WorkoutId } from '../workouts'
import type { PlanSection } from './types'

const build = (category: WorkoutId, weeklyKm = 40, runWalk = false) => generatePersonalizedWorkout({ category,
  baseline: derivePersonalBaseline({ raceKnown: true, raceDistanceKm: 5, raceSeconds: 1500,
    weeklyKm, daysPerWeek: 4, continuity: runWalk ? 'run-walk' : 'continuous', walkPaceKnown: false }) })

describe('workout limit regressions', () => {
  it.each(['tempo', 'cruise', 'interval'] as const)('blocks %s when minimum work exceeds a small weekly allowance', category => {
    const plan = build(category, 1)
    expect(validateWorkout(plan).issues.some(i => i.message.includes('weekly allowance'))).toBe(true)
    expect(runnablePlan(plan)).toBeNull()
  })
  it.each(['tempo', 'cruise', 'interval'] as const)('accepts %s when its work fits the weekly allowance', category => {
    expect(validateWorkout(build(category, 60)).ok).toBe(true)
  })
  it('accepts an exactly sized cruise block without rounding above the weekly allowance', () => {
    expect(validateWorkout(build('cruise', 20)).ok).toBe(true)
  })
  it('checks edited work blocks, including partial repetitions', () => {
    const plan = build('cruise', 20)
    const main = plan.sections[1]
    const mix = main.runWalk!
    main.target = { basis: 'time', durationSeconds: 2 * (mix.runSeconds + mix.walkSeconds) + 30 }
    expect(validateWorkout(plan).ok).toBe(false)
  })
  it.each([false, true])('caps the whole long workout including run/walk=%s', runWalk => {
    const plan = build('long', 160, runWalk)
    expect(calculateWorkoutTotals(plan.sections).durationSeconds).toBeCloseTo(150 * 60)
    expect(validateWorkout(plan).ok).toBe(true)
    plan.sections[0].target = { basis: 'time', durationSeconds: 1200 }
    expect(validateWorkout(plan).issues.some(i => i.message.includes('150 minutes'))).toBe(true)
  })
})

describe('partial interval export', () => {
  it.each([20, 120, 150, 180, 200, 360, 360.25])('preserves %s seconds exactly', seconds => {
    const plan = build('test')
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
