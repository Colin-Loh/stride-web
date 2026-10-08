import { describe, expect, it } from 'vitest'
import {
    answerError, isAnswers, missingQuestions, QUESTIONS, toIsoDate, valueError, visibleQuestions, type Answers,
} from './questions'

const TODAY = new Date(2026, 9, 8)
const ids = (answers: Answers) => visibleQuestions(answers).map((q) => q.id)

const COMPLETE: Answers = {
    fitness_method: 'recent_race', recent_race_distance: 5, recent_race_time: 1500,
    training_focus: 'base', weekly_volume: 30, running_days: 3, training_effort: 'base',
}

describe('question list', () => {
    it('is exactly the spec table, in order', () => {
        expect(QUESTIONS.map((q) => q.id)).toEqual([
            'fitness_method', 'recent_race_distance', 'recent_race_time', 'recent_race_date', 'estimated_distance_time',
            'conversational_easy_pace', 'training_focus', 'weekly_volume', 'running_days', 'training_effort', 'preferred_days',
            'goal_race_date', 'other_races', 'recent_break_injury_history', 'experience_history', 'age_sex', 'max_hr', 'weather_altitude',
        ])
    })

    it('has unique ids and a label and canonical unit on every question', () => {
        expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length)
        for (const q of QUESTIONS) expect(q.label.length).toBeGreaterThan(5)
    })

    it('has no trace of the removed questions', () => {
        const text = JSON.stringify(QUESTIONS).toLowerCase()
        for (const gone of ['walk', 'continuity', 'comfortable', 'available']) expect(text).not.toContain(gone)
    })
})

describe('conditional questions', () => {
    it('asks one fitness branch at a time', () => {
        expect(ids({ fitness_method: 'recent_race' })).toEqual(expect.arrayContaining(['recent_race_distance', 'recent_race_time', 'recent_race_date']))
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

    it('does not require optional questions', () => {
        expect(answerError(QUESTIONS.find((q) => q.id === 'max_hr')!, {}, TODAY)).toBeNull()
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

    it('validates races and weekday lists', () => {
        expect(valueError({ type: 'raceList' }, [{ distanceKm: 10, date: '2027-03-01' }])).toBeNull()
        expect(valueError({ type: 'raceList' }, [{ distanceKm: 10, date: 'soon' }])).not.toBeNull()
        const days = QUESTIONS.find((q) => q.id === 'preferred_days')!.input
        expect([valueError(days, ['sat', 'sun']), valueError(days, ['funday'])].map((e) => e === null)).toEqual([true, false])
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
})
