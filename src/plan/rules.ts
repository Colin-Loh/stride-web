import {
    LEVELS,
    WORKOUTS,
    midKmh,
    type RunnerLevel,
    type SegmentKind,
    type WorkoutId,
} from '../workouts'

function midFor(id: WorkoutId, kind: SegmentKind): number {
    const template = WORKOUTS.find((workout) => workout.id === id)
    const segment = template?.segments.find((item) => item.kind === kind)
    if (!segment) throw new Error(`No ${kind} segment for workout ${id}`)
    return midKmh(segment.speed)
}

/**
 * EXISTING RULE, re-expressed.
 *
 * The app already defines each category with absolute km/h ranges per segment.
 * Those are only correct for one hypothetical runner, so instead of copying the
 * numbers we keep their *relationships* and rescale them to the runner's own
 * comfortable pace. The easy run's steady speed is the reference point.
 */
export const REFERENCE_SPEED_KMH = midFor('easy', 'steady')

export const CATEGORY_INTENSITY: Record<
    WorkoutId,
    { warmup: number; run: number; cooldown: number }
> = Object.fromEntries(
    WORKOUTS.map((workout) => [
        workout.id,
        {
            warmup: midFor(workout.id, 'warmup') / REFERENCE_SPEED_KMH,
            run: midFor(workout.id, 'steady') / REFERENCE_SPEED_KMH,
            cooldown: midFor(workout.id, 'cooldown') / REFERENCE_SPEED_KMH,
        },
    ]),
) as Record<WorkoutId, { warmup: number; run: number; cooldown: number }>

/**
 * PROPOSED DEFAULTS -- REQUIRES PRODUCT REVIEW.
 *
 * The app had no rule for how long a warm-up or cool-down should be, nor how to
 * fit a session into a time limit. These are starting points chosen for this
 * feature, not validated training guidance.
 */
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
 * PROPOSED DEFAULT -- REQUIRES PRODUCT REVIEW.
 *
 * Runner level changes VOLUME, never pace. The app's existing
 * `LEVELS.speedFactor` (0.92 / 1.0 / 1.08) is deliberately not applied to a
 * personalised plan, because the runner's reported pace already reflects their
 * ability and applying both would double-count it. Instead each level/category
 * pair gets a share of the capacity the runner said they can already manage.
 *
 * 1.0 means "exactly what you told us you can do". Below 1.0 pulls the main run
 * back, above 1.0 pushes past it. Tempo sits under 1.0 for everyone because the
 * same distance costs more at tempo intensity. Test run stays at 1.0 for every
 * level on purpose -- it is a calibration effort, not a training session.
 *
 * These numbers are starting points chosen for this feature, not validated
 * training guidance.
 */
export const PROPOSED_LEVEL_POLICY = {
    capacityShare: {
        beginner: { test: 1, easy: 0.8, tempo: 0.5, long: 0.7 },
        intermediate: { test: 1, easy: 1, tempo: 0.8, long: 1.1 },
        advanced: { test: 1, easy: 1.1, tempo: 0.9, long: 1.35 },
    } satisfies Record<RunnerLevel, Record<WorkoutId, number>>,
    shareFor: (level: RunnerLevel, category: WorkoutId): number =>
        PROPOSED_LEVEL_POLICY.capacityShare[level][category],
} as const

export const LEVEL_CONTEXT: Record<RunnerLevel, string> = {
    beginner: LEVELS.beginner.criteria,
    intermediate: LEVELS.intermediate.criteria,
    advanced: LEVELS.advanced.criteria,
}

export const EFFORT_LABELS: Record<'warmup' | 'run' | 'cooldown', string> = {
    warmup: 'Easy, conversational — you should be able to talk in sentences',
    run: 'Steady and controlled at your target effort',
    cooldown: 'Very easy, letting your breathing settle',
}

export const RULES_DISCLAIMER =
    'Category intensities come from this app\u2019s existing workout templates, rescaled to your reported pace. Session shape and level adaptations are product defaults that need review — they are not validated training advice.'
