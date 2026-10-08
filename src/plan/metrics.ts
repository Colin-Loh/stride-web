import { intervalMetrics } from './intervals'
import { isPositiveFinite, paceSecondsPerKmFromSpeed, distanceFromSpeed, durationFromDistance } from './convert'
import type { PlanSection, SectionMetrics, WorkoutTotals } from './types'

export function calculateSectionMetrics(section: PlanSection): SectionMetrics {
    const speedKmh = isPositiveFinite(section.speedKmh) ? section.speedKmh : null
    const paceSecondsPerKm = speedKmh ? paceSecondsPerKmFromSpeed(speedKmh) : null

    if (section.runWalk) {
        const metrics = intervalMetrics(section)
        const average = metrics.seconds && metrics.distance !== null ? metrics.distance * 3600 / metrics.seconds : null
        return {
            durationSeconds: metrics.seconds, distanceKm: metrics.distance, speedKmh,
            paceSecondsPerKm: average ? paceSecondsPerKmFromSpeed(average) : null,
            distanceEstimated: section.target.basis === 'time' && metrics.distance !== null,
            durationEstimated: section.target.basis === 'distance' && metrics.seconds !== null
        }
    }
    if (section.target.basis === 'time') {
        const durationSeconds = section.target.durationSeconds
        return {
            durationSeconds,
            distanceKm: speedKmh ? distanceFromSpeed(speedKmh, durationSeconds) : null,
            speedKmh,
            paceSecondsPerKm,
            distanceEstimated: speedKmh !== null,
            durationEstimated: false,
        }
    }

    const distanceKm = section.target.distanceKm
    return {
        durationSeconds: speedKmh ? durationFromDistance(distanceKm, speedKmh) : null,
        distanceKm,
        speedKmh,
        paceSecondsPerKm,
        distanceEstimated: false,
        durationEstimated: speedKmh !== null,
    }
}

export function calculateWorkoutTotals(sections: PlanSection[]): WorkoutTotals {
    let durationSeconds = 0
    let distanceKm = 0
    let durationComplete = true
    let distanceComplete = true

    for (const section of sections) {
        const metrics = calculateSectionMetrics(section)
        if (metrics.durationSeconds === null) durationComplete = false
        else durationSeconds += metrics.durationSeconds
        if (metrics.distanceKm === null) distanceComplete = false
        else distanceKm += metrics.distanceKm
    }

    const totalDuration = durationComplete ? durationSeconds : null
    const totalDistance = distanceComplete ? distanceKm : null

    // Overall pace comes from the totals, never from averaging section paces.
    const averageSpeedKmh =
        totalDuration && totalDistance && totalDuration > 0
            ? totalDistance / (totalDuration / 3600)
            : null

    return {
        durationSeconds: totalDuration,
        distanceKm: totalDistance,
        distanceComplete,
        averageSpeedKmh,
        paceSecondsPerKm:
            totalDuration && totalDistance && totalDistance > 0
                ? Math.round(totalDuration / totalDistance)
                : null,
    }
}

