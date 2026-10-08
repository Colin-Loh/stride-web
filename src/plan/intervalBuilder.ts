import { distanceFromSpeed, roundSpeedUp } from './convert'
import { CATEGORY_INTENSITY, DANIELS_VOLUME, PROPOSED_SESSION_SHAPE, PROPOSED_INTERVAL_SHAPE, INTERVAL_EFFORT, INTERVAL_RPE, INTERVAL_CUES } from './rules'
import { clamp, section, fitRepeatingSandwich } from './builderHelpers'
import type { PersonalBaseline, PersonalizedWorkout } from './types'

export function generateIntervalWorkout(input: {
    baseline: PersonalBaseline
    template: { name: string } | undefined
    speedFor: (ratio: number) => number | null
    base: number | null
    repSpeed: number | null
}): PersonalizedWorkout {
    const { baseline, template, speedFor, base, repSpeed } = input
    const shape = PROPOSED_SESSION_SHAPE
    const spec = PROPOSED_INTERVAL_SHAPE
    const intensity = CATEGORY_INTENSITY.interval
    const adjustments: string[] = []
    const explanation: string[] = []

    const minWarmup = Math.max(shape.minWarmupSeconds, spec.minWarmupSeconds)
    const minCooldown = Math.max(shape.minCooldownSeconds, spec.minCooldownSeconds)
    const cycleSeconds = spec.repSeconds + spec.recoverySeconds
    const weeklyKm = baseline.weeklyKm ?? null
    // Daniels: repetition running is at most 5% of the week (and 8 km). Each rep covers
    // repSeconds at rep pace, so the cap converts to a rep count.
    const repKm = repSpeed === null ? null : distanceFromSpeed(repSpeed, spec.repSeconds)
    const repBudgetKm = weeklyKm ? Math.min(weeklyKm * DANIELS_VOLUME.repetitionShareOfWeek, DANIELS_VOLUME.repetitionMaxKm) : null
    const wantedReps = repBudgetKm && repKm
        ? clamp(Math.floor(repBudgetKm / repKm + 1e-9), spec.minReps, spec.maxReps)
        : spec.fallbackReps
    const fit = fitRepeatingSandwich({
        available: baseline.availableSeconds,
        minWarmup, minCooldown, cycleSeconds,
        wantedReps,
        minReps: spec.minReps,
    })

    if (fit.overBudget) {
        adjustments.push(
            `There is not enough time for a safe speed session. Even at ${spec.minReps} reps it needs about ${Math.ceil(fit.floorSessionSeconds / 60)} min, because the warm-up is never cut short before fast running. Allow more time or pick an easier category.`,
        )
    } else if (fit.trimmedReps) {
        adjustments.push(
            `The block was trimmed to ${fit.reps} reps so the warm-up and cool-down still fit your available time.`,
        )
    }

    const recoverySpeed = baseline.walkSpeedKmh ?? speedFor(spec.fallbackRecoveryRatio)
    const warmup = section('warmup', 'warmup', 'Warm-up',
        { basis: 'time', durationSeconds: Math.round(fit.warmupSeconds) }, speedFor(intensity.warmup))
    warmup.effort = INTERVAL_EFFORT.warmup
    warmup.targetRpe = INTERVAL_RPE.warmup
    warmup.audioCue = INTERVAL_CUES.warmup

    const main = section('main', 'run', 'Interval reps',
        { basis: 'time', durationSeconds: fit.reps * cycleSeconds }, repSpeed)
    main.effort = INTERVAL_EFFORT.rep
    main.targetRpe = INTERVAL_RPE.rep
    main.audioCue = `Interval reps. ${fit.reps} of ${spec.repSeconds} seconds. ${INTERVAL_CUES.rep}`
    main.runWalk = {
        runSeconds: spec.repSeconds,
        walkSeconds: spec.recoverySeconds,
        walkSpeedKmh: recoverySpeed === null ? null : roundSpeedUp(recoverySpeed),
        runLabel: 'Rep',
        walkLabel: 'Recovery',
        runCue: INTERVAL_CUES.rep,
        walkCue: INTERVAL_CUES.recovery,
        runRpe: INTERVAL_RPE.rep,
        walkRpe: INTERVAL_RPE.recovery,
    }

    const cooldown = section('cooldown', 'cooldown', 'Cool-down',
        { basis: 'time', durationSeconds: Math.round(fit.cooldownSeconds) }, speedFor(intensity.cooldown))
    cooldown.effort = INTERVAL_EFFORT.cooldown
    cooldown.targetRpe = INTERVAL_RPE.cooldown
    cooldown.audioCue = INTERVAL_CUES.cooldown

    explanation.push(
        `${fit.reps} reps of ${spec.repSeconds} seconds fast with ${spec.recoverySeconds} seconds recovery, so every rep starts fresh.`,
    )
    explanation.push(
        base === null
            ? 'We do not know your pace, so run the reps by effort: RPE 9, fast but controlled, with only single words possible.'
            : 'Rep pace is Daniels\' repetition pace: about the pace you could race a mile at. Recovery is a walk or very slow jog.',
    )
    if (repBudgetKm && repKm) {
        explanation.push(
            `Fast running is checked against 5% of your ${weeklyKm} km week before you can start, with at most ${spec.maxReps} reps.`,
        )
    }

    return {
        category: 'interval',
        categoryName: template?.name ?? 'Interval run',
        baseline,
        sections: [warmup, main, cooldown],
        explanation,
        adjustments,
    }
}

