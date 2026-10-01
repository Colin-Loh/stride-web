/**
 * Jack Daniels and Jimmy Gilbert's running equations, as used by VDOT calculators such as
 * https://www.brenoamelo.com/blog/vdot-pace-chart-printable. The equations work in
 * metres per minute and minutes, as published; everything exported here speaks km/h,
 * km and seconds like the rest of the app.
 */

/** Oxygen cost (ml/kg/min) of running at a velocity in metres per minute. */
export function oxygenCost(metresPerMinute: number): number {
    return -4.6 + 0.182258 * metresPerMinute + 0.000104 * metresPerMinute ** 2
}

/** Fraction of VO2max a runner can hold for an all-out effort lasting this many minutes. */
export function sustainableFraction(minutes: number): number {
    return 0.8 + 0.1894393 * Math.exp(-0.012778 * minutes) + 0.2989558 * Math.exp(-0.1932605 * minutes)
}

/** Velocity in metres per minute whose oxygen cost is `vo2`: oxygenCost, inverted. */
function velocityForOxygenCost(vo2: number): number {
    const a = 0.000104
    const b = 0.182258
    const c = -4.6 - vo2
    return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)
}

const kmhFromMetresPerMinute = (v: number) => (v * 60) / 1000
const metresPerMinuteFromKmh = (kmh: number) => (kmh * 1000) / 60

/** VDOT from an all-out race or time trial. */
export function vdotFromRace(distanceKm: number, seconds: number): number {
    const minutes = seconds / 60
    return oxygenCost((distanceKm * 1000) / minutes) / sustainableFraction(minutes)
}

/** Predicted all-out time in seconds over a distance: the time whose VDOT matches. */
export function predictRaceSeconds(vdot: number, distanceKm: number): number {
    // A slower time always means a lower VDOT, so bisect between absurdly fast and slow paces.
    let fast = distanceKm * 60
    let slow = distanceKm * 1200
    for (let i = 0; i < 60; i++) {
        const mid = (fast + slow) / 2
        if (vdotFromRace(distanceKm, mid) > vdot) fast = mid
        else slow = mid
    }
    return (fast + slow) / 2
}

/**
 * Fractions of VDOT for each training zone. These are the values that reproduce Daniels'
 * published pace tables (checked in vdot.test.ts): Easy runs from 62% to 70%, Threshold
 * sits at 88%. Repetition pace is not a fixed fraction in the tables -- it tracks
 * predicted mile race pace instead, so it is computed from predictRaceSeconds.
 */
export const DANIELS_ZONES = {
    easySlow: 0.62,
    easyFast: 0.7,
    threshold: 0.88,
} as const

const MILE_KM = 1.609344

export interface DanielsSpeeds {
    /** Slow end of the Easy range. */
    easySlowKmh: number
    /** Fast end of the Easy range. */
    easyFastKmh: number
    thresholdKmh: number
    /** Repetition pace: predicted mile race pace. */
    repetitionKmh: number
}

export function speedAtFraction(vdot: number, fraction: number): number {
    return kmhFromMetresPerMinute(velocityForOxygenCost(vdot * fraction))
}

export function danielsSpeeds(vdot: number): DanielsSpeeds {
    return {
        easySlowKmh: speedAtFraction(vdot, DANIELS_ZONES.easySlow),
        easyFastKmh: speedAtFraction(vdot, DANIELS_ZONES.easyFast),
        thresholdKmh: speedAtFraction(vdot, DANIELS_ZONES.threshold),
        repetitionKmh: (MILE_KM / predictRaceSeconds(vdot, MILE_KM)) * 3600,
    }
}

/**
 * VDOT estimated from an easy pace alone, reading it as the fast end of the Easy range.
 * That is the conservative reading: it gives the lowest VDOT the pace allows, so
 * threshold and rep paces err slower rather than faster. A race result is better.
 */
export function vdotFromEasySpeed(easySpeedKmh: number): number {
    return oxygenCost(metresPerMinuteFromKmh(easySpeedKmh)) / DANIELS_ZONES.easyFast
}

/**
 * VDOTs outside this range are almost certainly a typo, or a walk rather than a run.
 * The published tables cover 30-85; slower recreational runners sit in the low 20s.
 */
export const VDOT_RANGE = { min: 15, max: 85 } as const

export const RACE_DISTANCES: { km: number; label: string }[] = [
    { km: MILE_KM, label: '1 mile' },
    { km: 3, label: '3 km' },
    { km: 5, label: '5 km' },
    { km: 10, label: '10 km' },
    { km: 15, label: '15 km' },
    { km: 21.0975, label: 'Half marathon' },
    { km: 42.195, label: 'Marathon' },
]

export function raceLabel(distanceKm: number): string {
    return RACE_DISTANCES.find((race) => Math.abs(race.km - distanceKm) < 1e-6)?.label ?? `${distanceKm} km`
}
