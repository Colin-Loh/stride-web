import type { WorkoutId } from '../workouts'

/** Steady speed of the original Easy-run template. Every category ratio is relative to it. */
const REFERENCE_EASY_KMH = 8.5

// Preserve established category ratios without retaining the old workout engine.
// NOTE: the 'run' ratio for 'tempo', 'cruise' and 'interval' is kept only so every WorkoutId
// has the same shape -- it no longer sets their speed. See danielsSpeeds in vdot.ts.
export const CATEGORY_INTENSITY: Record<WorkoutId, { warmup: number; run: number; cooldown: number }> = {
    test: { warmup: 7.75 / REFERENCE_EASY_KMH, run: 1, cooldown: 7.25 / REFERENCE_EASY_KMH },
    easy: { warmup: 7.75 / REFERENCE_EASY_KMH, run: 1, cooldown: 7.25 / REFERENCE_EASY_KMH },
    tempo: { warmup: 8.25 / REFERENCE_EASY_KMH, run: 10.5 / REFERENCE_EASY_KMH, cooldown: 7.75 / REFERENCE_EASY_KMH },
    // Cruise intervals run at the same "tempo pace" as a Tempo run -- reused, not reinvented.
    cruise: { warmup: 8.25 / REFERENCE_EASY_KMH, run: 10.5 / REFERENCE_EASY_KMH, cooldown: 7.75 / REFERENCE_EASY_KMH },
    interval: { warmup: 7.75 / REFERENCE_EASY_KMH, run: 1.38, cooldown: 7.25 / REFERENCE_EASY_KMH },
    long: { warmup: 8 / REFERENCE_EASY_KMH, run: 1, cooldown: 7.65 / REFERENCE_EASY_KMH },
}

/**
 * Jack Daniels' volume rules, as given in Daniels' Running Formula. Pace comes from the
 * Daniels-Gilbert equations in vdot.ts; these decide how much of each pace a session holds.
 */
export const DANIELS_VOLUME = {
    /** Long run: at most 30% of weekly distance below 64 km/week, 25% from there up... */
    longShareLowMileage: 0.3,
    longShare: 0.25,
    lowMileageKm: 64,
    /** ...and never more than 150 minutes, whichever comes first. */
    longMaxSeconds: 150 * 60,
    /** Threshold running in one session: at most 10% of weekly distance. */
    thresholdShareOfWeek: 0.1,
    /** A steady tempo run is 20 minutes at threshold pace; more T work belongs in cruise intervals. */
    steadyTempoSeconds: 20 * 60,
    /** Cruise intervals: about 1 minute of rest for every 5 minutes of running. */
    cruiseRestPerRepSecond: 1 / 5,
    /** Repetition (fast rep) running in one session: at most 5% of weekly distance, and never over 8 km. */
    repetitionShareOfWeek: 0.05,
    repetitionMaxKm: 8,
    /**
     * With no time limit given, hard sessions (tempo, cruise, interval) get the usual
     * 10 minutes of easy running either side.
     */
    qualityWarmupSeconds: 10 * 60,
    qualityCooldownSeconds: 10 * 60,
} as const

export const PROPOSED_SESSION_SHAPE = {
    warmupShareOfSession: 0.15,
    cooldownShareOfSession: 0.15,
    minWarmupSeconds: 180,
    maxWarmupSeconds: 600,
    minCooldownSeconds: 180,
    maxCooldownSeconds: 600,
    /** Used only when the runner gave no available time. */
    fallbackWarmupSeconds: 300,
    fallbackCooldownSeconds: 300,
    /** Floor so a squeezed session never generates zero or negative targets. */
    minMainSeconds: 60,
} as const

/**
 * PROPOSED DEFAULTS -- REQUIRES PRODUCT REVIEW.
 *
 * Tempo run is continuous threshold work, so it gets the same warm-up and cool-down
 * floors as Cruise intervals: never go into threshold running on less than an
 * 8-minute warm-up. If the floors plus a minimum tempo block do not fit, the session
 * runs over the available time and is flagged, rather than cutting the warm-up.
 *
 * The block itself follows DANIELS_VOLUME (20 minutes, capped at 10% of weekly
 * distance).
 */
export const PROPOSED_TEMPO_SHAPE = {
    minWarmupSeconds: 480,
    minCooldownSeconds: 300,
    /** Shortest tempo block worth warming up for. */
    minMainSeconds: 600,
} as const

/**
 * PROPOSED DEFAULT -- REQUIRES PRODUCT REVIEW.
 *
 * Starting easy pace for a runner who has no race and does not know their pace:
 * 9:00/km (6.7 km/h), a gentle jog just quicker than a brisk walk (~6 km/h) that
 * almost any beginner can hold. Through the Daniels equations it reads as VDOT ~24,
 * so threshold and rep paces stay gentle too. The runner can change speed mid-run.
 */
export const DEFAULT_EASY_PACE_SECONDS = 9 * 60

export const EFFORT_LABELS: Record<'warmup' | 'run' | 'cooldown', string> = {
    warmup: 'Easy, conversational — you should be able to talk in sentences',
    run: 'Steady and controlled at your target effort',
    cooldown: 'Very easy, letting your breathing settle',
}

/**
 * PROPOSED DEFAULTS -- REQUIRES PRODUCT REVIEW.
 *
 * Interval run is a neuromuscular session: short reps, full recovery, low lactate.
 * Rep count follows DANIELS_VOLUME (repetition running capped at 5% of the week),
 * then is trimmed to the time available.
 *
 * Recovery is deliberately longer than the rep so output stays high on every
 * repetition. These are starting points, not validated training guidance.
 */
export const PROPOSED_INTERVAL_SHAPE = {
    repSeconds: 40,
    recoverySeconds: 80,
    minReps: 3,
    /** Daniels' 5% allows 20+ of these short reps for big weeks; this keeps one session sane. */
    maxReps: 12,
    /** Only when the rep distance is unknown (no pace) or a plan has no weekly distance. */
    fallbackReps: 8,
    /** Recovery speed when the runner never told us a walking pace. */
    fallbackRecoveryRatio: 0.62,
    /** Warm-up and cool-down sit at the top of the shared clamp: speed work needs a long warm-up. */
    minWarmupSeconds: 480,
    minCooldownSeconds: 300,
} as const

export const INTERVAL_RPE = { warmup: 3, rep: 9, recovery: 2, cooldown: 2 } as const

export const INTERVAL_EFFORT = {
    warmup: 'Easy and conversational, building towards the first fast rep.',
    rep: 'Fast but controlled, not a sprint. You should only manage single words.',
    recovery: 'Walk or very slow jog. Let your breathing fully settle before the next one.',
    cooldown: 'Gentle running or walking until your heart rate is back near baseline.',
} as const

export const INTERVAL_CUES = {
    warmup: 'Warm-up. Easy pace, building towards the first fast rep.',
    rep: 'Go. Fast and tall. Quick feet, relaxed shoulders.',
    recovery: 'Ease right down and let your breathing settle.',
    cooldown: 'Cool-down. Well done. Gentle running or walking now, let the heart rate come down.',
} as const

/**
 * PROPOSED DEFAULTS -- REQUIRES PRODUCT REVIEW.
 *
 * Cruise intervals run reps at tempo pace with an easy jog recovery, not a full stop,
 * so time spent at threshold effort stays high across the whole block. Distance per
 * rep is fixed; duration is derived from the runner's own tempo pace, same as every
 * other category. Rep count follows DANIELS_VOLUME (threshold work capped at 10% of
 * weekly distance), then is trimmed to the time available. Rest follows Daniels' 1 minute per 5 minutes of running.
 *
 * Rep distance is 1 km, not the classic 1 mile/1.5 km cruise interval. Daniels
 * recommends reps of 3-10 minutes (ideally 5-7). At recreational threshold paces
 * (roughly 5:30-7:30/km), 1.5 km pushes past 8-11 minutes -- at or beyond the edge
 * of that window. 1 km keeps reps inside it across the paces this app targets.
 *
 * These are starting points, not validated training guidance.
 */
export const PROPOSED_CRUISE_SHAPE = {
    repDistanceKm: 1,
    minReps: 2,
    /** Only for a plan with no weekly distance; the question is mandatory. */
    fallbackReps: 3,
    /** Daniels' rest ratio is rounded to this, and never drops below minRecoverySeconds. */
    recoveryRoundingSeconds: 15,
    minRecoverySeconds: 60,
    /** Assumed only when we do not know the runner's pace, so a distance rep can still be timed. */
    fallbackRepSeconds: 480,
    /** Recovery jog speed when the runner never told us a walking pace: slower than easy, not a walk. */
    fallbackRecoveryRatio: 0.78,
    minWarmupSeconds: 480,
    minCooldownSeconds: 300,
} as const

export const CRUISE_RPE = { warmup: 3, rep: 7, recovery: 3, cooldown: 2 } as const

export const CRUISE_EFFORT = {
    warmup: 'Easy and conversational, building towards tempo effort in the last minute.',
    rep: 'Comfortably hard and controlled. A few words at a time, not gasping.',
    recovery: 'Easy jog, not a full stop. Let your legs shake out while you keep moving.',
    cooldown: 'Gentle running or walking until your heart rate is back near baseline.',
} as const

export const CRUISE_CUES = {
    warmup: 'Warm-up. Easy pace, building towards tempo effort by the end.',
    rep: 'Go. Settle into a strong, controlled rhythm.',
    recovery: 'Ease into an easy jog. Keep moving, do not stop.',
    cooldown: 'Cool-down. Well done. Gentle running or walking now, let the heart rate come down.',
} as const

export const FORM_CUES = [
    'Run tall: hips forward, chest open, eyes down the track rather than at your feet.',
    'Quick feet: think light, fast ground contact rather than long, reaching strides.',
    'Relaxed shoulders: unclench your jaw and hands, and let your arms drive from the elbow.',
]

export const RULES_DISCLAIMER =
    'Paces and session sizes come from Jack Daniels\' VDOT formulas and volume rules. Warm-up lengths, the beginner default pace and the interval rep cap are product defaults that need review — they are not validated training advice.'
