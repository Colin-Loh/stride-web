import type { ResolvedWorkout, SegmentKind } from '../workouts'
import { calculateSectionMetrics, calculateWorkoutTotals } from './generate'
import type { PersonalizedWorkout } from './types'

const KIND: Record<'warmup' | 'run' | 'cooldown', SegmentKind> = {
    warmup: 'warmup',
    run: 'steady',
    cooldown: 'cooldown',
}

/**
 * Adapts a generated plan into the shape RunScreen already consumes. Returns
 * null when a speed is missing, because the run screen is distance-driven and
 * cannot track a section whose distance is unknown.
 */
export function toResolvedWorkout(
    workout: PersonalizedWorkout,
): ResolvedWorkout | null {
    const segments = workout.sections.map((item) => {
        const metrics = calculateSectionMetrics(item)
        if (
            metrics.speedKmh === null ||
            metrics.distanceKm === null ||
            metrics.durationSeconds === null
        ) {
            return null
        }
        return {
            kind: KIND[item.type],
            label: item.label,
            distanceKm: metrics.distanceKm,
            speed: { minKmh: metrics.speedKmh, maxKmh: metrics.speedKmh },
            midKmh: metrics.speedKmh,
            durationMs: metrics.durationSeconds * 1000,
        }
    })

    if (segments.some((segment) => segment === null)) return null
    const resolved = segments as NonNullable<(typeof segments)[number]>[]
    const totals = calculateWorkoutTotals(workout.sections)

    return {
        id: workout.category,
        name: `${workout.categoryName} · tailored`,
        blurb: workout.explanation[0] ?? '',
        segments: resolved,
        totalDistanceKm: totals.distanceKm ?? 0,
        totalDurationMs: (totals.durationSeconds ?? 0) * 1000,
    }
}
