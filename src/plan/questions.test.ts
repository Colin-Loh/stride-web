import { describe, expect, it } from 'vitest'
import {
    answerError, isAnswers, missingQuestions, QUESTIONS, toIsoDate, valueError, visibleQuestions, type AnswerValues,
} from './questions'

const TODAY = new Date(2026, 9, 8)
const ids = (answers: AnswerValues) => visibleQuestions(answers).map((q) => q.id)

const COMPLETE: AnswerValues = {
    fitness_method: 'recent_race', recent_race_distance: 5, recent_race_time: 1500,
    training_focus: '10k', weekly_volume: 30, running_days: 3, training_effort: 'base',
}

describe('question list', () => {
    it('is exactly the core VDOT and plan inputs, in order', () => {
        expect(QUESTIONS.map((q) => q.id)).toEqual([
            'fitness_method', 'recent_race_distance', 'recent_race_time', 'estimated_distance_time', 'conversational_easy_pace',
            'training_focus', 'weekly_volume', 'running_days', 'training_effort', 'goal_race_date',
        ])
    })

    it('has unique ids and a label and canonical unit on every question', () => {
        expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length)
        for (const q of QUESTIONS) expect(q.label.length).toBeGreaterThan(5)
    })

    it('uses the requested fitness question labels and choice copy', () => {
        const question = (id: string) => QUESTIONS.find((item) => item.id === id)!
        expect(question('fitness_method').label).toBe('Current Running Fitness?')
        expect(question('recent_race_distance').label).toBe('TOTAL DISTANCE YOU RAN?')
        expect(question('estimated_distance_time').label).toBe('DISTANCE AND TIME YOU COULD RUN?')
        expect(question('conversational_easy_pace').label).toBe('WHAT IS YOUR TYPICAL PACE?')
        expect(question('recent_race_time').label).toBe('TOTAL ELAPSED RUN TIME?')
        expect(question('running_days').label).toBe('TOTAL DAYS PER WEEK YOU RUN?')
        expect(question('training_effort').label).toBe('QUALITY WORKOUT DAYS?')
        expect(question('goal_race_date').label).toBe('WHEN IS YOUR RACE?')
        expect(question('fitness_method').input).toMatchObject({
            options: expect.arrayContaining([
                { value: 'estimated_race', label: 'MY ESTIMATED PACE I CAN RUN' },
                { value: 'easy_pace', label: 'MY CONVERSATIONAL PACE' },
            ]),
        })
        expect(question('conversational_easy_pace')).not.toHaveProperty('hint')
        expect(question('goal_race_date')).not.toHaveProperty('hint')
        expect(question('training_effort').input).toMatchObject({
            options: [
                { value: 'base', label: 'ONLY EASY RUN' },
                { value: 'base_quality', label: '1 SPEED DAY' },
                { value: 'advanced_quality', label: '2 SPEED DAY' },
            ],
        })
    })

    it('offers Base fitness as a training-focus choice', () => {
        const focus = QUESTIONS.find((question) => question.id === 'training_focus')!
        expect(focus.input.type).toBe('choice')
        if (focus.input.type === 'choice') expect(focus.input.options).toContainEqual({ value: 'base', label: 'Base fitness' })
        expect(isAnswers({ ...COMPLETE, training_focus: 'base' })).toBe(true)
    })

    it('has no trace of the removed questions', () => {
        const text = JSON.stringify(QUESTIONS).toLowerCase()
        for (const gone of ['walk', 'continuity', 'comfortable', 'available', 'injur', 'altitude', 'heart rate', 'weekday', 'scheduled']) {
            expect(text).not.toContain(gone)
        }
    })
})

describe('conditional questions', () => {
    it('asks one fitness branch at a time', () => {
        expect(ids({ fitness_method: 'recent_race' })).toEqual(expect.arrayContaining(['recent_race_distance', 'recent_race_time']))
        expect(ids({ fitness_method: 'recent_race' })).not.toContain('estimated_distance_time')
        expect(ids({ fitness_method: 'estimated_race' })).toContain('estimated_distance_time')
        expect(ids({ fitness_method: 'easy_pace' })).toContain('conversational_easy_pace')
        expect(ids({})).not.toContain('recent_race_time')
    })

    it('asks for a goal date only when training for a race', () => {
        expect(ids({ training_focus: 'base' })).not.toContain('goal_race_date')
        expect(ids({ training_focus: 'marathon' })).toContain('goal_race_date')
    })
})

describe('validation', () => {
    it('is complete once every required, asked question has a valid answer', () => {
        expect(missingQuestions(COMPLETE, TODAY)).toEqual([])
    })

    it('lists the required questions that are missing', () => {
        expect(missingQuestions({}, TODAY).map((q) => q.id)).toEqual(
            ['fitness_method', 'training_focus', 'weekly_volume', 'running_days', 'training_effort'])
        expect(missingQuestions({ ...COMPLETE, recent_race_time: undefined }, TODAY).map((q) => q.id)).toEqual(['recent_race_time'])
    })

    it('does not require the optional goal race date', () => {
        expect(QUESTIONS.filter((q) => !q.required).map((q) => q.id)).toEqual(['goal_race_date'])
        expect(answerError(QUESTIONS.find((q) => q.id === 'goal_race_date')!, {}, TODAY)).toBeNull()
        expect(missingQuestions({ ...COMPLETE, training_focus: '10k' }, TODAY)).toEqual([])
    })

    it('validates numbers against min, max and integer', () => {
        const days = QUESTIONS.find((q) => q.id === 'running_days')!.input
        expect([0, 1, 7, 8, 2.5, Number.NaN, '3'].map((v) => valueError(days, v) === null)).toEqual([false, true, true, false, false, false, false])
        const weekly = QUESTIONS.find((q) => q.id === 'weekly_volume')!.input
        expect([0, 42.5, -1].map((v) => valueError(weekly, v) === null)).toEqual([true, true, false])
    })

    it('accepts only preset race distances and positive times', () => {
        expect(valueError({ type: 'distance' }, 5)).toBeNull()
        expect(valueError({ type: 'distance' }, 4.2)).not.toBeNull()
        expect(valueError({ type: 'duration' }, 0)).not.toBeNull()
        expect(valueError({ type: 'distanceTime' }, { distanceKm: 10, seconds: 3000 })).toBeNull()
        expect(valueError({ type: 'distanceTime' }, { distanceKm: 10 })).not.toBeNull()
    })

    it('validates calendar dates, and future dates only when asked', () => {
        const future = { type: 'date', future: true } as const
        expect(valueError(future, '2026-10-09', TODAY)).toBeNull()
        expect(valueError(future, '2026-10-08', TODAY)).not.toBeNull()
        expect(valueError(future, '2026-02-30', TODAY)).not.toBeNull()
        expect(valueError(future, '2020-01-01')).toBeNull()
        expect(toIsoDate(TODAY)).toBe('2026-10-08')
    })
})

describe('stored answers', () => {
    it('accepts answers in the new format, including an old goal date', () => {
        expect(isAnswers({})).toBe(true)
        expect(isAnswers({ ...COMPLETE, goal_race_date: '2020-01-01' })).toBe(true)
    })

    it('rejects the old question format and malformed values', () => {
        expect(isAnswers({ raceKnown: true, raceDistanceKm: 5, raceSeconds: 1500, weeklyKm: 30, daysPerWeek: 3 })).toBe(false)
        expect(isAnswers({ running_days: 'three' })).toBe(false)
        expect(isAnswers([])).toBe(false)
        expect(isAnswers(null)).toBe(false)
    })

    it('rejects answers that still carry a removed question', () => {
        const removed = {
            recent_race_date: '2026-09-01', preferred_days: ['sat'], other_races: [{ distanceKm: 10, date: '2027-03-01' }],
            recent_break_injury_history: 'none', experience_history: '2 years', age_sex: '40 M', max_hr: 185, weather_altitude: '20 °C',
        }
        for (const [id, value] of Object.entries(removed)) expect(isAnswers({ ...COMPLETE, [id]: value })).toBe(false)
    })
})
