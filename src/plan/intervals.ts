import type { PlanSection } from './types'

export type RunWalkPhase = 'run' | 'walk'

export function phaseAt(
  section: PlanSection,
  seconds: number,
): { kind: RunWalkPhase; speed: number | null; left: number; cycle: number } {
  const mix = section.runWalk
  if (!mix) return { kind: 'run', speed: section.speedKmh, left: Infinity, cycle: 0 }
  const cycleLength = mix.runSeconds + mix.walkSeconds
  const cycle = Math.floor((seconds + 1e-8) / cycleLength)
  const within = Math.max(0, seconds - cycle * cycleLength)
  const walking = within + 1e-8 >= mix.runSeconds
  return {
    kind: walking ? 'walk' : 'run',
    speed: walking ? mix.walkSpeedKmh : section.speedKmh,
    left: (walking ? cycleLength : mix.runSeconds) - within,
    cycle,
  }
}

/** Exact planned metrics, including a partial final run/walk interval. */
export function intervalMetrics(section: PlanSection) {
  const mix = section.runWalk
  if (!mix || !Number.isFinite(mix.runSeconds) || !Number.isFinite(mix.walkSeconds) || mix.runSeconds < 1 || mix.walkSeconds < 1) {
    return {
      seconds: section.target.basis === 'time' ? section.target.durationSeconds : null,
      distance: section.target.basis === 'distance' ? section.target.distanceKm : null
    }
  }
  const run = section.speedKmh
  const walk = mix.walkSpeedKmh
  if (section.target.basis === 'time') {
    const seconds = section.target.durationSeconds
    if (run === null || walk === null) return { seconds, distance: null }
    const cycle = mix.runSeconds + mix.walkSeconds
    const count = Math.floor(seconds / cycle)
    const rest = seconds % cycle
    return {
      seconds, distance: (count * (run * mix.runSeconds + walk * mix.walkSeconds)
        + run * Math.min(rest, mix.runSeconds) + walk * Math.max(0, rest - mix.runSeconds)) / 3600
    }
  }
  const distance = section.target.distanceKm
  if (run === null || walk === null) return { seconds: null, distance }
  const cycleDistance = (run * mix.runSeconds + walk * mix.walkSeconds) / 3600
  const count = Math.floor(distance / cycleDistance)
  const rest = distance - count * cycleDistance
  const runDistance = run * mix.runSeconds / 3600
  const seconds = count * (mix.runSeconds + mix.walkSeconds)
    + Math.min(rest, runDistance) / run * 3600 + Math.max(0, rest - runDistance) / walk * 3600
  return { seconds, distance }
}

/** Includes a partial final cycle, without inventing an extra cycle at an exact boundary. */
export function intervalCount(seconds: number, runSeconds: number, walkSeconds: number): number {
  return Math.max(0, Math.ceil(seconds / (runSeconds + walkSeconds) - 1e-9))
}
