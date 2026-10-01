import type { PersonalizedWorkout } from '../plan/types'
import { phaseAt, type RunWalkPhase } from '../plan/intervals'
import { clampSpeed } from '../plan/convert'

export interface SpeedChange { atMs: number; offset: number }
export interface RunProgress {
  index: number; phase: RunWalkPhase; phaseKey: string; speed: number | null
  /** Zero-based run/walk cycle inside the current section, for "Rep 3 of 8". */
  cycle: number
  elapsedMs: number; distanceKm: number | null; segmentProgress: number
  overall: number; done: boolean
}

/** Replay active time, splitting exactly at speed changes, intervals, and section boundaries. */
export function runProgress(plan: PersonalizedWorkout, changes: SpeedChange[], elapsedMs: number): RunProgress {
  let time = 0, distance = 0, knownDistance = true, event = 0, offset = 0
  const limit = Math.max(0, elapsedMs) / 1000
  let result: RunProgress | undefined
  for (let index = 0; index < plan.sections.length; index++) {
    const section = plan.sections[index]
    let sectionTime = 0, sectionDistance = 0
    while (true) {
      while (event < changes.length && changes[event].atMs / 1000 <= time + 1e-8) {
        offset = changes[event++].offset
      }
      const phase = phaseAt(section, sectionTime)
      const speed = phase.speed === null ? null : clampSpeed(phase.speed + offset)
      const target = section.target
      const fraction = target.basis === 'time' ? sectionTime / target.durationSeconds : sectionDistance / target.distanceKm
      result = {
        index, phase: phase.kind, phaseKey: `${section.id}:${phase.cycle}:${phase.kind}`, speed, cycle: phase.cycle,
        elapsedMs: time * 1000, distanceKm: knownDistance ? distance : null,
        segmentProgress: Math.min(1, fraction), overall: (index + Math.min(1, fraction)) / plan.sections.length, done: false
      }
      if (fraction >= 1 - 1e-9) break
      if (time >= limit - 1e-9) return result
      const sectionLeft = target.basis === 'time' ? target.durationSeconds - sectionTime
        : speed === null ? Infinity : (target.distanceKm - sectionDistance) / speed * 3600
      const nextEvent = (changes[event]?.atMs ?? Infinity) / 1000 - time
      const step = Math.min(limit - time, sectionLeft, phase.left, nextEvent)
      if (!Number.isFinite(step) || step <= 0) return result
      const added = speed === null ? 0 : speed * step / 3600
      if (speed === null) knownDistance = false
      distance += added; sectionDistance += added; time += step; sectionTime += step
    }
  }
  if (!result) throw new Error('A run needs at least one section')
  return {
    ...result, elapsedMs: time * 1000, distanceKm: knownDistance ? distance : null,
    done: true, segmentProgress: 1, overall: 1
  }
}
