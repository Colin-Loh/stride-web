import { WORKOUTS, type WorkoutId } from '../workouts'
import { distanceFromSpeed, formatSpan, roundSpeedUp } from './convert'
import { EASY_RPE, TEMPO_RPE } from './copy'
import {
    longRunCapKm, qualitySessionsPerWeek, SESSION_STRUCTURE, sessionCapKm, thresholdSessionSeconds,
    trainingSpeedsKmh, ZONES, type TrainingSpeeds, type Zone,
} from './daniels'
import { goalNote, fitnessNote, zoneNote } from './explanations'
import { section } from './builderHelpers'
import { buildRepeatWorkout } from './repeats'
import type { PersonalBaseline, PersonalizedWorkout, PlanSection } from './types'

export { calculateSectionMetrics, calculateWorkoutTotals } from './metrics'
export { validateWorkout } from './validation'
export { setSectionSpeed, setSectionPace, setSectionTargetValue } from './edit'
export { planToSchema } from './schema'

/** The sound-check test run is three sections of this length. */
const TEST_SECTION_SECONDS = 30

/** Distance targets round down to 0.1 km, never to zero. */
const tenthOfKm = (km: number) => Math.max(0.1, Math.floor(km * 10) / 10)

const roundedOrNull = (speedKmh: number | null) => (speedKmh === null ? null : roundSpeedUp(speedKmh))

/** Treadmill speeds for every zone, rounded up like every other generated speed. */
function roundedSpeeds(speeds: TrainingSpeeds | null): Record<Zone, number | null> {
    const zones = Object.keys(ZONES) as Zone[]
    return Object.fromEntries(zones.map((zone) => [zone, roundedOrNull(speeds?.[zone] ?? null)])) as Record<Zone, number | null>
}

const QUALITY: readonly WorkoutId[] = ['tempo', 'cruise', 'interval']

export function generatePersonalizedWorkout(input: {
    category: WorkoutId
    baseline: PersonalBaseline
    today?: Date
}): PersonalizedWorkout {
    const { category, baseline, today = new Date() } = input
    const categoryName = WORKOUTS.find((workout) => workout.id === category)?.name ?? category
    const rawSpeeds = baseline.vdot === null ? null : trainingSpeedsKmh(baseline.vdot)
    const speeds = roundedSpeeds(rawSpeeds)
    // Without a VDOT, easy running falls back to the pace the runner reported.
    const easy = speeds.E ?? roundedOrNull(baseline.reportedEasySpeedKmh)
    const weeklyKm = baseline.weeklyKm !== null && baseline.weeklyKm > 0 ? baseline.weeklyKm : null

    const notes = [fitnessNote(baseline, rawSpeeds), goalNote(baseline, today)]
    const finish = (plan: PersonalizedWorkout, zone: Zone): PersonalizedWorkout => ({
        ...plan,
        explanation: [...notes.filter((note): note is string => note !== null), zoneNote(zone), ...plan.explanation],
        adjustments: [...qualityAdvice(category, baseline), ...plan.adjustments],
    })

    if (category === 'test') {
        const part = (id: PlanSection['type'], label: string) =>
            section(id, id, label, { basis: 'time', durationSeconds: TEST_SECTION_SECONDS }, easy)
        return {
            category, categoryName, baseline,
            sections: [part('warmup', 'Warm-up'), part('run', 'Steady section'), part('cooldown', 'Cool-down')],
            explanation: ['Three fixed 30-second sections. Speed changes never shorten this test.'],
            adjustments: [],
        }
    }

    if (category === 'cruise') {
        const cruise = SESSION_STRUCTURE.cruise
        const workSeconds = thresholdSessionSeconds(weeklyKm, speeds.T)
        const reps = Math.max(cruise.minReps, Math.floor(workSeconds / cruise.repSeconds))
        return finish(buildRepeatWorkout({
            category, categoryName, baseline, reps, repSeconds: cruise.repSeconds, recoverySeconds: cruise.recoverySeconds,
            repSpeedKmh: speeds.T, easySpeedKmh: easy,
        }), 'T')
    }

    if (category === 'interval') {
        const interval = SESSION_STRUCTURE.interval
        const repKm = speeds.I === null ? null : distanceFromSpeed(speeds.I, interval.repSeconds)
        const reps = repKm !== null && weeklyKm !== null
            ? Math.max(1, Math.floor(sessionCapKm('I', weeklyKm) / repKm + 1e-9))
            : SESSION_STRUCTURE.intervalFallbackReps
        const plan = buildRepeatWorkout({
            category, categoryName, baseline, reps, repSeconds: interval.repSeconds,
            recoverySeconds: interval.repSeconds * interval.recoveryPerWorkSecond,
            repSpeedKmh: speeds.I, easySpeedKmh: easy,
        })
        if (repKm !== null && weeklyKm !== null) {
            plan.explanation.push(`Daniels caps interval running per session as a share of your ${weeklyKm} km week, which allows ${reps} rep${reps === 1 ? '' : 's'}.`)
        }
        return finish(plan, 'I')
    }

    const structure = SESSION_STRUCTURE
    const explanation: string[] = []
    const adjustments: string[] = []
    let main: PlanSection
    let zone: Zone = 'E'

    if (category === 'tempo') {
        zone = 'T'
        const seconds = Math.floor(thresholdSessionSeconds(weeklyKm, speeds.T))
        main = section('main', 'run', 'Threshold run', { basis: 'time', durationSeconds: seconds }, speeds.T)
        main.effort = ZONES.T.purpose
        main.targetRpe = TEMPO_RPE
        explanation.push(`A steady ${formatSpan(seconds)} at threshold pace, Daniels' standard tempo run, sized to your week.`)
        if (speeds.T === null) adjustments.push('No race result, so no threshold pace: run this by effort (RPE 7).')
    } else {
        const isLong = category === 'long'
        const cap = weeklyKm !== null && easy !== null ? longRunCapKm(weeklyKm, easy) : null
        const km = isLong
            ? cap
            : weeklyKm !== null && cap !== null && baseline.daysPerWeek ? Math.min(weeklyKm / baseline.daysPerWeek, cap) : null
        main = km !== null && easy !== null
            ? section('main', 'run', isLong ? 'Long run' : 'Easy run', { basis: 'distance', distanceKm: tenthOfKm(km) }, easy)
            : section('main', 'run', isLong ? 'Long run' : 'Easy run',
                { basis: 'time', durationSeconds: isLong ? structure.longFallbackSeconds : structure.easyFallbackSeconds }, easy)
        main.effort = ZONES.E.purpose
        main.targetRpe = EASY_RPE
        explanation.push(main.target.basis === 'distance'
            ? isLong
                ? `Daniels caps a long run by a share of your ${weeklyKm} km week and by a maximum time at easy pace: ${main.target.distanceKm} km.`
                : `Your ${weeklyKm} km week over ${baseline.daysPerWeek} running days, no longer than a long run: ${main.target.distanceKm} km.`
            : 'We need your weekly distance and an easy pace to size this run, so it is timed instead.')
    }

    const quality = category === 'tempo'
    const sections: PlanSection[] = quality
        ? [
            section('warmup', 'warmup', 'Warm-up', { basis: 'time', durationSeconds: structure.warmupSeconds }, easy),
            main,
            section('cooldown', 'cooldown', 'Cool-down', { basis: 'time', durationSeconds: structure.cooldownSeconds }, easy),
        ]
        : [main]
    if (easy === null) {
        adjustments.push('We have no pace for you yet, so sections are timed and show effort instead of speed.')
    }
    return finish({ category, categoryName, baseline, sections, explanation, adjustments }, zone)
}

/** Daniels' Base effort has no speed days, so a speed session is extra. */
function qualityAdvice(category: WorkoutId, baseline: PersonalBaseline): string[] {
    return QUALITY.includes(category) && baseline.trainingEffort !== null && qualitySessionsPerWeek(baseline.trainingEffort) === 0
        ? ['Your training effort is Base, which has no speed days. Treat this session as optional extra work.']
        : []
}
