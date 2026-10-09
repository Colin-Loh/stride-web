/**
 * VDOT training model -- the ONE place where the app's training maths lives.
 *
 * Edit the constants in the sections below to change the model. Nothing else in the codebase
 * may hold a pace, intensity, volume or plan-structure number. This file is pure: no React,
 * no storage, no side effects. Units at the boundary are km, seconds and km/h; the VDOT
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
 *   7. Weekly distance grows in steps held for several weeks (see PROGRESSION).
 *
 * SOURCES (numbers refer to /stride-agents/output/vdot-research.md)
 *   [1] https://vdoto2.com/calculator                      official zones, intensities, purposes
 *   [2] https://run.grow-lytics.com/vdot-calculator        equation constants and units
 *   [3] https://github.com/0jonjo/calcpace                 independent reproduction of [2]
 *   [4] https://support.vdoto2.com/v-o2-faq/               VDOT is current fitness, not a goal
 *   [5] https://vdoto2.com/learn-more/training-definitions VDOT E/M/T/I/R volume limits
 *   [6] https://whynot.run/tools/vdot-calculator/          secondary pace anchors (cross-check only)
 *   [11] https://support.vdoto2.com/vdot-adaptive-trainer-instructional-guide/  training effort
 *   [13] https://www.coacheseducation.com/endur/jack-daniels-dec-00.php         24-week season
 *   Progression and session constructions refer to /stride-agents/output/progression-research.md
 *   (named "progression-research" below). Its mileage rule comes from
 *   https://news.vdoto2.com/2015/07/how-to-increase-your-weekly-mileage/
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
export const DAYS_PER_WEEK = 7
/** Calendar lengths in milliseconds, for dating plan weeks. */
export const MS_PER_DAY = 24 * SECONDS_PER_HOUR * 1000
export const MS_PER_WEEK = DAYS_PER_WEEK * MS_PER_DAY
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
 * vdot.test.ts) and sit inside the official intensity ranges: E 70% (range 59-74), T 88%
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

/** The VDOT model caps M, I and R running per session at the lesser of a share of the week or a distance. */
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
     * Length of an easy run when its distance is unknown: the 30-45 minutes of "conversational"
     * running [1][5]; a long run with no known pace uses the top of that range.
     */
    easyFallbackSeconds: 30 * SECONDS_PER_MINUTE,
    longFallbackSeconds: 45 * SECONDS_PER_MINUTE,
    /** TODO(verify): the only warm-up length in the source is the "10 min E" before M running. */
    warmupSeconds: 10 * SECONDS_PER_MINUTE,
    cooldownSeconds: 10 * SECONDS_PER_MINUTE,
    /**
     * Interval (I): bouts of 1-5 minutes, ideally 3-5, with a jog of equal or slightly shorter
     * length [progression-research, section 3]. The short end of the ideal range is used, and the
     * bout shrinks towards the 1-minute minimum only when the session cap cannot hold one.
     */
    interval: { repSeconds: 3 * SECONDS_PER_MINUTE, minRepSeconds: SECONDS_PER_MINUTE, recoveryPerWorkSecond: 1 },
    /**
     * Repetition (R): bouts of at most two minutes, typically 200-600 m, with full recovery of
     * about twice the work time [progression-research, section 3]. 400 m is the middle of the
     * typical range; a runner too slow to cover it in two minutes runs the two minutes instead.
     */
    repetition: { repMetres: 400, maxRepSeconds: 120, recoveryPerWorkSecond: 2 },
    /** TODO(verify): rep counts for I and R sessions when no pace is known and the cap cannot be sized. */
    intervalFallbackReps: 4,
    repetitionFallback: { reps: 4, repSeconds: 30 },
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

/** The VDOT model's idealised 24-week season: four phases of about six weeks [13]. */
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

/** Most M, I or R running allowed in one session: the lesser of a share of the week or a distance. */
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
 * Where a runner sits in the VDOT model's ideal 24-week season, counting back from the goal race.
 * Null outside the 24 weeks. TODO(verify): the source says shorter or event-specific plans must
 * be adapted rather than split into equal blocks, so treat this as a rough guide.
 */
export function seasonPhase(weeksToGoal: number): SeasonPhase | null {
    if (!(weeksToGoal > 0 && weeksToGoal <= IDEAL_SEASON.weeks)) return null
    const index = Math.floor((IDEAL_SEASON.weeks - weeksToGoal) / IDEAL_SEASON.phaseWeeks)
    return IDEAL_SEASON.phases[index] ?? null
}

/** The work/recovery repeats of an interval or repetition session. */
export interface RepeatSession {
    reps: number
    repSeconds: number
    recoverySeconds: number
}

/**
 * Size a session of repeats so its work stays inside the zone's cap. `speedKmh` is the (rounded)
 * speed the reps will actually be run at, so the cap holds for the planned numbers. With no pace
 * or no weekly distance the cap cannot be applied and a placeholder is returned.
 */
function sizeRepeats(zone: 'I' | 'R', weeklyKm: number | null, speedKmh: number | null, repSeconds: number, recoveryPerWorkSecond: number): RepeatSession {
    if (speedKmh === null || weeklyKm === null) {
        const reps = zone === 'I' ? SESSION_STRUCTURE.intervalFallbackReps : SESSION_STRUCTURE.repetitionFallback.reps
        return { reps, repSeconds, recoverySeconds: repSeconds * recoveryPerWorkSecond }
    }
    const repKm = (speedKmh * repSeconds) / SECONDS_PER_HOUR
    const capKm = sessionCapKm(zone, weeklyKm)
    const whole = Math.floor(capKm / repKm + 1e-9)
    if (whole >= 1) return { reps: whole, repSeconds, recoverySeconds: repSeconds * recoveryPerWorkSecond }
    // Not even one full rep fits: run one shorter rep that does.
    const minSeconds = zone === 'I' ? SESSION_STRUCTURE.interval.minRepSeconds : 1
    const shorter = Math.max(minSeconds, Math.floor((capKm / speedKmh) * SECONDS_PER_HOUR))
    return { reps: 1, repSeconds: shorter, recoverySeconds: shorter * recoveryPerWorkSecond }
}

/** Interval (I) session: 3-minute bouts at I pace, as many as the I cap allows. */
export function intervalSession(weeklyKm: number | null, speedKmh: number | null): RepeatSession {
    const { repSeconds, recoveryPerWorkSecond } = SESSION_STRUCTURE.interval
    return sizeRepeats('I', weeklyKm, speedKmh, repSeconds, recoveryPerWorkSecond)
}

/** Repetition (R) session: short reps at R pace with full recovery, as many as the R cap allows. */
export function repetitionSession(weeklyKm: number | null, speedKmh: number | null): RepeatSession {
    const { repMetres, maxRepSeconds, recoveryPerWorkSecond } = SESSION_STRUCTURE.repetition
    const seconds = speedKmh === null
        ? SESSION_STRUCTURE.repetitionFallback.repSeconds
        : Math.max(1, Math.min(maxRepSeconds, Math.floor((repMetres / METRES_PER_KM / speedKmh) * SECONDS_PER_HOUR)))
    return sizeRepeats('R', weeklyKm, speedKmh, seconds, recoveryPerWorkSecond)
}

// ---------------------------------------------------------------------------------------------
// 7. Weekly progression [progression-research, section 1 and "Implementation constants"]
// ---------------------------------------------------------------------------------------------

/**
 * VDOT mileage progression: "increase weekly mileage by as many miles as the number of runs you do
 * each week", "never increase more than 10 miles", "stay with one amount of running for at least
 * 4 weeks", and do NOT apply a 10% rule. Distances are the miles of the rule converted to km;
 * rounding is for display only.
 *
 * The step is applied in full at every level: the research calls it an upper allowance, so a
 * smaller step is always allowed but is not modelled.
 */
export const PROGRESSION = {
    /** Completed weeks at one level before the next step (verified, official article). */
    weeksPerLevel: 4,
    /** Weekly km added per run per week, per step: one mile per run (verified). */
    increasePerRunKm: MILE_KM,
    /** Largest single step in weekly km: 10 miles (verified). */
    maxIncreaseKm: 10 * MILE_KM,
    // TODO(verify): no down (recovery) week is scheduled. The research found no verified period
    // or reduction; a four-week plateau is not "three build weeks and one down week".
    downWeekEvery: null,
    // TODO(verify): no smaller step for novice or returning runners and no peak-volume ceiling is
    // applied. The research establishes neither a numeric beginner cap nor a maximum weekly total.
} as const

/**
 * Target km for each of `weeks` consecutive weeks, starting from `startKm` and running
 * `runsPerWeek` times a week. Weeks 1-4 hold the start volume, then each level adds
 * min(runsPerWeek x 1 mile, 10 miles). Values are not rounded. Returns [] for a non-positive
 * start volume or week count.
 *
 * Example: 15 km, 3 runs -> weeks 1-4 at 15, weeks 5-8 at 19.83, weeks 9-12 at 24.66.
 */
export function weeklyVolumes(startKm: number, runsPerWeek: number, weeks: number): number[] {
    if (!isPositiveFinite(startKm) || !(weeks >= 1)) return []
    const runs = isPositiveFinite(runsPerWeek) ? runsPerWeek : 0
    const stepKm = Math.min(runs * PROGRESSION.increasePerRunKm, PROGRESSION.maxIncreaseKm)
    return Array.from({ length: Math.floor(weeks) }, (_, week) => startKm + Math.floor(week / PROGRESSION.weeksPerLevel) * stepKm)
}

/**
 * Plan length in weeks: at least `minWeeks`, or until the goal race when one is set.
 * TODO(verify): `maxWeeks` is a product limit, not from the research, which gives no peak or
 * plan-length ceiling; it only keeps the week list and the climbing volume bounded.
 */
const PLAN_LENGTH = { minWeeks: 12, maxWeeks: 52 } as const

export function planWeekCount(weeksToGoal: number | null): number {
    const wanted = weeksToGoal !== null && Number.isFinite(weeksToGoal) ? Math.ceil(weeksToGoal) : 0
    return Math.min(PLAN_LENGTH.maxWeeks, Math.max(PLAN_LENGTH.minWeeks, wanted))
}

/**
 * How many runs of a week are the long run, speed sessions and plain E running.
 * TODO(verify): at least one E run besides the long run is kept, so a speed day never replaces
 * the last easy day. The research says the three-day limit is a product decision, not part of the model
 * rule, and that two speed days plus a long run should not be compressed into three days.
 */
const WEEK_STRUCTURE = { longRuns: 1, minEasyRuns: 1 } as const

export interface WeekStructure {
    long: number
    quality: number
    easy: number
}

export function weekStructure(runsPerWeek: number, effortId: string | null): WeekStructure {
    const runs = Math.max(0, Math.floor(runsPerWeek))
    const long = Math.min(runs, WEEK_STRUCTURE.longRuns)
    const wanted = effortId === null ? 0 : qualitySessionsPerWeek(effortId)
    const quality = Math.max(0, Math.min(wanted, runs - long - WEEK_STRUCTURE.minEasyRuns))
    return { long, quality, easy: runs - long - quality }
}

export type QualityKind = 'repetition' | 'interval' | 'threshold'

/**
 * Speed sessions rotate in the generic phase order R, I, T [progression-research, section 5],
 * one emphasis per mileage level, and a second speed day takes the next kind in the order.
 * TODO(verify): the research says phase lengths are not universal and short plans should not be
 * split into six-week blocks, so this rotation is a product default.
 */
const QUALITY_ROTATION: readonly QualityKind[] = ['repetition', 'interval', 'threshold']

export function qualityKinds(weekIndex: number, count: number): QualityKind[] {
    const level = Math.floor(weekIndex / PROGRESSION.weeksPerLevel)
    return Array.from({ length: count }, (_, slot) => QUALITY_ROTATION[(level + slot) % QUALITY_ROTATION.length])
}
