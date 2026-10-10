import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PlanScreen } from './PlanScreen'
import { derivePersonalBaseline } from '../plan/baseline'
import { formatPaceSeconds, roundSpeedUp } from '../plan/convert'
import { trainingSpeedsKmh, vdotFromRace, ZONES } from '../plan/vdot'
import type { AnswerValues } from '../plan/questions'
import { generateTrainingPlan } from '../plan/trainingPlan'
import { addDays } from '../plan/dates'

const noop = () => { }
const NOW = new Date(2026, 9, 8)
const BASE: AnswerValues = { training_focus: 'base', weekly_volume: 15, running_days: 3, training_effort: 'base' }
const render = (answers: AnswerValues, today = NOW) => {
    const plan = generateTrainingPlan({ baseline: derivePersonalBaseline({ ...BASE, ...answers }), now: NOW })!
    return renderToStaticMarkup(<PlanScreen plan={plan} today={today} onOpenSession={noop} onBack={noop} />)
}
const RACE: AnswerValues = { fitness_method: 'recent_race', recent_race_distance: 5, recent_race_time: 35 * 60 }

describe('pace cards', () => {
    it('shows E, M, T, I and R with letter, name, min/km, km/h and purpose for a known VDOT', () => {
        const html = render(RACE)
        const speeds = trainingSpeedsKmh(vdotFromRace(5, 35 * 60)!)!
        const cards = [...html.matchAll(/<article[^>]*data-zone="([EMTIR])"[^>]*>(.*?)<\/article>/g)]
        expect(cards.map((card) => card[1])).toEqual(['E', 'M', 'T', 'I', 'R'])
        for (const [, zone, body] of cards) {
            const key = zone as keyof typeof ZONES
            expect(body).toContain(ZONES[key].name)
            expect(body).toContain(`${formatPaceSeconds(Math.round(3600 / speeds[key]))} min/km`)
            expect(body).toContain(`${roundSpeedUp(speeds[key]).toFixed(1)} km/h`)
            expect(body).toContain(ZONES[key].purpose)
        }
        expect(html).not.toContain('need a race result')
    })

    it('shows E only, with a note, when there is no VDOT', () => {
        const html = render({ fitness_method: 'easy_pace', conversational_easy_pace: 420 })
        expect([...html.matchAll(/data-zone="([EMTIR])"/g)].map((match) => match[1])).toEqual(['E'])
        expect(html).toContain('7:00 min/km')
        expect(html).toContain('8.6 km/h')
        expect(html).toContain('need a race result')
    })
})

describe('week by week', () => {
    it('lists 12 weeks and highlights the current one', () => {
        const html = render(RACE, new Date(2026, 10, 12))
        expect(html.match(/<li class="week/g)).toHaveLength(12)
        expect(html.match(/aria-current="date"/g)).toHaveLength(1)
        expect(html).toMatch(/class="week current"[^>]*aria-current="date"><h3><button[^>]*>Week 6 /)
    })

    it('shows the current Easy run label even when a saved session has the old name', () => {
        const plan = generateTrainingPlan({ baseline: derivePersonalBaseline({ ...BASE, ...RACE }), now: NOW })!
        const long = plan.weeks[0].sessions.find((session) => session.kind === 'long')!
        long.name = 'Long run'

        const html = renderToStaticMarkup(<PlanScreen plan={plan} today={NOW} onOpenSession={noop} onBack={noop} />)

        expect(html).toContain('<strong>Easy run</strong>')
        expect(html).not.toContain('<strong>Long run</strong>')
    })

    it('renders the sessions of the expanded week only', () => {
        const plan = generateTrainingPlan({ baseline: derivePersonalBaseline({ ...BASE, ...RACE }), now: NOW })!
        const html = renderToStaticMarkup(<PlanScreen plan={plan} today={NOW} onOpenSession={noop} onBack={noop} />)
        expect(html.match(/class="choice workout"/g)).toHaveLength(plan.weeks[0].sessions.length)
    })

    it('marks the taper weeks before a goal race', () => {
        const html = render({ ...RACE, training_focus: 'half_marathon', goal_race_date: '2026-12-20', running_days: 4 })
        const weeks = [...html.matchAll(/<li class="week[^"]*"[^>]*>(.*?)<\/li>/g)].map((match) => match[1])
        expect(weeks.map((week) => week.includes('>Taper<'))).toEqual([...Array(9).fill(false), true, true])
        expect(weeks.at(-1)).toContain('Taper')
        expect(render(RACE)).not.toContain('>Taper<')
    })
})

describe('collapsible weeks', () => {
    const planFor = (answers: AnswerValues = RACE) => generateTrainingPlan({ baseline: derivePersonalBaseline({ ...BASE, ...answers }), now: NOW })!
    const at = (isoDate: string) => new Date(`${isoDate}T12:00:00`)
    const expandedWeeks = (html: string) => [...html.matchAll(/aria-expanded="true"[^>]*aria-label="Week (\d+),/g)].map((match) => Number(match[1]))
    const toggleLabels = (html: string) => [...html.matchAll(/aria-label="(Week [^"]*)"/g)].map((match) => match[1])

    it('expands only the current week, and the others keep their headings', () => {
        const plan = planFor()
        expect(plan.weeks).toHaveLength(12)
        const html = render(RACE, at(addDays(plan.startDate, 4 * 7 + 2))) // a day in week 5
        expect(expandedWeeks(html)).toEqual([5])
        expect(html.match(/aria-expanded="false"/g)).toHaveLength(11)
        expect(html.match(/class="week[^"]*is-collapsed"/g)).toHaveLength(11)
        for (const week of plan.weeks) expect(html).toContain(`Week ${week.number} · ${week.targetKm.toFixed(1)} km`)
    })

    it('expands week 1 when today is before the plan starts', () => {
        const plan = planFor()
        expect(expandedWeeks(render(RACE, at(addDays(plan.startDate, -20))))).toEqual([1])
    })

    it('expands the last week when today is after the plan ends', () => {
        const plan = planFor()
        expect(expandedWeeks(render(RACE, at(addDays(plan.startDate, 12 * 7 + 30))))).toEqual([12])
    })

    it('gives every toggle an accessible name with the week number and state', () => {
        const plan = planFor()
        const labels = toggleLabels(render(RACE, at(addDays(plan.startDate, 4 * 7))))
        expect(labels).toHaveLength(12)
        expect(labels[0]).toMatch(/^Week 1, \d+\.\d km, collapsed$/)
        expect(labels[4]).toMatch(/^Week 5, \d+\.\d km, expanded$/)
    })

    it('renders session buttons only for the expanded week', () => {
        const plan = planFor()
        const html = render(RACE, at(addDays(plan.startDate, 4 * 7)))
        expect(html.match(/class="choice workout"/g)).toHaveLength(plan.weeks[4].sessions.length)
    })
})
