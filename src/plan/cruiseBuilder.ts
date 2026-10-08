import { durationFromDistance, roundSpeedUp, formatSpan } from './convert'
import { CATEGORY_INTENSITY, DANIELS_VOLUME, PROPOSED_SESSION_SHAPE, PROPOSED_CRUISE_SHAPE, CRUISE_EFFORT, CRUISE_RPE, CRUISE_CUES } from './rules'
import { section, fitRepeatingSandwich } from './builderHelpers'
import type { PersonalBaseline, PersonalizedWorkout } from './types'

export function generateCruiseWorkout(input: {
    baseline: PersonalBaseline
    template: { name: string } | undefined
    speedFor: (ratio: number) => number | null
    base: number | null
    repSpeed: number | null
}): PersonalizedWorkout {
    const { baseline, template, speedFor, base, repSpeed } = input
    const shape = PROPOSED_SESSION_SHAPE
    const spec = PROPOSED_CRUISE_SHAPE
    const intensity = CATEGORY_INTENSITY.cruise
    const adjustments: string[] = []
    const explanation: string[] = []

    const minWarmup = Math.max(shape.minWarmupSeconds, spec.minWarmupSeconds)
    const minCooldown = Math.max(shape.minCooldownSeconds, spec.minCooldownSeconds)
    // A rep is a fixed distance at tempo pace, so its duration comes from the runner's own pace.
    const repSeconds = repSpeed === null
        ? spec.fallbackRepSeconds
        : durationFromDistance(spec.repDistanceKm, repSpeed)
    // Daniels: about 1 minute of rest for every 5 minutes of running.
    const recoverySeconds = Math.max(
        spec.minRecoverySeconds,
        Math.round((repSeconds * DANIELS_VOLUME.cruiseRestPerRepSecond) / spec.recoveryRoundingSeconds) * spec.recoveryRoundingSeconds,
    )
    const weeklyKm = baseline.weeklyKm ?? null
    // Daniels caps threshold running in one session at 10% of the week.
    const wantedReps = weeklyKm
        ? Math.max(spec.minReps, Math.floor((weeklyKm * DANIELS_VOLUME.thresholdShareOfWeek) / spec.repDistanceKm + 1e-9))
        : spec.fallbackReps
    const cycleSeconds = repSeconds + recoverySeconds
    const fit = fitRepeatingSandwich({
        available: baseline.availableSeconds,
        minWarmup, minCooldown, cycleSeconds,
        wantedReps,
        minReps: spec.minReps,
    })

    if (fit.overBudget) {
        adjustments.push(
            `There is not enough time for a safe cruise session. Even at ${spec.minReps} reps it needs about ${Math.ceil(fit.floorSessionSeconds / 60)} min, because the warm-up is never cut short before threshold running. Allow more time or pick an easier category.`,
        )
    } else if (fit.trimmedReps) {
        adjustments.push(
            `The block was trimmed to ${fit.reps} reps so the warm-up and cool-down still fit your available time.`,
        )
    }

    const recoverySpeed = baseline.walkSpeedKmh ?? speedFor(spec.fallbackRecoveryRatio)
    const warmup = section('warmup', 'warmup', 'Warm-up',
        { basis: 'time', durationSeconds: Math.round(fit.warmupSeconds) }, speedFor(intensity.warmup))
    warmup.effort = CRUISE_EFFORT.warmup
    warmup.targetRpe = CRUISE_RPE.warmup
    warmup.audioCue = CRUISE_CUES.warmup

    const main = section('main', 'run', 'Cruise reps',
        { basis: 'time', durationSeconds: fit.reps * cycleSeconds }, repSpeed)
    main.effort = CRUISE_EFFORT.rep
    main.targetRpe = CRUISE_RPE.rep
    main.audioCue = `Cruise reps. ${fit.reps} of ${spec.repDistanceKm} km. ${CRUISE_CUES.rep}`
    main.runWalk = {
        runSeconds: repSeconds,
        walkSeconds: recoverySeconds,
        walkSpeedKmh: recoverySpeed === null ? null : roundSpeedUp(recoverySpeed),
        runLabel: 'Rep',
        walkLabel: 'Easy jog',
        runCue: CRUISE_CUES.rep,
        walkCue: CRUISE_CUES.recovery,
        runRpe: CRUISE_RPE.rep,
        walkRpe: CRUISE_RPE.recovery,
    }

    const cooldown = section('cooldown', 'cooldown', 'Cool-down',
        { basis: 'time', durationSeconds: Math.round(fit.cooldownSeconds) }, speedFor(intensity.cooldown))
    cooldown.effort = CRUISE_EFFORT.cooldown
    cooldown.targetRpe = CRUISE_RPE.cooldown
    cooldown.audioCue = CRUISE_CUES.cooldown

    explanation.push(
        base === null
            ? `${fit.reps} reps of about ${spec.repDistanceKm} km at tempo effort, with a ${formatSpan(recoverySeconds)} easy jog between each.`
            : `${fit.reps} reps of ${spec.repDistanceKm} km at tempo pace, with a ${formatSpan(recoverySeconds)} easy jog between each: Daniels' 1 minute of rest per 5 minutes of running.`,
    )
    explanation.push(
        base === null
            ? 'We do not know your pace, so run the reps by effort: RPE 7, comfortably hard, a few words at a time.'
            : weeklyKm
                ? `Rep pace is Daniels' threshold pace — the same effort as a Tempo run. The working repetitions are checked against 10% of your ${weeklyKm} km week before you can start.`
                : 'Rep pace is Daniels\' threshold pace — the same effort as a Tempo run.',
    )

    return {
        category: 'cruise',
        categoryName: template?.name ?? 'Cruise intervals',
        baseline,
        sections: [warmup, main, cooldown],
        explanation,
        adjustments,
    }
}

