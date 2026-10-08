import { speedFromPaceSecondsPerKm } from './convert'
import { vdotFromRace } from './daniels'
import type { AnswerValues, DistanceTime } from './questions'
import type { FitnessMethod, PersonalBaseline } from './types'

const numberAnswer = (value: unknown): number | null => (typeof value === 'number' ? value : null)

const textAnswer = (value: unknown): string | null => (typeof value === 'string' ? value : null)

function distanceTimeAnswer(value: unknown): DistanceTime | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
    const { distanceKm, seconds } = value as Partial<DistanceTime>
    return typeof distanceKm === 'number' && typeof seconds === 'number' ? { distanceKm, seconds } : null
}

const FITNESS_METHODS: readonly FitnessMethod[] = ['recent_race', 'estimated_race', 'easy_pace']

type Fitness = Pick<PersonalBaseline, 'vdot' | 'fitnessMethod' | 'race' | 'reportedEasySpeedKmh'>

/** Only the chosen fitness branch is read; answers left over from another branch are ignored. */
function readFitness(answers: AnswerValues): Fitness {
    const none: Fitness = { vdot: null, fitnessMethod: null, race: null, reportedEasySpeedKmh: null }
    const method = FITNESS_METHODS.find((candidate) => candidate === answers.fitness_method)
    if (method === undefined) return none

    if (method === 'easy_pace') {
        // TODO(verify): no calibrated mapping from easy pace to VDOT exists, so only easy speed is known.
        const pace = numberAnswer(answers.conversational_easy_pace)
        return { ...none, fitnessMethod: method, reportedEasySpeedKmh: pace === null ? null : speedFromPaceSecondsPerKm(pace) }
    }

    const estimate = distanceTimeAnswer(answers.estimated_distance_time)
    const distanceKm = method === 'recent_race' ? numberAnswer(answers.recent_race_distance) : estimate?.distanceKm ?? null
    const seconds = method === 'recent_race' ? numberAnswer(answers.recent_race_time) : estimate?.seconds ?? null
    const vdot = distanceKm === null || seconds === null ? null : vdotFromRace(distanceKm, seconds)
    return {
        ...none,
        fitnessMethod: method,
        vdot,
        race: vdot === null || distanceKm === null || seconds === null ? null : { distanceKm, seconds },
    }
}

/** Turns onboarding answers into the facts the plan builder uses. */
export function derivePersonalBaseline(answers: AnswerValues): PersonalBaseline {
    return {
        ...readFitness(answers),
        weeklyKm: numberAnswer(answers.weekly_volume),
        daysPerWeek: numberAnswer(answers.running_days),
        trainingEffort: textAnswer(answers.training_effort),
        trainingFocus: textAnswer(answers.training_focus),
        goalRaceDate: textAnswer(answers.goal_race_date),
    }
}
