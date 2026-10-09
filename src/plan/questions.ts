import { RACE_DISTANCES, TRAINING_EFFORTS, TRAINING_FOCUSES } from './vdot'

/**
 * Every onboarding question, defined once as data. The screen renders this list generically and
 * the plan builder reads the answers by id. The list keeps only the questions from the research
 * spec's "Required onboarding questions" table that feed the VDOT formula or plan generation.
 * "Required" is the spec's recommended local contract, not a claim that V.O2 marks these fields
 * required.
 */

export interface Option {
    value: string
    label: string
}

export interface DistanceTime {
    distanceKm: number
    seconds: number
}

export type AnswerValue = string | number | DistanceTime

export type Input =
    | { type: 'choice'; options: readonly Option[] }
    /** One of the preset race distances; the value is kilometres. */
    | { type: 'distance' }
    /** Elapsed time as h:mm:ss or mm:ss; the value is seconds. */
    | { type: 'duration' }
    /** Pace as mm:ss per kilometre; the value is seconds per kilometre. */
    | { type: 'pace' }
    /** ISO calendar date. `future` requires a date after today. */
    | { type: 'date'; future?: boolean }
    | { type: 'number'; min: number; max?: number; integer?: boolean; step: number }
    | { type: 'distanceTime' }

/** Shown only while another answer is one of these values. */
export interface Condition {
    id: string
    in: readonly string[]
}

export interface Question {
    id: string
    label: string
    input: Input
    /** Canonical unit of the stored answer, for display. Null when it has none. */
    units: string | null
    /** Required whenever the question is asked. */
    required: boolean
    askWhen?: Condition
    hint?: string
}

const toOptions = (items: readonly { id: string; label: string }[]): Option[] =>
    items.map((item) => ({ value: item.id, label: item.label }))

const RACE_FOCUSES = TRAINING_FOCUSES.filter((focus) => focus.id !== 'base').map((focus) => focus.id)

export const QUESTIONS = [
    {
        id: 'fitness_method',
        label: 'How should we estimate your current running fitness?',
        input: {
            type: 'choice',
            options: [
                { value: 'recent_race', label: 'A recent race or time trial' },
                { value: 'estimated_race', label: 'My estimate of a race I could run today' },
                { value: 'easy_pace', label: 'My typical conversational easy pace' },
            ],
        },
        units: null,
        required: true,
        hint: 'An actual result gives the best paces. An estimate or an easy pace is provisional.',
    },
    {
        id: 'recent_race_distance',
        label: 'What distance did you race or time-trial?',
        input: { type: 'distance' },
        units: 'km',
        required: true,
        askWhen: { id: 'fitness_method', in: ['recent_race'] },
    },
    {
        id: 'recent_race_time',
        label: 'What was your elapsed finish time?',
        input: { type: 'duration' },
        units: 'h:mm:ss',
        required: true,
        askWhen: { id: 'fitness_method', in: ['recent_race'] },
    },
    {
        id: 'estimated_distance_time',
        label: 'Without a recent race, what distance and time could you race today?',
        input: { type: 'distanceTime' },
        units: 'km, h:mm:ss',
        required: true,
        askWhen: { id: 'fitness_method', in: ['estimated_race'] },
    },
    {
        id: 'conversational_easy_pace',
        label: 'If you cannot estimate a race, what is your typical conversational easy pace?',
        input: { type: 'pace' },
        units: 'min/km',
        required: true,
        askWhen: { id: 'fitness_method', in: ['easy_pace'] },
        // TODO(verify): the easy-pace to VDOT mapping is unpublished, so no VDOT is derived from it.
        hint: 'A pace you could hold while talking in full sentences. It sets easy running only; speed sessions need a race result.',
    },
    {
        id: 'training_focus',
        label: 'What are you training for?',
        input: { type: 'choice', options: toOptions(TRAINING_FOCUSES) },
        units: null,
        required: true,
    },
    {
        id: 'weekly_volume',
        label: 'How much can you safely run in a typical current week?',
        input: { type: 'number', min: 0, integer: false, step: 1 },
        units: 'km/week',
        required: true,
        hint: 'Your current safe distance, not a peak you hope to reach.',
    },
    {
        id: 'running_days',
        label: 'How many days per week can you run consistently?',
        // TODO(verify): official bounds are unpublished; 1-7 is the spec's sensible UI range.
        input: { type: 'number', min: 1, max: 7, integer: true, step: 1 },
        units: 'days/week',
        required: true,
    },
    {
        id: 'training_effort',
        label: 'How many quality workouts are appropriate now?',
        input: { type: 'choice', options: toOptions(TRAINING_EFFORTS) },
        units: null,
        required: true,
        hint: 'Every option includes an Easy run. When unsure, choose Base.',
    },
    {
        id: 'goal_race_date',
        label: 'When is your goal race?',
        input: { type: 'date', future: true },
        units: 'YYYY-MM-DD',
        required: false,
        askWhen: { id: 'training_focus', in: RACE_FOCUSES },
        // TODO(verify): plan-length constraints for a goal date are unpublished.
        hint: 'Leave blank if there is no date yet.',
    },
] as const satisfies readonly Question[]

export type QuestionId = (typeof QUESTIONS)[number]['id']

export type AnswerValues = Partial<Record<QuestionId, AnswerValue>>

const QUESTION_IDS: ReadonlySet<string> = new Set(QUESTIONS.map((question) => question.id))

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

const isPositiveNumber = (value: unknown): value is number => isFiniteNumber(value) && value > 0

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

function isIsoDate(value: unknown): value is string {
    if (typeof value !== 'string') return false
    const match = ISO_DATE.exec(value)
    if (!match) return false
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    return date.toISOString().startsWith(value)
}

/** Today's local calendar date as YYYY-MM-DD. */
export function toIsoDate(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const isPresetDistance = (value: unknown): value is number =>
    isFiniteNumber(value) && RACE_DISTANCES.some((race) => Math.abs(race.km - value) < 1e-9)

/**
 * Why a value does not fit its input, or null when it does. `today` enables date-relative rules;
 * stored answers are checked without it so an old goal date never discards the whole record.
 */
export function valueError(input: Input, value: unknown, today?: Date): string | null {
    switch (input.type) {
        case 'choice':
            return input.options.some((option) => option.value === value) ? null : 'Choose one of the options.'
        case 'distance':
            return isPresetDistance(value) ? null : 'Choose a distance from the list.'
        case 'duration':
            return isPositiveNumber(value) ? null : 'Enter a time as m:ss or h:mm:ss, for example 27:30 or 1:58:00.'
        case 'pace':
            return isPositiveNumber(value) ? null : 'Enter a pace as m:ss per kilometre, for example 6:30.'
        case 'date':
            if (!isIsoDate(value)) return 'Enter a valid date.'
            return input.future && today && value <= toIsoDate(today) ? 'Choose a date in the future.' : null
        case 'number':
            if (!isFiniteNumber(value) || value < input.min || (input.max !== undefined && value > input.max)) {
                return input.max === undefined ? `Enter a number of at least ${input.min}.` : `Enter a number from ${input.min} to ${input.max}.`
            }
            return input.integer && !Number.isInteger(value) ? 'Enter a whole number.' : null
        case 'distanceTime':
            return isRecord(value) && isPresetDistance(value.distanceKm) && isPositiveNumber(value.seconds)
                ? null
                : 'Choose a distance and enter a time as m:ss or h:mm:ss.'
    }
}

/** Whether an optional or conditional question applies given the answers so far. */
export function isAsked(question: Question, answers: AnswerValues): boolean {
    const gate = question.askWhen
    if (!gate) return true
    const current = answers[gate.id as QuestionId]
    return typeof current === 'string' && gate.in.includes(current)
}

export function visibleQuestions(answers: AnswerValues): readonly Question[] {
    return QUESTIONS.filter((question) => isAsked(question, answers))
}

/** Error to show for a question's current answer. An empty optional answer is fine. */
export function answerError(question: Question, answers: AnswerValues, today?: Date): string | null {
    const value = answers[question.id as QuestionId]
    if (value === undefined) return question.required ? 'This answer is required.' : null
    return valueError(question.input, value, today)
}

/** Asked questions that still lack a valid required answer. */
export function missingQuestions(answers: AnswerValues, today?: Date): Question[] {
    return visibleQuestions(answers).filter((question) => answerError(question, answers, today) !== null)
}

/**
 * Type guard for stored answers. Any unknown id fails, so answers from an older question list
 * (including questions since removed) are discarded with the usual storage notice.
 */
export function isAnswers(value: unknown): value is AnswerValues {
    if (!isRecord(value)) return false
    return Object.entries(value).every(([id, answer]) => {
        const question = QUESTIONS.find((candidate) => candidate.id === id)
        return QUESTION_IDS.has(id) && question !== undefined && valueError(question.input, answer) === null
    })
}
