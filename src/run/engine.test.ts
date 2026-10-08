import { describe, expect, it } from 'vitest'
import { runProgress } from './engine'
import { generatePersonalizedWorkout } from '../plan/generate'
import { derivePersonalBaseline } from '../plan/baseline'
import type { PersonalizedWorkout, PlanSection } from '../plan/types'

const make = (sections?: PlanSection[]): PersonalizedWorkout => {
  const plan = generatePersonalizedWorkout({ category: 'test', baseline: derivePersonalBaseline({ paceKnown: true, paceMinutes: 6 }) })
  return sections ? { ...plan, sections } : plan
}
const section = (id: string, seconds: number, speed: number | null): PlanSection => ({ id, type: 'run', label: id,
  target: { basis: 'time', durationSeconds: seconds }, speedKmh: speed, effort: 'steady' })

describe('run replay', () => {
  it('keeps every test section at 30 seconds despite speed changes', () => {
    const plan = make()
    const changes = [{ atMs: 10_000, offset: 3.2 }, { atMs: 40_000, offset: -2 }]
    expect(runProgress(plan, changes, 29_999).index).toBe(0)
    expect(runProgress(plan, changes, 30_000).index).toBe(1)
    expect(runProgress(plan, changes, 60_000).index).toBe(2)
    expect(runProgress(plan, changes, 90_000).done).toBe(true)
    expect(runProgress(plan, changes, Infinity).elapsedMs).toBeCloseTo(90_000)
  })
  it('catches up across multiple timed section boundaries using their own speeds', () => {
    const plan = make([section('warmup', 30, 6), section('main', 30, 12), section('cooldown', 30, 6)])
    expect(runProgress(plan, [], 90_000).distanceKm).toBeCloseTo(0.2)
    expect(runProgress(plan, [], 75_000).distanceKm).toBeCloseTo(0.175)
    expect(runProgress(plan, [], 75_000).index).toBe(2)
  })
  it('replays serialized speed history identically after a refresh', () => {
    const plan = make([section('main', 180, 6)])
    const changes = [{ atMs: 60_000, offset: 6 }, { atMs: 120_000, offset: 3 }]
    const first = runProgress(plan, changes, 150_000)
    const restored = runProgress(JSON.parse(JSON.stringify(plan)), JSON.parse(JSON.stringify(changes)), 150_000)
    expect(restored).toEqual(first)
    expect(first.distanceKm).toBeCloseTo(0.375)
  })
  it('finishes distance targets earlier at a higher entered speed', () => {
    const s = { ...section('main', 60, 6), target: { basis: 'distance' as const, distanceKm: 1 } }
    const plan = make([s])
    expect(runProgress(plan, [{ atMs: 300_000, offset: 6 }], Infinity).elapsedMs).toBeCloseTo(450_000)
  })
  it('uses future section speeds in ETA instead of extending the current speed forever', () => {
    const plan = make([{ ...section('a', 0, 6), target: { basis: 'distance', distanceKm: 1 } },
      { ...section('b', 0, 12), target: { basis: 'distance', distanceKm: 1 } }])
    expect(runProgress(plan, [], Infinity).elapsedMs).toBeCloseTo(900_000)
  })
  it('runs unknown-speed time targets without inventing distance', () => {
    const plan = make([section('main', 30, null)])
    expect(runProgress(plan, [], 30_000)).toMatchObject({ done: true, elapsedMs: 30_000, distanceKm: null })
  })
  it('handles run/walk boundaries and partial final intervals', () => {
    const plan = make([{ ...section('main', 240, 12), runWalk: { runSeconds: 120, walkSeconds: 60, walkSpeedKmh: 6 } }])
    expect(runProgress(plan, [], 120_000).phase).toBe('walk')
    expect(runProgress(plan, [], 180_000).phase).toBe('run')
    expect(runProgress(plan, [], 240_000)).toMatchObject({ done: true, distanceKm: 0.7 })
  })
  it('replays run/walk distance sections across a long inactive period', () => {
    const s = { ...section('main', 0, 12), target: { basis: 'distance' as const, distanceKm: 0.6 },
      runWalk: { runSeconds: 120, walkSeconds: 60, walkSpeedKmh: 6 } }
    expect(runProgress(make([s]), [], Infinity).elapsedMs).toBeCloseTo(210_000)
  })
  it('stops accumulated distance at completion even if reopening much later', () => {
    const plan = make([section('main', 30, 6)])
    expect(runProgress(plan, [], 86_400_000)).toMatchObject({ done: true, elapsedMs: 30_000, distanceKm: 0.05 })
  })
})

describe('section finish forecasts', () => {
  it('updates a distance section countdown after a speed change without rewriting history', () => {
    const plan = make([{ ...section('a', 0, 6), target: { basis: 'distance', distanceKm: 1 } }, section('b', 30, 6)])
    const changes = [{ atMs: 300_000, offset: 6 }]
    const forecast = runProgress(plan, changes, Infinity)
    const current = runProgress(plan, changes, 300_000)
    expect(forecast.sectionEndsMs[0] - current.elapsedMs).toBeCloseTo(150_000)
    expect(forecast.elapsedMs).toBeCloseTo(480_000)
    expect(current.distanceKm).toBeCloseTo(0.5)
  })
  it('forecasts run/walk distance sections through future phase boundaries', () => {
    const plan = make([{ ...section('a', 0, 12), target: { basis: 'distance', distanceKm: 0.6 },
      runWalk: { runSeconds: 120, walkSeconds: 60, walkSpeedKmh: 6 } }])
    const forecast = runProgress(plan, [], Infinity)
    expect(forecast.sectionEndsMs[0] - 120_000).toBeCloseTo(90_000)
  })
  it('keeps timed section end times fixed after speed changes', () => {
    expect(runProgress(make(), [{ atMs: 10_000, offset: 5 }], Infinity).sectionEndsMs).toEqual([30_000, 60_000, 90_000])
  })
})
