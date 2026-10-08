import { roundSpeedUp, speedFromPaceSecondsPerKm } from './convert'
import type { PlanSection } from './types'

/** Editing speed keeps the section's own target, so the basis never flips. */
export function setSectionSpeed(
    item: PlanSection,
    speedKmh: number | null,
): PlanSection {
    return { ...item, speedKmh: speedKmh === null ? null : roundSpeedUp(speedKmh) }
}

export function setSectionPace(
    item: PlanSection,
    paceSecondsPerKm: number | null,
): PlanSection {
    return {
        ...item,
        speedKmh:
            paceSecondsPerKm && paceSecondsPerKm > 0
                ? roundSpeedUp(speedFromPaceSecondsPerKm(paceSecondsPerKm))
                : null,
    }
}

export function setSectionTargetValue(
    item: PlanSection,
    value: number,
): PlanSection {
    return {
        ...item,
        target:
            item.target.basis === 'time'
                ? { basis: 'time', durationSeconds: value }
                : { basis: 'distance', distanceKm: value },
    }
}
