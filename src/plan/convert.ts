export const KM_PER_MILE = 1.60934

export function isPositiveFinite(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function distanceFromSpeed(
    speedKmh: number,
    durationSeconds: number,
): number {
    return (speedKmh * durationSeconds) / 3600
}

export function durationFromDistance(
    distanceKm: number,
    speedKmh: number,
): number {
    return (distanceKm / speedKmh) * 3600
}

export function speedFromDistanceDuration(
    distanceKm: number,
    durationSeconds: number,
): number {
    return (distanceKm / durationSeconds) * 3600
}

export function speedFromPaceSecondsPerKm(paceSecondsPerKm: number): number {
    return 3600 / paceSecondsPerKm
}

export function paceSecondsPerKmFromSpeed(speedKmh: number): number {
    return Math.round(3600 / speedKmh)
}

export function paceSecondsPerMileFromSpeed(speedKmh: number): number {
    return Math.round((3600 * KM_PER_MILE) / speedKmh)
}

export function milesToKm(miles: number): number {
    return miles * KM_PER_MILE
}

export function mphToKmh(speedMph: number): number {
    return speedMph * KM_PER_MILE
}

function pad2(value: number): string {
    return String(value).padStart(2, '0')
}

export function formatPaceSeconds(paceSeconds: number): string {
    const minutes = Math.floor(paceSeconds / 60)
    return `${minutes}:${pad2(paceSeconds % 60)}`
}

/** min/km, or null when the speed is unknown. */
export function formatPacePerKm(speedKmh: number | null): string | null {
    if (!isPositiveFinite(speedKmh)) return null
    return formatPaceSeconds(paceSecondsPerKmFromSpeed(speedKmh))
}

/** Human-readable duration for the plan UI. */
export function formatSpan(durationSeconds: number): string {
    const total = Math.max(0, Math.round(durationSeconds))
    const minutes = Math.floor(total / 60)
    const seconds = total % 60
    if (minutes === 0) return `${seconds} sec`
    return seconds === 0 ? `${minutes} min` : `${minutes}:${pad2(seconds)} min`
}
