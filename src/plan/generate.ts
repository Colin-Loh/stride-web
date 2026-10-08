import { WORKOUTS, type WorkoutId } from '../workouts'
import { durationFromDistance, distanceFromSpeed, formatPaceSeconds, formatSpan, isPositiveFinite, paceSecondsPerKmFromSpeed, roundSpeedUp } from './convert'
import { CATEGORY_INTENSITY, DANIELS_VOLUME, DEFAULT_WALK_PACE_SECONDS, PROPOSED_SESSION_SHAPE, PROPOSED_TEMPO_SHAPE } from './rules'
import { danielsSpeeds } from './vdot'
import { calculateSectionMetrics } from './metrics'
import { clamp, section } from './builderHelpers'
import { generateIntervalWorkout } from './intervalBuilder'
import { generateCruiseWorkout } from './cruiseBuilder'
import { danielsNote } from './explanations'
import type { PersonalBaseline, PersonalizedWorkout, PlanSection, SectionTarget } from './types'

export { calculateSectionMetrics, calculateWorkoutTotals } from './metrics'
export { validateWorkout } from './validation'
export { setSectionSpeed, setSectionPace, setSectionTargetValue } from './edit'
export { planToSchema } from './schema'

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
    return Math.floor(Math.max(spec.minMainSeconds, wanted))
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
                ? `This proposes ${formatSpan(mainTarget.durationSeconds)} of threshold running. Before starting, the work block must fit within 10% of your ${weeklyKm} km week.`
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

    if (category === 'easy' || category === 'long') {
        const main = sections[1]
        const budget = DANIELS_VOLUME.longMaxSeconds - warmupSeconds - cooldownSeconds
        const seconds = calculateSectionMetrics(main).durationSeconds
        if (seconds !== null && seconds > budget) {
            main.target = { basis: 'time', durationSeconds: Math.max(1, budget) }
            adjustments.push('The entire workout is capped at 150 minutes, including warm-up and cool-down.')
        }
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
