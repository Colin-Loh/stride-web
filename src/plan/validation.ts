import { distanceFromSpeed, isPositiveFinite, MIN_SPEED, MAX_SPEED } from './convert'
import { calculateSectionMetrics, calculateWorkoutTotals } from './metrics'
import { LONG_RUN_MAX_SECONDS, sessionCapKm } from './vdot'
import type { PersonalizedWorkout } from './types'

export interface WorkoutIssue {
    sectionId?: string
    message: string
}

export function validateWorkout(workout: PersonalizedWorkout): {
    ok: boolean
    issues: WorkoutIssue[]
} {
    const issues: WorkoutIssue[] = []

    if (workout.sections.length === 0) {
        issues.push({ message: 'This workout has no sections.' })
    }

    for (const item of workout.sections) {
        const target = item.target as {
            basis?: string
            durationSeconds?: number
            distanceKm?: number
        }
        const hasTime = target.durationSeconds !== undefined
        const hasDistance = target.distanceKm !== undefined
        if (hasTime === hasDistance) {
            issues.push({
                sectionId: item.id,
                message: `${item.label} needs exactly one target: a duration or a distance.`,
            })
            continue
        }
        const value = hasTime ? target.durationSeconds : target.distanceKm
        if (!isPositiveFinite(value)) {
            issues.push({
                sectionId: item.id,
                message: `${item.label} needs a ${hasTime ? 'duration' : 'distance'} greater than zero.`,
            })
        }
        if (item.speedKmh !== null && (!isPositiveFinite(item.speedKmh) || item.speedKmh < MIN_SPEED || item.speedKmh > MAX_SPEED)) {
            issues.push({
                sectionId: item.id,
                message: `${item.label} has an invalid speed. Clear it or enter a speed from 0.5 to 25 km/h.`,
            })
        }
    }

    for (const item of workout.sections) {
        if (item.target.basis === 'distance' && calculateSectionMetrics(item).durationSeconds === null) {
            issues.push({ sectionId: item.id, message: `${item.label}: a distance target needs known running and walking speeds.` })
        }
        if (item.runWalk && (!isPositiveFinite(item.runWalk.runSeconds) || !isPositiveFinite(item.runWalk.walkSeconds)
            || item.runWalk.runSeconds < 1 || item.runWalk.walkSeconds < 1
            || (item.runWalk.walkSpeedKmh !== null && (!isPositiveFinite(item.runWalk.walkSpeedKmh)
                || item.runWalk.walkSpeedKmh < MIN_SPEED || item.runWalk.walkSpeedKmh > MAX_SPEED)))) {
            issues.push({ sectionId: item.id, message: `${item.label}: intervals must last at least one second; walking speed must be 0.5–25 km/h or unknown.` })
        }
    }

    const totals = calculateWorkoutTotals(workout.sections)

    // Limits also apply to edited and restored plans, not only generated defaults.
    if (workout.category === 'long' && totals.durationSeconds !== null
        && totals.durationSeconds > LONG_RUN_MAX_SECONDS + 0.01) {
        issues.push({ message: 'The whole workout, including warm-up and cool-down, must fit within the VDOT model’s long-run time limit.' })
    }
    // Interval and repetition running have a hard session cap; threshold volume is guidance, not a ceiling.
    const weekly = workout.baseline.weeklyKm
    const capZone = workout.category === 'interval' ? 'I' : workout.category === 'repetition' ? 'R' : null
    if (weekly && capZone) {
        let workKm = 0
        let known = true
        for (const item of workout.sections.filter(s => s.type === 'run')) {
            const seconds = calculateSectionMetrics(item).durationSeconds
            if (seconds === null || item.speedKmh === null) { known = false; continue }
            const mix = item.runWalk
            const cycle = mix ? mix.runSeconds + mix.walkSeconds : 0
            const workSeconds = mix
                ? Math.floor(seconds / cycle) * mix.runSeconds + Math.min(seconds % cycle, mix.runSeconds)
                : seconds
            workKm += distanceFromSpeed(item.speedKmh, workSeconds)
        }
        const cap = sessionCapKm(capZone, weekly)
        if (known && workKm > cap + 1e-8) {
            issues.push({ message: `The hard reps exceed your session allowance of ${cap.toFixed(2)} km. Shorten the work block or choose an easier workout.` })
        }
    }

    return { ok: issues.length === 0, issues }
}

