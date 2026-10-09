import { roundSpeedUp } from './convert'
import { ZONES, type TrainingSpeeds, type Zone } from './vdot'

/** Distance targets round down to 0.1 km, never to zero. */
export const tenthOfKm = (km: number) => Math.max(0.1, Math.floor(km * 10) / 10)

export const roundedOrNull = (speedKmh: number | null) => (speedKmh === null ? null : roundSpeedUp(speedKmh))

/** Treadmill speeds for every zone, rounded up like every other generated speed. */
export function roundedSpeeds(speeds: TrainingSpeeds | null): Record<Zone, number | null> {
    const zones = Object.keys(ZONES) as Zone[]
    return Object.fromEntries(zones.map((zone) => [zone, roundedOrNull(speeds?.[zone] ?? null)])) as Record<Zone, number | null>
}
