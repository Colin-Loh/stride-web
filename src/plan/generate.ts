import { WORKOUTS, type RunnerLevel, type WorkoutId } from '../workouts'
import {
    distanceFromSpeed,
    durationFromDistance,
    isPositiveFinite,
    paceSecondsPerKmFromSpeed,
    speedFromPaceSecondsPerKm,
} from './convert'
import {
    CATEGORY_INTENSITY,
    EFFORT_LABELS,
    PROPOSED_LEVEL_POLICY,
    PROPOSED_SESSION_SHAPE,
} from './rules'
import type {
    PersonalBaseline,
    PersonalizedWorkout,
    PlanSection,
    SectionMetrics,
    SectionTarget,
    TargetBasis,
    WorkoutTotals,
} from './types'

export function calculateSectionMetrics(section: PlanSection): SectionMetrics {
    const speedKmh = isPositiveFinite(section.speedKmh) ? section.speedKmh : null
    const paceSecondsPerKm = speedKmh ? paceSecondsPerKmFromSpeed(speedKmh) : null

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

export function generatePersonalizedWorkout(input: {
    category: WorkoutId
    level: RunnerLevel
    baseline: PersonalBaseline
}): PersonalizedWorkout {
    const { category, level, baseline } = input
    const template = WORKOUTS.find((workout) => workout.id === category)
    const intensity = CATEGORY_INTENSITY[category]
    const explanation: string[] = []
    const adjustments: string[] = []
    const shape = PROPOSED_SESSION_SHAPE

    const base = isPositiveFinite(baseline.speedKmh) ? baseline.speedKmh : null
    const speedFor = (ratio: number) => (base === null ? null : base * ratio)

    // Warm-up and cool-down are carved out of the available time first.
    const available = baseline.availableSeconds
    let warmupSeconds = available
        ? clamp(
            available * shape.warmupShareOfSession,
            shape.minWarmupSeconds,
            shape.maxWarmupSeconds,
        )
        : shape.fallbackWarmupSeconds
    let cooldownSeconds = available
        ? clamp(
            available * shape.cooldownShareOfSession,
            shape.minCooldownSeconds,
            shape.maxCooldownSeconds,
        )
        : shape.fallbackCooldownSeconds

    if (available && warmupSeconds + cooldownSeconds + shape.minMainSeconds > available) {
        warmupSeconds = shape.minWarmupSeconds
        cooldownSeconds = shape.minCooldownSeconds
        adjustments.push(
            'Your available time is short, so the warm-up and cool-down were cut to their minimums.',
        )
    }

    let mainBudget = available
        ? available - warmupSeconds - cooldownSeconds
        : null
    if (mainBudget !== null && mainBudget < shape.minMainSeconds) {
        mainBudget = shape.minMainSeconds
        adjustments.push(
            'Even at their minimums the warm-up and cool-down fill your session, so the main run is set to its floor. Allow more time for a useful workout.',
        )
    }

    // The main run starts from what the runner said they can manage comfortably.
    let mainTarget: SectionTarget | null = baseline.comfortableCapacity
    const share = PROPOSED_LEVEL_POLICY.shareFor(level, category)

    if (mainTarget && share !== 1) {
        mainTarget =
            mainTarget.basis === 'time'
                ? { basis: 'time', durationSeconds: mainTarget.durationSeconds * share }
                : { basis: 'distance', distanceKm: mainTarget.distanceKm * share }
        const percent = Math.round(share * 100)
        adjustments.push(
            share < 1
                ? `${template?.name ?? category} as a ${level} runner: the main run is pulled back to ${percent}% of your comfortable capacity. Confirm or edit it below rather than taking it as advice.`
                : `${template?.name ?? category} as a ${level} runner: the main run pushes to ${percent}% of your comfortable capacity. Confirm or edit it below rather than taking it as advice.`,
        )
    }

    if (!mainTarget) {
        // No capacity reported: fall back to whatever time is left, clearly flagged.
        mainTarget = {
            basis: 'time',
            durationSeconds: mainBudget ?? shape.minMainSeconds * 10,
        }
        adjustments.push(
            'We do not know your comfortable capacity, so the main run just fills the time you have. Add your capacity for something tailored.',
        )
    }

    // Fit the main section inside the remaining time.
    if (mainBudget !== null) {
        if (mainTarget.basis === 'time' && mainTarget.durationSeconds > mainBudget) {
            mainTarget = { basis: 'time', durationSeconds: mainBudget }
            adjustments.push(
                'The main run was shortened so the warm-up and cool-down fit inside your available time.',
            )
        } else if (mainTarget.basis === 'distance') {
            const mainSpeed = speedFor(intensity.run)
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
            template?.segments.find((s) => s.kind === 'steady')?.label ?? 'Run',
            mainTarget.basis === 'time'
                ? { basis: 'time', durationSeconds: Math.round(mainTarget.durationSeconds) }
                : mainTarget,
            speedFor(intensity.run),
        ),
        section(
            'cooldown',
            'cooldown',
            'Cool-down',
            { basis: 'time', durationSeconds: Math.round(cooldownSeconds) },
            speedFor(intensity.cooldown),
        ),
    ]

    if (base === null) {
        explanation.push(
            'You told us your pace is unknown, so the sections are time-based and we show effort instead of speed, pace and distance.',
        )
    } else {
        explanation.push(
            baseline.speedSource === 'distance-and-time'
                ? 'Your comfortable speed was calculated from the distance and time you gave.'
                : 'Your main run uses the comfortable pace you reported.',
        )
    }
    if (available) {
        explanation.push(
            'Warm-up, main run and cool-down all count towards the time you said you have.',
        )
    }

    return {
        category,
        categoryName: template?.name ?? category,
        level,
        baseline,
        sections,
        explanation,
        adjustments,
    }
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
        if (item.speedKmh !== null && !isPositiveFinite(item.speedKmh)) {
            issues.push({
                sectionId: item.id,
                message: `${item.label} has an invalid speed. Clear it or enter a number greater than zero.`,
            })
        }
    }

    const totals = calculateWorkoutTotals(workout.sections)
    const available = workout.baseline.availableSeconds
    if (available && totals.durationSeconds && totals.durationSeconds > available) {
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
    return { ...item, speedKmh }
}

export function setSectionPace(
    item: PlanSection,
    paceSecondsPerKm: number | null,
): PlanSection {
    return {
        ...item,
        speedKmh:
            paceSecondsPerKm && paceSecondsPerKm > 0
                ? speedFromPaceSecondsPerKm(paceSecondsPerKm)
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

/** Switching basis is explicit, and converts using the current metrics. */
export function setSectionBasis(
    item: PlanSection,
    basis: TargetBasis,
): PlanSection {
    if (item.target.basis === basis) return item
    const metrics = calculateSectionMetrics(item)
    if (basis === 'time') {
        return {
            ...item,
            target: {
                basis: 'time',
                durationSeconds: metrics.durationSeconds ?? 0,
            },
        }
    }
    return {
        ...item,
        target: { basis: 'distance', distanceKm: metrics.distanceKm ?? 0 },
    }
}
