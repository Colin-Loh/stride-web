import { intervalMetrics } from './intervals'
import { WORKOUTS, type WorkoutId } from '../workouts'
import {
    distanceFromSpeed,
    durationFromDistance,
    formatDuration,
    formatPaceSeconds,
    formatSpan,
    isPositiveFinite,
    paceSecondsPerKmFromSpeed,
    roundSpeedUp,
    speedFromPaceSecondsPerKm,
    MIN_SPEED,
    MAX_SPEED,
} from './convert'
import {
    CATEGORY_INTENSITY,
    CRUISE_CUES,
    CRUISE_EFFORT,
    CRUISE_RPE,
    DANIELS_VOLUME,
    DEFAULT_EASY_PACE_SECONDS,
    DEFAULT_WALK_PACE_SECONDS,
    EFFORT_LABELS,
    INTERVAL_CUES,
    INTERVAL_EFFORT,
    INTERVAL_RPE,
    PROPOSED_CRUISE_SHAPE,
    PROPOSED_INTERVAL_SHAPE,
    PROPOSED_SESSION_SHAPE,
    PROPOSED_TEMPO_SHAPE,
} from './rules'
import { danielsSpeeds, raceLabel, type DanielsSpeeds } from './vdot'
import type {
    PersonalBaseline,
    PersonalizedWorkout,
    PlanSection,
    SectionMetrics,
    SectionTarget,
    WorkoutTotals,
} from './types'

export function calculateSectionMetrics(section: PlanSection): SectionMetrics {
    const speedKmh = isPositiveFinite(section.speedKmh) ? section.speedKmh : null
    const paceSecondsPerKm = speedKmh ? paceSecondsPerKmFromSpeed(speedKmh) : null

    if (section.runWalk) {
        const metrics = intervalMetrics(section)
        const average = metrics.seconds && metrics.distance !== null ? metrics.distance * 3600 / metrics.seconds : null
        return {
            durationSeconds: metrics.seconds, distanceKm: metrics.distance, speedKmh,
            paceSecondsPerKm: average ? paceSecondsPerKmFromSpeed(average) : null,
            distanceEstimated: section.target.basis === 'time' && metrics.distance !== null,
            durationEstimated: section.target.basis === 'distance' && metrics.seconds !== null
        }
    }
    if (section.target.basis === 'time') {
        const durationSeconds = section.target.durationSeconds
        return {
            durationSeconds,
            distanceKm: speedKmh ? distanceFromSpeed(speedKmh, durationSeconds) : null,
            speedKmh,
            paceSecondsPerKm,
            distanceEstimated: speedKmh !== null,
            durationEstimated: false,
        }
    }

    const distanceKm = section.target.distanceKm
    return {
        durationSeconds: speedKmh ? durationFromDistance(distanceKm, speedKmh) : null,
        distanceKm,
        speedKmh,
        paceSecondsPerKm,
        distanceEstimated: false,
        durationEstimated: speedKmh !== null,
    }
}

export function calculateWorkoutTotals(sections: PlanSection[]): WorkoutTotals {
    let durationSeconds = 0
    let distanceKm = 0
    let durationComplete = true
    let distanceComplete = true

    for (const section of sections) {
        const metrics = calculateSectionMetrics(section)
        if (metrics.durationSeconds === null) durationComplete = false
        else durationSeconds += metrics.durationSeconds
        if (metrics.distanceKm === null) distanceComplete = false
        else distanceKm += metrics.distanceKm
    }

    const totalDuration = durationComplete ? durationSeconds : null
    const totalDistance = distanceComplete ? distanceKm : null

    // Overall pace comes from the totals, never from averaging section paces.
    const averageSpeedKmh =
        totalDuration && totalDistance && totalDuration > 0
            ? totalDistance / (totalDuration / 3600)
            : null

    return {
        durationSeconds: totalDuration,
        distanceKm: totalDistance,
        distanceComplete,
        averageSpeedKmh,
        paceSecondsPerKm:
            totalDuration && totalDistance && totalDistance > 0
                ? Math.round(totalDuration / totalDistance)
                : null,
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

function section(
    id: string,
    type: PlanSection['type'],
    label: string,
    target: SectionTarget,
    speedKmh: number | null,
): PlanSection {
    return { id, type, label, target, speedKmh, effort: EFFORT_LABELS[type] }
}

/**
 * Shared warm-up/cool-down/rep-count fitting for repeating sandwich sessions
 * (easy warm-up -> repeated work+recovery -> easy cool-down). The warm-up and
 * cool-down never drop below their floors -- going into hard reps on a short
 * warm-up is the injury risk, not a short block. Reps are trimmed instead, down to
 * minReps. If even that does not fit, the session keeps its floors and runs over the
 * available time (`overBudget`), so validation flags it rather than silently cutting
 * the warm-up.
 */
function fitRepeatingSandwich(input: {
    available: number | null
    minWarmup: number
    minCooldown: number
    cycleSeconds: number
    wantedReps: number
    minReps: number
}): { warmupSeconds: number; cooldownSeconds: number; reps: number; overBudget: boolean; trimmedReps: boolean; floorSessionSeconds: number } {
    const { available, minWarmup, minCooldown, cycleSeconds, wantedReps, minReps } = input
    const shape = PROPOSED_SESSION_SHAPE
    const floorSessionSeconds = minWarmup + minCooldown + minReps * cycleSeconds
    if (!available) {
        // No time limit: the usual 10 minutes of easy running either side of the reps.
        return {
            warmupSeconds: Math.max(minWarmup, DANIELS_VOLUME.qualityWarmupSeconds),
            cooldownSeconds: Math.max(minCooldown, DANIELS_VOLUME.qualityCooldownSeconds),
            reps: wantedReps, overBudget: false, trimmedReps: false, floorSessionSeconds,
        }
    }

    let warmupSeconds = clamp(available * shape.warmupShareOfSession, minWarmup, shape.maxWarmupSeconds)
    let cooldownSeconds = clamp(available * shape.cooldownShareOfSession, minCooldown, shape.maxCooldownSeconds)
    let reps = Math.floor((available - warmupSeconds - cooldownSeconds) / cycleSeconds)
    if (reps < wantedReps) {
        // Short on time: hand any warm-up/cool-down above the floor back to the reps.
        warmupSeconds = minWarmup
        cooldownSeconds = minCooldown
        reps = Math.floor((available - warmupSeconds - cooldownSeconds) / cycleSeconds)
    }
    const trimmedReps = reps < wantedReps
    const overBudget = reps < minReps
    reps = clamp(reps, minReps, wantedReps)

    return { warmupSeconds, cooldownSeconds, reps, overBudget, trimmedReps, floorSessionSeconds }
}

/**
 * Easy warm-up -> short fast reps with full recovery -> easy cool-down.
 * Rep count follows Daniels' 5%-of-the-week cap on repetition running, then is
 * trimmed to fit the available time.
 */
function generateIntervalWorkout(input: {
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
            `${wantedReps} reps keeps fast running within Daniels' limit of 5% of your ${weeklyKm} km week${wantedReps === spec.maxReps ? ', capped at ' + spec.maxReps + ' reps for one session' : ''}.`,
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

/**
 * Easy warm-up -> reps at tempo pace with an easy jog recovery -> easy cool-down.
 * Reps are distance-based (the runner's own tempo pace sets the duration). Rep count
 * follows Daniels' 10%-of-the-week cap on threshold work, and is then trimmed to fit the available time, same as Interval run.
 */
function generateCruiseWorkout(input: {
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
        : Math.round(durationFromDistance(spec.repDistanceKm, repSpeed))
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
                ? `Rep pace is Daniels' threshold pace — the same effort as a Tempo run. ${wantedReps} reps keeps threshold work within 10% of your ${weeklyKm} km week.`
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

/** Flattened step list for the workout engine, expanding each rep and recovery. */
export function planToSchema(plan: PersonalizedWorkout): {
    type: 'warmup' | 'run' | 'rest' | 'cooldown'
    duration_seconds: number
    target_rpe: number | null
    audio_cue: string
}[] {
    const steps: { type: 'warmup' | 'run' | 'rest' | 'cooldown'; duration_seconds: number; target_rpe: number | null; audio_cue: string }[] = []
    for (const item of plan.sections) {
        const metrics = calculateSectionMetrics(item)
        const seconds = Math.round(metrics.durationSeconds ?? 0)
        const mix = item.runWalk
        if (!mix) {
            steps.push({
                type: item.type === 'run' ? 'run' : item.type,
                duration_seconds: seconds,
                target_rpe: item.targetRpe ?? null,
                audio_cue: item.audioCue ?? item.effort,
            })
            continue
        }
        const cycle = mix.runSeconds + mix.walkSeconds
        const reps = Math.max(1, Math.round(seconds / cycle))
        for (let rep = 1; rep <= reps; rep++) {
            steps.push({
                type: 'run',
                duration_seconds: mix.runSeconds,
                target_rpe: mix.runRpe ?? item.targetRpe ?? null,
                audio_cue: `Rep ${rep} of ${reps}. ${mix.runCue ?? item.effort}`,
            })
            steps.push({
                type: 'rest',
                duration_seconds: mix.walkSeconds,
                target_rpe: mix.walkRpe ?? null,
                audio_cue: rep === reps
                    ? 'Last recovery. Keep moving, cool-down next.'
                    : `${mix.walkCue ?? 'Recover.'} ${reps - rep} rep${reps - rep === 1 ? '' : 's'} to go.`,
            })
        }
    }
    return steps
}

/** Where the paces came from, shown at the top of every plan that has them. */
function danielsNote(baseline: PersonalBaseline, zones: DanielsSpeeds | null): string | null {
    if (!zones || !isPositiveFinite(baseline.vdot)) return null
    const pace = (kmh: number) => formatPaceSeconds(paceSecondsPerKmFromSpeed(kmh))
    const paces = `easy ${pace(zones.easyFastKmh)}–${pace(zones.easySlowKmh)}/km, threshold ${pace(zones.thresholdKmh)}/km, repetition ${pace(zones.repetitionKmh)}/km`
    const vdot = baseline.vdot.toFixed(1)
    if (baseline.vdotSource === 'race' && baseline.race) {
        return `Your ${raceLabel(baseline.race.distanceKm).toLowerCase()} in ${formatDuration(baseline.race.seconds)} gives a VDOT of ${vdot}. Jack Daniels' training paces for that: ${paces}.`
    }
    if (baseline.speedSource === 'default') {
        return `You did not know your pace, so we started you at ${formatPaceSeconds(DEFAULT_EASY_PACE_SECONDS)}/km, a gentle jog most beginners can hold. Daniels' formulas turn that into a VDOT of ${vdot}: ${paces}. Change the speed during the run if it feels too easy or too hard.`
    }
    return `From your comfortable pace we estimate a VDOT of ${vdot}: ${paces}. Add a recent race result for paces that fit you better.`
}

/** Daniels' long-run limit as a distance: 30% of a week under 64 km, 25% from there up. */
function longRunCapKm(weeklyKm: number): { km: number; share: number } {
    const share = weeklyKm < DANIELS_VOLUME.lowMileageKm ? DANIELS_VOLUME.longShareLowMileage : DANIELS_VOLUME.longShare
    return { km: weeklyKm * share, share }
}

/** Distance targets round down to 0.1 km, never to zero. */
const tenthOfKm = (km: number) => Math.max(0.1, Math.floor(km * 10) / 10)

/** Tempo block length: Daniels' steady 20 minutes, capped at 10% of the week at threshold. */
function tempoMainSeconds(weeklyKm: number | null, thresholdKmh: number | null): number {
    const spec = PROPOSED_TEMPO_SHAPE
    const wanted = weeklyKm && thresholdKmh
        ? Math.min(DANIELS_VOLUME.steadyTempoSeconds, durationFromDistance(weeklyKm * DANIELS_VOLUME.thresholdShareOfWeek, thresholdKmh))
        : DANIELS_VOLUME.steadyTempoSeconds
    return Math.round(Math.max(spec.minMainSeconds, wanted))
}

export function generatePersonalizedWorkout(input: {
    category: WorkoutId
    baseline: PersonalBaseline
}): PersonalizedWorkout {
    const { category, baseline } = input
    const template = WORKOUTS.find((workout) => workout.id === category)
    const intensity = CATEGORY_INTENSITY[category]
    const explanation: string[] = []
    const adjustments: string[] = []
    const shape = PROPOSED_SESSION_SHAPE

    const base = isPositiveFinite(baseline.speedKmh) ? baseline.speedKmh : null
    const speedFor = (ratio: number) => (base === null ? null : roundSpeedUp(base * ratio))
    // Hard paces come from the runner's VDOT. The old category ratios only remain for
    // runners whose pace sits outside the range the Daniels equations cover.
    const zones = base !== null && isPositiveFinite(baseline.vdot) ? danielsSpeeds(baseline.vdot) : null
    const thresholdSpeed = zones ? roundSpeedUp(zones.thresholdKmh) : speedFor(CATEGORY_INTENSITY.tempo.run)
    const repetitionSpeed = zones ? roundSpeedUp(zones.repetitionKmh) : speedFor(CATEGORY_INTENSITY.interval.run)
    const mainSpeed = category === 'tempo' ? thresholdSpeed : speedFor(intensity.run)

    const note = danielsNote(baseline, zones)
    const paceMoved = baseline.speedSource === 'race' && isPositiveFinite(baseline.reportedSpeedKmh) && base !== null
        ? `Your comfortable pace of ${formatPaceSeconds(paceSecondsPerKmFromSpeed(baseline.reportedSpeedKmh))}/km is outside Daniels' easy range for your race, so easy running uses ${formatPaceSeconds(paceSecondsPerKmFromSpeed(base))}/km instead.`
        : null
    const noClock = baseline.availableSeconds
        ? null
        : 'You did not set a time limit, so the session follows Daniels\' limits instead of a clock.'
    const walkNote = baseline.continuity === 'run-walk' && baseline.walkSpeedSource === 'default'
        ? `You did not know your walking pace, so walking uses ${formatPaceSeconds(DEFAULT_WALK_PACE_SECONDS)}/km (5 km/h), an ordinary walking speed.`
        : null
    const withDaniels = (plan: PersonalizedWorkout): PersonalizedWorkout => ({
        ...plan,
        explanation: [...(note ? [note] : []), ...plan.explanation, ...(walkNote ? [walkNote] : []), ...(noClock ? [noClock] : [])],
        adjustments: paceMoved ? [paceMoved, ...plan.adjustments] : plan.adjustments,
    })

    if (category === 'test') {
        return {
            category, categoryName: 'Test run', baseline,
            sections: [
                section('warmup', 'warmup', 'Warm-up', { basis: 'time', durationSeconds: 30 }, speedFor(intensity.warmup)),
                section('main', 'run', 'Steady section', { basis: 'time', durationSeconds: 30 }, speedFor(intensity.run)),
                section('cooldown', 'cooldown', 'Cool-down', { basis: 'time', durationSeconds: 30 }, speedFor(intensity.cooldown)),
            ], explanation: ['Three fixed 30-second sections. Speed changes never shorten this test.'], adjustments: []
        }
    }

    if (category === 'interval') {
        return withDaniels(generateIntervalWorkout({ baseline, template, speedFor, base, repSpeed: repetitionSpeed }))
    }

    if (category === 'cruise') {
        return withDaniels(generateCruiseWorkout({ baseline, template, speedFor, base, repSpeed: thresholdSpeed }))
    }

    // Warm-up and cool-down are carved out of the available time first.
    // Tempo is threshold work, so its floors are higher and never shrink.
    const floors = category === 'tempo' ? PROPOSED_TEMPO_SHAPE : null
    const minWarmup = floors?.minWarmupSeconds ?? shape.minWarmupSeconds
    const minCooldown = floors?.minCooldownSeconds ?? shape.minCooldownSeconds
    const minMain = floors?.minMainSeconds ?? shape.minMainSeconds
    const available = baseline.availableSeconds
    let warmupSeconds = available
        ? clamp(
            available * shape.warmupShareOfSession,
            minWarmup,
            shape.maxWarmupSeconds,
        )
        : floors ? DANIELS_VOLUME.qualityWarmupSeconds : shape.fallbackWarmupSeconds
    let cooldownSeconds = available
        ? clamp(
            available * shape.cooldownShareOfSession,
            minCooldown,
            shape.maxCooldownSeconds,
        )
        : floors ? DANIELS_VOLUME.qualityCooldownSeconds : shape.fallbackCooldownSeconds

    if (available && warmupSeconds + cooldownSeconds + minMain > available) {
        if (floors) {
            // Keep the floors and let the session run over, so validation flags it.
            warmupSeconds = minWarmup
            cooldownSeconds = minCooldown
            adjustments.push(
                `There is not enough time for a safe tempo run. It needs about ${Math.ceil((minWarmup + minCooldown + minMain) / 60)} min, because the warm-up is never cut short before threshold running. Allow more time or pick an easier category.`,
            )
        } else {
            warmupSeconds = Math.max(1, Math.floor(available * shape.warmupShareOfSession))
            cooldownSeconds = Math.max(1, Math.floor(available * shape.cooldownShareOfSession))
            adjustments.push('This short session uses reduced warm-up and cool-down times. Review the plan before running.')
        }
    }
    warmupSeconds = Math.round(warmupSeconds)
    cooldownSeconds = Math.round(cooldownSeconds)
    const mainBudget = available ? Math.max(floors ? minMain : 1, available - warmupSeconds - cooldownSeconds) : null

    const weeklyKm = baseline.weeklyKm ?? null
    let mainTarget: SectionTarget | null
    if (category === 'tempo') {
        mainTarget = { basis: 'time', durationSeconds: tempoMainSeconds(weeklyKm, mainSpeed) }
        explanation.push(
            weeklyKm && mainSpeed
                ? `Daniels' steady tempo is 20 minutes at threshold pace, and never more than 10% of your weekly distance. From your ${weeklyKm} km week that is ${formatSpan(mainTarget.durationSeconds)}.`
                : `A steady ${formatSpan(mainTarget.durationSeconds)} at threshold pace, Daniels' standard tempo run.`,
        )
    } else if (category === 'long' && weeklyKm) {
        const cap = longRunCapKm(weeklyKm)
        mainTarget = { basis: 'distance', distanceKm: tenthOfKm(cap.km) }
        explanation.push(
            `Daniels caps a long run at ${Math.round(cap.share * 100)}% of your weekly distance or 150 minutes, whichever comes first. From your ${weeklyKm} km week that is ${mainTarget.distanceKm} km.`,
        )
    } else if (category === 'easy' && weeklyKm && baseline.daysPerWeek) {
        // Your week split across your running days, never longer than a Daniels long run.
        const days = baseline.daysPerWeek
        const km = Math.min(weeklyKm / days, longRunCapKm(weeklyKm).km)
        mainTarget = { basis: 'distance', distanceKm: tenthOfKm(km) }
        explanation.push(
            `Your ${weeklyKm} km week spread over ${days} running day${days === 1 ? '' : 's'}, no longer than a Daniels long run: ${mainTarget.distanceKm} km.`,
        )
    } else {
        mainTarget = null
    }

    // Daniels: no single run over 150 minutes, however big the week.
    if (mainTarget && (category === 'long' || category === 'easy')) {
        const cap = DANIELS_VOLUME.longMaxSeconds
        const capped = 'The run was capped at 150 minutes, Daniels\' upper limit for a long run.'
        if (mainTarget.basis === 'time' && mainTarget.durationSeconds > cap) {
            mainTarget = { basis: 'time', durationSeconds: cap }
            adjustments.push(capped)
        } else if (mainTarget.basis === 'distance' && mainSpeed && durationFromDistance(mainTarget.distanceKm, mainSpeed) > cap) {
            mainTarget = { basis: 'distance', distanceKm: tenthOfKm(distanceFromSpeed(mainSpeed, cap)) }
            adjustments.push(capped)
        }
    }

    if (!mainTarget) {
        // No capacity reported: fall back to whatever time is left, clearly flagged.
        mainTarget = {
            basis: 'time',
            durationSeconds: mainBudget ?? shape.minMainSeconds * 10,
        }
        adjustments.push(
            'We do not know your weekly distance, so the main run just fills the time you have. Add it for a Daniels-sized session.',
        )
    }

    if (mainTarget.basis === 'distance' && (base === null ||
        (baseline.continuity === 'run-walk' && baseline.walkSpeedKmh === null))) {
        mainTarget = { basis: 'time', durationSeconds: mainBudget ?? 600 }
        adjustments.push('Speed is unknown, so the main section uses a time target. Distance stays unknown.')
    }

    // Fit the main section inside the remaining time.
    if (mainBudget !== null) {
        if (mainTarget.basis === 'time' && mainTarget.durationSeconds > mainBudget) {
            mainTarget = { basis: 'time', durationSeconds: mainBudget }
            adjustments.push(
                'The main run was shortened so the warm-up and cool-down fit inside your available time.',
            )
        } else if (mainTarget.basis === 'distance') {
            if (mainSpeed) {
                const needed = durationFromDistance(mainTarget.distanceKm, mainSpeed)
                if (needed > mainBudget) {
                    mainTarget = {
                        basis: 'distance',
                        distanceKm: distanceFromSpeed(mainSpeed, mainBudget),
                    }
                    adjustments.push(
                        'The main run distance was reduced so the whole session fits your available time.',
                    )
                }
            } else {
                adjustments.push(
                    'Without a known speed we cannot check this distance against your available time.',
                )
            }
        }
    }

    const sections: PlanSection[] = [
        section(
            'warmup',
            'warmup',
            'Warm-up',
            { basis: 'time', durationSeconds: Math.round(warmupSeconds) },
            speedFor(intensity.warmup),
        ),
        section(
            'main',
            'run',
            'Run',
            mainTarget.basis === 'time'
                ? { basis: 'time', durationSeconds: Math.round(mainTarget.durationSeconds) }
                : mainTarget,
            mainSpeed,
        ),
        section(
            'cooldown',
            'cooldown',
            'Cool-down',
            { basis: 'time', durationSeconds: Math.round(cooldownSeconds) },
            speedFor(intensity.cooldown),
        ),
    ]

    if (baseline.continuity === 'run-walk') {
        const main = sections[1]
        main.label = 'Run / walk'
        main.runWalk = {
            runSeconds: baseline.runSeconds ?? 120, walkSeconds: baseline.walkSeconds ?? 60,
            walkSpeedKmh: baseline.walkSpeedKmh === null ? null : roundSpeedUp(baseline.walkSpeedKmh)
        }
        const metrics = calculateSectionMetrics(main)
        if (mainBudget !== null && (metrics.durationSeconds === null || metrics.durationSeconds > mainBudget)) {
            main.target = { basis: 'time', durationSeconds: mainBudget }
            adjustments.push('Run/walk intervals are limited to the remaining session time.')
        }
        explanation.push('Alternate running and walking using the editable interval durations below.')
    }

    if (base === null) {
        explanation.push(
            'You told us your pace is unknown, so the sections are time-based and we show effort instead of speed, pace and distance.',
        )
    } else if (category === 'tempo') {
        explanation.push('The main run is at threshold pace: comfortably hard, a few words at a time.')
    } else {
        explanation.push(
            baseline.speedSource === 'race'
                ? 'Your main run is at Daniels\' easy pace for your race.'
                : baseline.speedSource === 'default'
                    ? 'Your main run is at the beginner starting pace.'
                    : 'Your main run uses the comfortable pace you reported.',
        )
    }
    if (available) {
        explanation.push(
            'Warm-up, main run and cool-down all count towards the time you said you have.',
        )
    }

    return withDaniels({
        category,
        categoryName: template?.name ?? category,
        baseline,
        sections,
        explanation,
        adjustments,
    })
}

export interface WorkoutIssue {
    sectionId?: string
    message: string
}

export function validateWorkout(workout: PersonalizedWorkout): {
    ok: boolean
    issues: WorkoutIssue[]
} {
    const issues: WorkoutIssue[] = []

    if (workout.sections.length === 0) {
        issues.push({ message: 'This workout has no sections.' })
    }

    for (const item of workout.sections) {
        const target = item.target as {
            basis?: string
            durationSeconds?: number
            distanceKm?: number
        }
        const hasTime = target.durationSeconds !== undefined
        const hasDistance = target.distanceKm !== undefined
        if (hasTime === hasDistance) {
            issues.push({
                sectionId: item.id,
                message: `${item.label} needs exactly one target: a duration or a distance.`,
            })
            continue
        }
        const value = hasTime ? target.durationSeconds : target.distanceKm
        if (!isPositiveFinite(value)) {
            issues.push({
                sectionId: item.id,
                message: `${item.label} needs a ${hasTime ? 'duration' : 'distance'} greater than zero.`,
            })
        }
        if (item.speedKmh !== null && (!isPositiveFinite(item.speedKmh) || item.speedKmh < MIN_SPEED || item.speedKmh > MAX_SPEED)) {
            issues.push({
                sectionId: item.id,
                message: `${item.label} has an invalid speed. Clear it or enter a speed from 0.5 to 25 km/h.`,
            })
        }
    }

    for (const item of workout.sections) {
        if (item.target.basis === 'distance' && calculateSectionMetrics(item).durationSeconds === null) {
            issues.push({ sectionId: item.id, message: `${item.label}: a distance target needs known running and walking speeds.` })
        }
        if (item.runWalk && (!isPositiveFinite(item.runWalk.runSeconds) || !isPositiveFinite(item.runWalk.walkSeconds)
            || item.runWalk.runSeconds < 1 || item.runWalk.walkSeconds < 1
            || (item.runWalk.walkSpeedKmh !== null && (!isPositiveFinite(item.runWalk.walkSpeedKmh)
                || item.runWalk.walkSpeedKmh < MIN_SPEED || item.runWalk.walkSpeedKmh > MAX_SPEED)))) {
            issues.push({ sectionId: item.id, message: `${item.label}: intervals must last at least one second; walking speed must be 0.5–25 km/h or unknown.` })
        }
    }

    const totals = calculateWorkoutTotals(workout.sections)
    const available = workout.baseline.availableSeconds
    if (workout.category !== 'test' && available && totals.durationSeconds && totals.durationSeconds > available + 0.01) {
        issues.push({
            message: `This workout is ${Math.round((totals.durationSeconds - available) / 60)} min longer than the time you said you have. Shorten a section or allow more time.`,
        })
    }

    return { ok: issues.length === 0, issues }
}

/** Editing speed keeps the section's own target, so the basis never flips. */
export function setSectionSpeed(
    item: PlanSection,
    speedKmh: number | null,
): PlanSection {
    return { ...item, speedKmh: speedKmh === null ? null : roundSpeedUp(speedKmh) }
}

export function setSectionPace(
    item: PlanSection,
    paceSecondsPerKm: number | null,
): PlanSection {
    return {
        ...item,
        speedKmh:
            paceSecondsPerKm && paceSecondsPerKm > 0
                ? roundSpeedUp(speedFromPaceSecondsPerKm(paceSecondsPerKm))
                : null,
    }
}

export function setSectionTargetValue(
    item: PlanSection,
    value: number,
): PlanSection {
    return {
        ...item,
        target:
            item.target.basis === 'time'
                ? { basis: 'time', durationSeconds: value }
                : { basis: 'distance', distanceKm: value },
    }
}
