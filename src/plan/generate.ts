import { WORKOUT_NAMES, type WorkoutId } from '../workouts'
import { distanceFromSpeed, formatSpan } from './convert'
import { EASY_RPE, MARATHON_RPE, THRESHOLD_RPE } from './copy'
import {
    intervalSession, longRunCapKm, qualitySessionsPerWeek, repetitionSession, SESSION_STRUCTURE, sessionCapKm,
    thresholdSessionSeconds, trainingSpeedsKmh, ZONES, type Zone,
} from './vdot'
import { goalNote, fitnessNote, zoneNote } from './explanations'
import { section } from './builderHelpers'
import { roundedOrNull, roundedSpeeds, tenthOfKm } from './rounding'
import { buildRepeatWorkout } from './repeats'
import type { PersonalBaseline, PersonalizedWorkout, PlanSection } from './types'

export { calculateSectionMetrics, calculateWorkoutTotals } from './metrics'
export { validateWorkout } from './validation'
export { setSectionSpeed, setSectionPace, setSectionTargetValue } from './edit'
export { planToSchema } from './schema'

const QUALITY: readonly WorkoutId[] = ['threshold', 'interval', 'repetition']

/** Shortest warm-up or cool-down worth showing; distance targets have 0.1 km resolution. */
const MIN_PART_KM = 0.1

export interface WorkoutInput {
    category: WorkoutId
    baseline: PersonalBaseline
    /** Total distance of a plan day (marathon-pace or threshold run) sized from the week's volume. */
    distanceKm?: number | null
}

/**
 * One workout without the plan-level context (fitness and goal notes, Base advice). Training plan
 * weeks use this; `generatePersonalizedWorkout` adds the context for a single session.
 */
export function buildWorkout(input: WorkoutInput): PersonalizedWorkout {
    const { category, baseline, distanceKm = null } = input
    const categoryName = WORKOUT_NAMES[category]
    const rawSpeeds = baseline.vdot === null ? null : trainingSpeedsKmh(baseline.vdot)
    const speeds = roundedSpeeds(rawSpeeds)
    // Without a VDOT, easy running falls back to the pace the runner reported.
    const easy = speeds.E ?? roundedOrNull(baseline.reportedEasySpeedKmh)
    const weeklyKm = baseline.weeklyKm !== null && baseline.weeklyKm > 0 ? baseline.weeklyKm : null
    const finish = (workout: PersonalizedWorkout, zone: Zone): PersonalizedWorkout => ({
        ...workout, explanation: [zoneNote(zone), ...workout.explanation],
    })

    if (category === 'interval' || category === 'repetition') {
        const zone: Zone = category === 'interval' ? 'I' : 'R'
        const repeats = category === 'interval' ? intervalSession(weeklyKm, speeds.I) : repetitionSession(weeklyKm, speeds.R)
        const workout = buildRepeatWorkout({
            category, categoryName, baseline, ...repeats, repSpeedKmh: speeds[zone], easySpeedKmh: easy,
        })
        if (speeds[zone] !== null && weeklyKm !== null) {
            workout.explanation.push(`The VDOT model caps ${ZONES[zone].name.toLowerCase()} running per session at the lesser of a share of your ${weeklyKm} km week and a fixed distance (${sessionCapKm(zone, weeklyKm).toFixed(2)} km), which allows ${repeats.reps} rep${repeats.reps === 1 ? '' : 's'}.`)
        }
        return finish(workout, zone)
    }

    const structure = SESSION_STRUCTURE
    const explanation: string[] = []
    const adjustments: string[] = []
    let main: PlanSection

    if (category === 'marathon' || (category === 'threshold' && distanceKm !== null)) {
        return finish(steadyWorkout({ category, categoryName, baseline, totalKm: distanceKm, weeklyKm, speeds, easy }),
            category === 'marathon' ? 'M' : 'T')
    }

    if (category === 'threshold') {
        const seconds = Math.floor(thresholdSessionSeconds(weeklyKm, speeds.T))
        main = section('main', 'run', 'Threshold run', { basis: 'time', durationSeconds: seconds }, speeds.T)
        main.effort = ZONES.T.purpose
        main.targetRpe = THRESHOLD_RPE
        explanation.push(`A steady ${formatSpan(seconds)} at threshold pace between an easy warm-up and cool-down: the standard VDOT threshold session, sized to your week.`)
        if (speeds.T === null) adjustments.push(`No race result, so no threshold pace: run this by effort (RPE ${THRESHOLD_RPE}).`)
        return finish({
            category, categoryName, baseline, explanation, adjustments,
            sections: [
                section('warmup', 'warmup', 'Warm-up', { basis: 'time', durationSeconds: structure.warmupSeconds }, easy),
                main,
                section('cooldown', 'cooldown', 'Cool-down', { basis: 'time', durationSeconds: structure.cooldownSeconds }, easy),
            ],
        }, 'T')
    }

    // A long run takes its cap; a plan's other E days take their share of the week.
    const isEasyDay = category === 'easyRun'
    const easyKm = isEasyDay ? distanceKm : weeklyKm !== null && easy !== null ? longRunCapKm(weeklyKm, easy) : null
    const fallbackSeconds = isEasyDay ? structure.easyFallbackSeconds : structure.longFallbackSeconds
    main = easyKm !== null && easy !== null
        ? section('main', 'run', 'Easy run', { basis: 'distance', distanceKm: tenthOfKm(easyKm) }, easy)
        : section('main', 'run', 'Easy run', { basis: 'time', durationSeconds: fallbackSeconds }, easy)
    main.effort = ZONES.E.purpose
    main.targetRpe = EASY_RPE
    explanation.push(isEasyDay && main.target.basis === 'distance'
        ? `An easy run of ${main.target.distanceKm} km: this day's share of your ${weeklyKm} km week after the hard days and the longest easy run.`
        : main.target.basis === 'distance'
        ? `The VDOT model sizes this Easy run by a share of your ${weeklyKm} km week and a maximum duration at easy pace: ${main.target.distanceKm} km.`
        : 'We need your weekly distance and an easy pace to size this run, so it is timed instead.')
    if (easy === null) {
        adjustments.push('We have no pace for you yet, so sections are timed and show effort instead of speed.')
    }
    return finish({ category, categoryName, baseline, sections: [main], explanation, adjustments }, 'E')
}

interface SteadyInput {
    category: WorkoutId
    categoryName: string
    baseline: PersonalBaseline
    /** The day's share of the week; the M or T block is capped and E running fills the rest. */
    totalKm: number | null
    weeklyKm: number | null
    speeds: Record<Zone, number | null>
    easy: number | null
}

/**
 * A plan day that replaces E running: E warm-up, a steady M or T block within its VDOT cap, and
 * E cool-down for the rest of the day's distance, so the week still reaches its target.
 */
function steadyWorkout(input: SteadyInput): PersonalizedWorkout {
    const { category, categoryName, baseline, totalKm, weeklyKm, speeds, easy } = input
    const zone: 'M' | 'T' = category === 'marathon' ? 'M' : 'T'
    const pace = speeds[zone]
    const rpe = zone === 'M' ? MARATHON_RPE : THRESHOLD_RPE
    const label = zone === 'M' ? 'Marathon pace' : 'Threshold run'
    const structure = SESSION_STRUCTURE
    const adjustments: string[] = []
    const withEffort = (item: PlanSection, effort: string, targetRpe: number) => ({ ...item, effort, targetRpe })

    if (totalKm === null || weeklyKm === null || pace === null || easy === null) {
        const seconds = zone === 'M' ? structure.marathonFallbackSeconds : Math.floor(thresholdSessionSeconds(weeklyKm, speeds.T))
        adjustments.push(`No race result or weekly distance to size this run, so it is timed: run the main block by effort (RPE ${rpe}).`)
        return {
            category, categoryName, baseline, adjustments,
            explanation: [`A steady ${formatSpan(seconds)} at ${ZONES[zone].name.toLowerCase()} effort between an easy warm-up and cool-down.`],
            sections: [
                section('warmup', 'warmup', 'Warm-up', { basis: 'time', durationSeconds: structure.warmupSeconds }, easy),
                withEffort(section('main', 'run', label, { basis: 'time', durationSeconds: seconds }, pace), ZONES[zone].purpose, rpe),
                section('cooldown', 'cooldown', 'Cool-down', { basis: 'time', durationSeconds: structure.cooldownSeconds }, easy),
            ],
        }
    }

    const capKm = zone === 'M'
        ? sessionCapKm('M', weeklyKm)
        : distanceFromSpeed(pace, thresholdSessionSeconds(weeklyKm, pace))
    // Warm-up and cool-down come first (10 min of E each, at most a quarter of the day apiece), then
    // the M or T block takes what its cap allows, and any distance left over is added to the cool-down.
    const easyEndKm = Math.min(distanceFromSpeed(easy, structure.warmupSeconds), totalKm / 4)
    const blockKm = tenthOfKm(Math.min(capKm, totalKm - 2 * easyEndKm))
    const rawWarmupKm = easyEndKm
    const rawCooldownKm = Math.max(0, totalKm - blockKm - rawWarmupKm)
    // tenthOfKm never returns less than 0.1, so a part shorter than that is left out entirely.
    const easyPart = (km: number) => (km >= MIN_PART_KM ? tenthOfKm(km) : 0)
    const warmupKm = easyPart(rawWarmupKm)
    const cooldownKm = easyPart(rawCooldownKm)
    const sections: PlanSection[] = [
        ...(warmupKm > 0 ? [section('warmup', 'warmup', 'Warm-up', { basis: 'distance', distanceKm: warmupKm }, easy)] : []),
        withEffort(section('main', 'run', label, { basis: 'distance', distanceKm: blockKm }, pace), ZONES[zone].purpose, rpe),
        ...(cooldownKm > 0 ? [section('cooldown', 'cooldown', 'Cool-down', { basis: 'distance', distanceKm: cooldownKm }, easy)] : []),
    ]
    return {
        category, categoryName, baseline, sections, adjustments,
        explanation: [`${blockKm} km at ${ZONES[zone].name.toLowerCase()} pace (the VDOT model allows up to ${capKm.toFixed(2)} km in one session of a ${weeklyKm} km week), with easy running before and after to make up this day's ${tenthOfKm(totalKm)} km.`],
    }
}

/** A single workout from the session picker, with the fitness and goal context of the runner's answers. */
export function generatePersonalizedWorkout(input: WorkoutInput & { today?: Date }): PersonalizedWorkout {
    const { baseline, today = new Date() } = input
    const workout = buildWorkout(input)
    const rawSpeeds = baseline.vdot === null ? null : trainingSpeedsKmh(baseline.vdot)
    const notes = [fitnessNote(baseline, rawSpeeds), goalNote(baseline, today)].filter((note): note is string => note !== null)
    return {
        ...workout,
        explanation: [...notes, ...workout.explanation],
        adjustments: [...qualityAdvice(input.category, baseline), ...workout.adjustments],
    }
}

/** VDOT Base effort has no speed days, so a speed session is extra. */
function qualityAdvice(category: WorkoutId, baseline: PersonalBaseline): string[] {
    return QUALITY.includes(category) && baseline.trainingEffort !== null && qualitySessionsPerWeek(baseline.trainingEffort) === 0
        ? ['Your training effort is Base, which has no speed days. Treat this session as optional extra work.']
        : []
}
