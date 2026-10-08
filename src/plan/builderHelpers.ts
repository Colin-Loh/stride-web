import { EFFORT_LABELS, PROPOSED_SESSION_SHAPE, DANIELS_VOLUME } from './rules'
import type { PlanSection, SectionTarget } from './types'

export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

export function section(
    id: string,
    type: PlanSection['type'],
    label: string,
    target: SectionTarget,
    speedKmh: number | null,
): PlanSection {
    return { id, type, label, target, speedKmh, effort: EFFORT_LABELS[type] }
}

/**
 * Shared warm-up/cool-down/rep-count fitting for repeating sandwich sessions
 * (easy warm-up -> repeated work+recovery -> easy cool-down). The warm-up and
 * cool-down never drop below their floors -- going into hard reps on a short
 * warm-up is the injury risk, not a short block. Reps are trimmed instead, down to
 * minReps. If even that does not fit, the session keeps its floors and runs over the
 * available time (`overBudget`), so validation flags it rather than silently cutting
 * the warm-up.
 */
export function fitRepeatingSandwich(input: {
    available: number | null
    minWarmup: number
    minCooldown: number
    cycleSeconds: number
    wantedReps: number
    minReps: number
}): { warmupSeconds: number; cooldownSeconds: number; reps: number; overBudget: boolean; trimmedReps: boolean; floorSessionSeconds: number } {
    const { available, minWarmup, minCooldown, cycleSeconds, wantedReps, minReps } = input
    const shape = PROPOSED_SESSION_SHAPE
    const floorSessionSeconds = minWarmup + minCooldown + minReps * cycleSeconds
    if (!available) {
        // No time limit: the usual 10 minutes of easy running either side of the reps.
        return {
            warmupSeconds: Math.max(minWarmup, DANIELS_VOLUME.qualityWarmupSeconds),
            cooldownSeconds: Math.max(minCooldown, DANIELS_VOLUME.qualityCooldownSeconds),
            reps: wantedReps, overBudget: false, trimmedReps: false, floorSessionSeconds,
        }
    }

    let warmupSeconds = clamp(available * shape.warmupShareOfSession, minWarmup, shape.maxWarmupSeconds)
    let cooldownSeconds = clamp(available * shape.cooldownShareOfSession, minCooldown, shape.maxCooldownSeconds)
    let reps = Math.floor((available - warmupSeconds - cooldownSeconds) / cycleSeconds)
    if (reps < wantedReps) {
        // Short on time: hand any warm-up/cool-down above the floor back to the reps.
        warmupSeconds = minWarmup
        cooldownSeconds = minCooldown
        reps = Math.floor((available - warmupSeconds - cooldownSeconds) / cycleSeconds)
    }
    const trimmedReps = reps < wantedReps
    const overBudget = reps < minReps
    reps = clamp(reps, minReps, wantedReps)

    return { warmupSeconds, cooldownSeconds, reps, overBudget, trimmedReps, floorSessionSeconds }
}

