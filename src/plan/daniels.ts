/**
 * Jack Daniels' VDOT model -- the ONE place where the app's training maths lives.
 *
 * Edit the constants in the sections below to change the model. Nothing else in the codebase
 * may hold a pace, intensity, volume or plan-structure number. This file is pure: no React,
 * no storage, no side effects. Units at the boundary are km, seconds and km/h; the Daniels-Gilbert
 * equations themselves work in metres per minute and minutes, so those stay internal.
 *
 * THE MODEL
 *   1. A race (or time trial) of distance d metres in t minutes has velocity v = d / t and an
 *      oxygen cost C(v) = -4.60 + 0.182258 v + 0.000104 v^2 (ml O2 / kg / min).
 *   2. A runner can hold only a fraction F(t) of their maximum for t minutes:
 *      F(t) = 0.8 + 0.1894393 e^(-0.012778 t) + 0.2989558 e^(-0.1932605 t).
 *   3. VDOT = C(v) / F(t). It is a performance-derived index, NOT laboratory VO2max.
 *   4. Equivalent race times are found by inverting (3) numerically for a distance.
 *   5. Training paces: E, T and I are the speed whose oxygen cost is a fixed fraction of VDOT.
 *      M and R are the paces of an equivalent marathon and an equivalent mile race.
 *   6. Session sizes are capped as a share of weekly distance (see VOLUME_LIMITS).
 *
 * SOURCES (numbers refer to /stride-agents/output/vdot-research.md)
 *   [1] https://vdoto2.com/calculator                      official zones, intensities, purposes
 *   [2] https://run.grow-lytics.com/vdot-calculator        equation constants and units
 *   [3] https://github.com/0jonjo/calcpace                 independent reproduction of [2]
 *   [4] https://support.vdoto2.com/v-o2-faq/               VDOT is current fitness, not a goal
 *   [5] https://vdoto2.com/learn-more/training-definitions Daniels' E/M/T/I/R volume limits
 *   [6] https://whynot.run/tools/vdot-calculator/          secondary pace anchors (cross-check only)
 *   [11] https://support.vdoto2.com/vdot-adaptive-trainer-instructional-guide/  training effort
 *   [13] https://www.coacheseducation.com/endur/jack-daniels-dec-00.php         24-week season
 *
 * KNOWN GAPS (spec section "Confidence and gaps"): the official calculator's exact pace
 * interpolation and rounding, the easy-pace to VDOT mapping, heat and altitude corrections, and
 * short-plan phase lengths are unpublished. They are NOT modelled here; see the TODO(verify) notes.
 */

// ---------------------------------------------------------------------------------------------
// 1. Units
// ---------------------------------------------------------------------------------------------

const METRES_PER_KM = 1000
const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3600
const MILE_KM = 1.609344
const HALF_MARATHON_KM = 21.0975
const MARATHON_KM = 42.195

// ---------------------------------------------------------------------------------------------
// 2. Equations [2][3]
// ---------------------------------------------------------------------------------------------

/** C(v) = intercept + linear v + quadratic v^2, v in metres per minute. */
const OXYGEN_COST = { intercept: -4.6, linear: 0.182258, quadratic: 0.000104 } as const

/** F(t) = floor + slow e^(-slow.decay t) + fast e^(-fast.decay t), t in minutes. */
const DURATION_FRACTION = {
    floor: 0.8,
    slow: { weight: 0.1894393, decay: 0.012778 },
    fast: { weight: 0.2989558, decay: 0.1932605 },
} as const

/**
 * Bracket for the numeric inversion of VDOT(t) at a fixed distance. This is a numerical search
 * window (1:00 to 20:00 per km), not physiology; inputs outside it are rejected, not extrapolated.
 */
const SOLVER = { minSecondsPerKm: 60, maxSecondsPerKm: 1200, iterations: 60 } as const

/**
 * Rows printed in the published VDOT tables [22]. The equations are not limited to this range,
 * so a VDOT outside it is allowed but flagged as extrapolated, never rejected.
 */
const PUBLISHED_TABLE_VDOT = { min: 30, max: 85 } as const

// ---------------------------------------------------------------------------------------------
// 3. Race distances offered for entering a result [9][10]
// ---------------------------------------------------------------------------------------------

interface RaceDistance {
    km: number
    label: string
}

/** Presets from 1500 m to the marathon. */
export const RACE_DISTANCES: readonly RaceDistance[] = [
    { km: 1.5, label: '1500 m' },
    { km: MILE_KM, label: '1 mile' },
    { km: 3, label: '3 km' },
    { km: 5, label: '5 km' },
    { km: 10, label: '10 km' },
    { km: 15, label: '15 km' },
    { km: HALF_MARATHON_KM, label: 'Half marathon' },
    { km: MARATHON_KM, label: 'Marathon' },
]

// ---------------------------------------------------------------------------------------------
// 4. Training zones [1][5]
// ---------------------------------------------------------------------------------------------

export type Zone = 'E' | 'M' | 'T' | 'I' | 'R'

type ZonePace =
    /** Speed whose oxygen cost is this fraction of VDOT. */
    | { kind: 'vdot-fraction'; fraction: number }
    /** Average speed of the equivalent race over this distance. */
    | { kind: 'race-equivalent'; distanceKm: number }

interface ZoneDefinition {
    name: string
    pace: ZonePace
    /** Official percent of VO2max and of HRmax; null where the source publishes none. */
    vo2MaxPercent: readonly [number, number] | null
    hrMaxPercent: readonly [number, number] | null
    /** What the zone is for, in plain words. */
    purpose: string
}

/**
 * Pace fractions are calibrated against the anchor rows in the spec [6] (VDOT 30/40/50/60, see
 * daniels.test.ts) and sit inside the official intensity ranges: E 70% (range 59-74), T 88%
 * (top of 83-88), I 97% (bottom of 97-100). M and R are race equivalents, because the official
 * R intensity is unpublished and M tables are best obtained from the marathon equivalent [1][2].
 * TODO(verify): the official calculator's exact pace interpolation and rounding.
 */
export const ZONES: Record<Zone, ZoneDefinition> = {
    E: {
        name: 'Easy',
        pace: { kind: 'vdot-fraction', fraction: 0.7 },
        vo2MaxPercent: [59, 74],
        hrMaxPercent: [65, 79],
        purpose: 'Aerobic base and recovery. Conversational; slower is always allowed.',
    },
    M: {
        name: 'Marathon',
        pace: { kind: 'race-equivalent', distanceKm: MARATHON_KM },
        vo2MaxPercent: [75, 84],
        hrMaxPercent: [80, 90],
        purpose: 'Marathon rhythm at your current fitness, not an aspirational goal pace.',
    },
    T: {
        name: 'Threshold',
        pace: { kind: 'vdot-fraction', fraction: 0.88 },
        vo2MaxPercent: [83, 88],
        hrMaxPercent: [88, 92],
        purpose: 'Comfortably hard, about a one-hour race effort. Builds endurance and lactate clearance.',
    },
    I: {
        name: 'Interval',
        pace: { kind: 'vdot-fraction', fraction: 0.97 },
        vo2MaxPercent: [97, 100],
        hrMaxPercent: [98, 100],
        purpose: 'Hard but not all-out, about a 10-12 minute race effort. Builds aerobic power.',
    },
    R: {
        name: 'Repetition',
        pace: { kind: 'race-equivalent', distanceKm: MILE_KM },
        vo2MaxPercent: null,
        hrMaxPercent: null,
        // TODO(verify): the spec says R is "~current 1500 m / mile race pace"; no official intensity exists.
        purpose: 'Short, fast, fully recovered reps near mile pace for speed and economy. Do not use heart rate.',
    },
}

// ---------------------------------------------------------------------------------------------
// 5. Volume limits [5]
// ---------------------------------------------------------------------------------------------

/** Daniels caps M, I and R running per session at the lesser of a share of the week or a distance. */
const SESSION_VOLUME_LIMITS: Record<'M' | 'I' | 'R', { shareOfWeek: number; maxKm: number }> = {
    M: { shareOfWeek: 0.2, maxKm: 18 * MILE_KM },
    I: { shareOfWeek: 0.08, maxKm: 10 },
    R: { shareOfWeek: 0.05, maxKm: 5 * MILE_KM },
}

/**
 * Long easy run: lesser of a share of the week or a duration.
 * TODO(verify): the source says "25-30%"; the conservative 25% is used for every weekly distance.
 */
const LONG_RUN_LIMITS = { shareOfWeek: 0.25, maxSeconds: 150 * SECONDS_PER_MINUTE } as const

/**
 * Threshold: a steady block of about 20 minutes, or about 10% of the week when that is shorter.
 * It is guidance, not a hard ceiling, for higher-mileage runners, so the app never enforces it.
 */
const THRESHOLD_LIMITS = { steadySeconds: 20 * SECONDS_PER_MINUTE, shareOfWeek: 0.1 } as const

// ---------------------------------------------------------------------------------------------
// 6. Session structure
// ---------------------------------------------------------------------------------------------

/** Plan-structure choices drawn from the ranges the source gives. */
export const SESSION_STRUCTURE = {
    /**
     * Easy run length when the week is unknown: the 30-45 minutes of "conversational" running
     * [1][5]; a long run with no known pace uses the top of that range.
     */
    easyFallbackSeconds: 30 * SECONDS_PER_MINUTE,
    longFallbackSeconds: 45 * SECONDS_PER_MINUTE,
    /** TODO(verify): the only warm-up length in the source is the "10 min E" before M running. */
    warmupSeconds: 10 * SECONDS_PER_MINUTE,
    cooldownSeconds: 10 * SECONDS_PER_MINUTE,
    /** Cruise intervals: T reps of 5-15 minutes with 1-3 minutes of rest; the short ends are used. */
    cruise: { repSeconds: 5 * SECONDS_PER_MINUTE, recoverySeconds: SECONDS_PER_MINUTE, minReps: 2 },
    /** Interval reps: 3-5 minutes of work with a jog of equal length. */
    interval: { repSeconds: 3 * SECONDS_PER_MINUTE, recoveryPerWorkSecond: 1 },
    /** TODO(verify): rep count for an I session when no VDOT is known and the cap cannot be sized. */
    intervalFallbackReps: 4,
} as const

interface TrainingEffort {
    id: 'base' | 'base_quality' | 'advanced_quality'
    label: string
    /** Speed days per week, in addition to the long run [11]. */
    qualitySessions: 0 | 1 | 2
}

export const TRAINING_EFFORTS: readonly TrainingEffort[] = [
    { id: 'base', label: 'Base: easy running and a long run only', qualitySessions: 0 },
    { id: 'base_quality', label: 'Base Quality: a long run and one speed day', qualitySessions: 1 },
    { id: 'advanced_quality', label: 'Advanced Quality: a long run and two speed days', qualitySessions: 2 },
]

/** TODO(verify): the official focus list is unpublished; these are the common race distances plus Base. */
export const TRAINING_FOCUSES: readonly { id: string; label: string }[] = [
    { id: 'base', label: 'Base fitness' },
    { id: '5k', label: '5K' },
    { id: '10k', label: '10K' },
    { id: 'half_marathon', label: 'Half marathon' },
    { id: 'marathon', label: 'Marathon' },
]

interface SeasonPhase {
    name: string
    summary: string
}

/** Daniels' idealised 24-week season: four phases of about six weeks [13]. */
const IDEAL_SEASON = {
    weeks: 24,
    phaseWeeks: 6,
    phases: [
        { name: 'Foundation', summary: 'easy running to build durability' },
        { name: 'Early Quality', summary: 'repetition work for mechanics and economy' },
        { name: 'Transition Quality', summary: 'long interval repeats, usually the hardest phase' },
        { name: 'Final Quality', summary: 'threshold work and racing, few if any I or R sessions' },
    ] as readonly SeasonPhase[],
} as const

// ---------------------------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------------------------

const isPositiveFinite = (value: number): boolean => Number.isFinite(value) && value > 0

const speedKmhFromMetresPerMinute = (metresPerMinute: number): number =>
    (metresPerMinute * SECONDS_PER_MINUTE) / METRES_PER_KM

/** Oxygen cost (ml/kg/min) of running at a velocity in metres per minute. */
export function oxygenCost(metresPerMinute: number): number {
    const { intercept, linear, quadratic } = OXYGEN_COST
    return intercept + linear * metresPerMinute + quadratic * metresPerMinute ** 2
}

/** Fraction (0-1, not a percentage) of maximum a runner can sustain for this many minutes. */
export function sustainableFraction(minutes: number): number {
    const { floor, slow, fast } = DURATION_FRACTION
    return floor + slow.weight * Math.exp(-slow.decay * minutes) + fast.weight * Math.exp(-fast.decay * minutes)
}

/** Velocity (metres per minute) whose oxygen cost is `vo2`: the positive root of C(v) = vo2. */
function velocityForOxygenCost(vo2: number): number {
    const { intercept, linear, quadratic } = OXYGEN_COST
    return (-linear + Math.sqrt(linear ** 2 - 4 * quadratic * (intercept - vo2))) / (2 * quadratic)
}

/** VDOT of a race or time trial from its elapsed time, or null when the inputs are not physical. */
export function vdotFromRace(distanceKm: number, seconds: number): number | null {
    if (!isPositiveFinite(distanceKm) || !isPositiveFinite(seconds)) return null
    const minutes = seconds / SECONDS_PER_MINUTE
    const vdot = oxygenCost((distanceKm * METRES_PER_KM) / minutes) / sustainableFraction(minutes)
    return isPositiveFinite(vdot) ? vdot : null
}

/**
 * Equivalent race time in seconds over a distance: the time whose VDOT matches. These are
 * physiological equivalences, not predictions [20]. Null when the answer falls outside SOLVER.
 */
export function predictRaceSeconds(vdot: number, distanceKm: number): number | null {
    if (!isPositiveFinite(vdot) || !isPositiveFinite(distanceKm)) return null
    let fast = distanceKm * SOLVER.minSecondsPerKm
    let slow = distanceKm * SOLVER.maxSecondsPerKm
    const fastVdot = vdotFromRace(distanceKm, fast)
    const slowVdot = vdotFromRace(distanceKm, slow)
    if (fastVdot === null || slowVdot === null || vdot > fastVdot || vdot < slowVdot) return null
    for (let i = 0; i < SOLVER.iterations; i++) {
        const middle = (fast + slow) / 2
        // A slower time always means a lower VDOT, so the match is on the slower side of a higher VDOT.
        if ((vdotFromRace(distanceKm, middle) ?? 0) > vdot) fast = middle
        else slow = middle
    }
    return (fast + slow) / 2
}

/** True when a VDOT lies outside the published tables, so its paces are extrapolated. */
export function isExtrapolatedVdot(vdot: number): boolean {
    return vdot < PUBLISHED_TABLE_VDOT.min || vdot > PUBLISHED_TABLE_VDOT.max
}

export type TrainingSpeeds = Record<Zone, number>

/** Training speeds in km/h for every zone, or null when the VDOT cannot be turned into paces. */
export function trainingSpeedsKmh(vdot: number): TrainingSpeeds | null {
    if (!isPositiveFinite(vdot)) return null
    const speeds: Partial<TrainingSpeeds> = {}
    for (const zone of Object.keys(ZONES) as Zone[]) {
        const pace = ZONES[zone].pace
        if (pace.kind === 'vdot-fraction') {
            speeds[zone] = speedKmhFromMetresPerMinute(velocityForOxygenCost(vdot * pace.fraction))
        } else {
            const seconds = predictRaceSeconds(vdot, pace.distanceKm)
            if (seconds === null) return null
            speeds[zone] = (pace.distanceKm / seconds) * SECONDS_PER_HOUR
        }
    }
    return speeds as TrainingSpeeds
}

/** Most M, I or R running Daniels allows in one session: the lesser of a share of the week or a distance. */
export function sessionCapKm(zone: 'M' | 'I' | 'R', weeklyKm: number): number {
    const limit = SESSION_VOLUME_LIMITS[zone]
    return Math.min(weeklyKm * limit.shareOfWeek, limit.maxKm)
}

/** Longest easy long run in km: the lesser of a share of the week or 150 minutes at easy pace. */
export function longRunCapKm(weeklyKm: number, easySpeedKmh: number | null): number {
    const byShare = weeklyKm * LONG_RUN_LIMITS.shareOfWeek
    return easySpeedKmh === null ? byShare : Math.min(byShare, (easySpeedKmh * LONG_RUN_LIMITS.maxSeconds) / SECONDS_PER_HOUR)
}

/** Longest long run in seconds. Used to check whole workouts, including edited ones. */
export const LONG_RUN_MAX_SECONDS = LONG_RUN_LIMITS.maxSeconds

/** Length of a steady threshold block: 20 minutes, or 10% of the week at threshold pace if shorter. */
export function thresholdSessionSeconds(weeklyKm: number | null, thresholdSpeedKmh: number | null): number {
    if (weeklyKm === null || thresholdSpeedKmh === null) return THRESHOLD_LIMITS.steadySeconds
    const byShare = ((weeklyKm * THRESHOLD_LIMITS.shareOfWeek) / thresholdSpeedKmh) * SECONDS_PER_HOUR
    return Math.min(THRESHOLD_LIMITS.steadySeconds, byShare)
}

/** Speed days per week for a training effort id, in addition to the long run. */
export function qualitySessionsPerWeek(effortId: string): number {
    return TRAINING_EFFORTS.find((effort) => effort.id === effortId)?.qualitySessions ?? 0
}

/**
 * Where a runner sits in Daniels' ideal 24-week season, counting back from the goal race.
 * Null outside the 24 weeks. TODO(verify): the source says shorter or event-specific plans must
 * be adapted rather than split into equal blocks, so treat this as a rough guide.
 */
export function seasonPhase(weeksToGoal: number): SeasonPhase | null {
    if (!(weeksToGoal > 0 && weeksToGoal <= IDEAL_SEASON.weeks)) return null
    const index = Math.floor((IDEAL_SEASON.weeks - weeksToGoal) / IDEAL_SEASON.phaseWeeks)
    return IDEAL_SEASON.phases[index] ?? null
}
