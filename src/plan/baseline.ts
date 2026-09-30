import {
    isPositiveFinite,
    speedFromDistanceDuration,
    speedFromPaceSecondsPerKm,
} from './convert'
import type { BaselineAnswers, PersonalBaseline, SectionTarget } from './types'

export type BaselineField =
    | 'capacity'
    | 'continuity'
    | 'pace'
    | 'walkPace'
    | 'available'

/** Which follow-up questions still need asking, so we can skip the rest. */
export function missingBaselineFields(
    answers: BaselineAnswers,
): BaselineField[] {
    const fields: BaselineField[] = []
    const hasCapacity =
        (answers.capacityBasis === 'distance' &&
            isPositiveFinite(answers.capacityDistanceKm)) ||
        (answers.capacityBasis === 'time' &&
            isPositiveFinite(answers.capacityMinutes))
    if (!hasCapacity) fields.push('capacity')
    if (answers.continuity === undefined) fields.push('continuity')
    if (answers.paceKnown === undefined) fields.push('pace')
    if (answers.continuity === 'run-walk' && answers.walkPaceKnown === undefined) {
        fields.push('walkPace')
    }
    if (!isPositiveFinite(answers.availableMinutes)) fields.push('available')
    return fields
}


function paceToSpeed(
    minutes: number | undefined,
    seconds: number | undefined,
): number | null {
    const sec = seconds ?? 0
    if (!Number.isInteger(sec) || sec < 0 || sec > 59) return null
    const total = (minutes ?? 0) * 60 + sec
    return isPositiveFinite(total) ? speedFromPaceSecondsPerKm(total) : null
}

/**
 * Works out a comfortable running speed, or admits it does not know one.
 * A distance on its own never produces a speed.
 */
export function derivePersonalBaseline(
    answers: BaselineAnswers,
): PersonalBaseline {
    const missing: string[] = []

    let speedKmh: number | null = null
    let speedSource: PersonalBaseline['speedSource'] = 'unknown'

    if (answers.paceKnown) {
        speedKmh = paceToSpeed(answers.paceMinutes, answers.paceSeconds)
        if (speedKmh) {
            speedSource = 'reported-pace'
        } else {
            missing.push('A comfortable pace with seconds between 00 and 59')
        }
    }

    // A known distance plus the time it takes gives us a speed.
    if (
        speedKmh === null &&
        isPositiveFinite(answers.capacityDistanceKm) &&
        isPositiveFinite(answers.capacityTimeMinutes)
    ) {
        speedKmh = speedFromDistanceDuration(
            answers.capacityDistanceKm,
            answers.capacityTimeMinutes * 60,
        )
        speedSource = 'distance-and-time'
    }

    if (speedKmh === null) {
        missing.push('Your comfortable running pace, or a distance with its time')
    }

    let comfortableCapacity: SectionTarget | null = null
    if (
        answers.capacityBasis === 'distance' &&
        isPositiveFinite(answers.capacityDistanceKm)
    ) {
        comfortableCapacity = {
            basis: 'distance',
            distanceKm: answers.capacityDistanceKm,
        }
    } else if (
        answers.capacityBasis === 'time' &&
        isPositiveFinite(answers.capacityMinutes)
    ) {
        comfortableCapacity = {
            basis: 'time',
            durationSeconds: Math.round(answers.capacityMinutes * 60),
        }
    } else {
        missing.push('How far or how long you can currently run comfortably')
    }

    const continuity = answers.continuity ?? 'continuous'

    let walkSpeedKmh: number | null = null
    if (continuity === 'run-walk') {
        if (answers.walkPaceKnown) {
            walkSpeedKmh = paceToSpeed(
                answers.walkPaceMinutes,
                answers.walkPaceSeconds,
            )
        }
        if (walkSpeedKmh === null) {
            missing.push('Your comfortable walking pace')
        }
    }

    const availableSeconds = isPositiveFinite(answers.availableMinutes)
        ? Math.round(answers.availableMinutes * 60)
        : null
    if (availableSeconds === null) {
        missing.push('How much total time you have for this workout')
    }

    return {
        speedKmh,
        speedSource,
        comfortableCapacity,
        continuity,
        walkSpeedKmh,
        availableSeconds,
        missing,
    }
}
