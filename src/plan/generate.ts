import { WORKOUT_NAMES, type WorkoutId } from '../workouts'
import { formatSpan } from './convert'
import { EASY_RPE, THRESHOLD_RPE } from './copy'
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

export interface WorkoutInput {
    category: WorkoutId
    baseline: PersonalBaseline
    /** Distance of an E running session ('filler'); the plan builder sizes it from the week's volume. */
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

    const isLong = category === 'long'
    const cap = weeklyKm !== null && easy !== null ? longRunCapKm(weeklyKm, easy) : null
    const km = isLong ? cap : distanceKm
    const label = isLong ? 'Long run' : 'E running'
    main = km !== null && easy !== null
        ? section('main', 'run', label, { basis: 'distance', distanceKm: tenthOfKm(km) }, easy)
        : section('main', 'run', label,
            { basis: 'time', durationSeconds: isLong ? structure.longFallbackSeconds : structure.easyFallbackSeconds }, easy)
    main.effort = ZONES.E.purpose
    main.targetRpe = EASY_RPE
    explanation.push(main.target.basis === 'distance'
        ? isLong
            ? `The VDOT model caps a long run by a share of your ${weeklyKm} km week and by a maximum time at easy pace: ${main.target.distanceKm} km.`
            : `Easy running that fills your week: ${main.target.distanceKm} km at your VDOT easy pace.`
        : 'We need your weekly distance and an easy pace to size this run, so it is timed instead.')
    if (easy === null) {
        adjustments.push('We have no pace for you yet, so sections are timed and show effort instead of speed.')
    }
    return finish({ category, categoryName, baseline, sections: [main], explanation, adjustments }, 'E')
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
