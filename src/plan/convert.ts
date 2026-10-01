
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

function pad2(value: number): string {
    return String(value).padStart(2, '0')
}

export function formatPaceSeconds(paceSeconds: number): string {
    const minutes = Math.floor(paceSeconds / 60)
    return `${minutes}:${pad2(paceSeconds % 60)}`
}

/** Human-readable duration for the plan UI. */
export function formatSpan(durationSeconds: number): string {
    const total = Math.max(0, Math.round(durationSeconds))
    const minutes = Math.floor(total / 60)
    const seconds = total % 60
    if (minutes === 0) return `${seconds} sec`
    return seconds === 0 ? `${minutes} min` : `${minutes}:${pad2(seconds)} min`
}

/** Treadmill settings round upward, with a tolerance for binary float noise. */
export function roundSpeedUp(speed: number): number {
    return Math.ceil(speed * 10 - 1e-9) / 10
}
export const MIN_SPEED = 0.5
export const MAX_SPEED = 25
export function clampSpeed(speed: number): number {
    return Math.min(MAX_SPEED, Math.max(MIN_SPEED, roundSpeedUp(speed)))
}
/** Race time as m:ss or h:mm:ss. */
export function formatDuration(totalSeconds: number): string {
    const total = Math.round(totalSeconds)
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const seconds = total % 60
    return hours > 0 ? `${hours}:${pad2(minutes)}:${pad2(seconds)}` : `${minutes}:${pad2(seconds)}`
}
/** Parses m:ss or h:mm:ss into seconds; null for anything else. */
export function parseDuration(value: string): number | null {
    const match = /^(?:(\d+):([0-5]\d)|(\d+)):([0-5]\d)$/.exec(value.trim())
    if (!match) return null
    const total = match[1] !== undefined
        ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[4])
        : Number(match[3]) * 60 + Number(match[4])
    return isPositiveFinite(total) ? total : null
}
export function parsePace(value: string): number | null {
    const match = /^(\d+):([0-5]\d)$/.exec(value.trim())
    if (!match) return null
    const total = Number(match[1]) * 60 + Number(match[2])
    return isPositiveFinite(total) ? total : null
}
