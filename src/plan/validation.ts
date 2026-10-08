import { isPositiveFinite, MIN_SPEED, MAX_SPEED } from './convert'
import { calculateSectionMetrics, calculateWorkoutTotals } from './metrics'
import { DANIELS_VOLUME } from './rules'
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
    const available = workout.baseline.availableSeconds
    if (workout.category !== 'test' && available && totals.durationSeconds && totals.durationSeconds > available + 0.01) {
        issues.push({
            message: `This workout is ${Math.round((totals.durationSeconds - available) / 60)} min longer than the time you said you have. Shorten a section or allow more time.`,
        })
    }

    // Limits also apply to edited and restored plans, not only generated defaults.
    if (['easy', 'long'].includes(workout.category) && totals.durationSeconds !== null
        && totals.durationSeconds > DANIELS_VOLUME.longMaxSeconds + 0.01) {
        issues.push({ message: 'The whole workout, including warm-up and cool-down, must fit within 150 minutes.' })
    }
    const weekly = workout.baseline.weeklyKm
    if (weekly && ['tempo', 'cruise', 'interval'].includes(workout.category)) {
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
            workKm += item.speedKmh * workSeconds / 3600
        }
        const fast = workout.category === 'interval'
        const cap = fast ? Math.min(weekly * DANIELS_VOLUME.repetitionShareOfWeek, DANIELS_VOLUME.repetitionMaxKm)
            : weekly * DANIELS_VOLUME.thresholdShareOfWeek
        if (known && workKm > cap + 1e-8) {
            issues.push({ message: `The working repetitions exceed your weekly allowance of ${cap.toFixed(2)} km. Shorten the work block or choose an easier workout; minimum session sizes do not override this limit.` })
        }
    }

    return { ok: issues.length === 0, issues }
}

