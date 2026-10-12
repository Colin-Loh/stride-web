import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PlanScreen } from './PlanScreen'
import { derivePersonalBaseline } from '../plan/baseline'
import { formatPaceSeconds } from '../plan/convert'
import type { Zone } from '../plan/vdot'
import type { AnswerValues } from '../plan/questions'
import { generateTrainingPlan } from '../plan/trainingPlan'
import { addDays } from '../plan/dates'

const noop = () => { }
const NOW = new Date(2026, 9, 8)
const BASE: AnswerValues = { training_focus: 'base', weekly_volume: 15, running_days: 3, training_effort: 'base' }
const render = (answers: AnswerValues, today = NOW) => {
    const plan = generateTrainingPlan({ baseline: derivePersonalBaseline({ ...BASE, ...answers }), now: NOW })!
    return renderToStaticMarkup(<PlanScreen plan={plan} today={today} onOpenSession={noop} />)
}
const RACE: AnswerValues = { fitness_method: 'recent_race', recent_race_distance: 5, recent_race_time: 35 * 60 }
const SESSION_ZONES = { long: 'E', easyRun: 'E', threshold: 'T', interval: 'I', repetition: 'R', marathon: 'M' } as const

describe('weekly workout paces', () => {
    it('shows each session pace in its weekly card instead of standalone pace cards', () => {
        const answers = { ...BASE, ...RACE, training_effort: 'advanced_quality' as const, running_days: 5 }
        const plan = generateTrainingPlan({ baseline: derivePersonalBaseline(answers), now: NOW })!
        const html = renderToStaticMarkup(<PlanScreen plan={plan} today={NOW} onOpenSession={noop} />)
        const cards = [...html.matchAll(/<button[^>]*class="choice workout" data-zone="([EMTIR])"[^>]*>(.*?)<\/button>/g)]

        expect(html).not.toContain('Recommended Training Paces')
        expect(html).not.toContain('pace-cards')
        expect(cards.map((card) => card[1])).toEqual(plan.weeks[0].sessions.map((session) => SESSION_ZONES[session.kind]))
        for (const [, zone, body] of cards) {
            const pace = plan.paces.zones[zone as Zone]!
            expect(body).toContain(`Pace: ${formatPaceSeconds(pace.paceSecondsPerKm)} min/km`)
            expect(body).toContain(`Treadmill: ${pace.speedKmh.toFixed(1)}km/h`)
            expect(body).toMatch(/Dist: \d+\.\d km/)
            expect(body).toMatch(/class="session-purpose">[^<]+<\/span>/)
            expect(body).toContain('class="session-workout"')
        }
    })

    it('shows a reported easy pace and effort guidance when race paces are unavailable', () => {
        const answers = { ...BASE, fitness_method: 'easy_pace' as const, conversational_easy_pace: 420, training_effort: 'advanced_quality' as const, running_days: 5 }
        const html = render(answers)

        expect(html).toContain('7:00 min/km')
        expect(html).toContain('Treadmill: 8.6km/h')
        expect(html).toContain('Pace: Run by effort')
        expect(html).toContain('Treadmill: unavailable')
        expect(html).toContain('Add a race result to estimate pace.')
    })
})

describe('fitness summary', () => {
    it('shows race pace and VDOT as concise fitness facts, hiding legacy paragraphs', () => {
        const plan = generateTrainingPlan({ baseline: derivePersonalBaseline({ ...BASE, ...RACE }), now: NOW })!
        plan.notes.unshift(
            'Your 5 km in 35:00 gives a VDOT of 25.6. VDOT training paces: old saved text.',
            'The VDOT model caps the long run at a share of the week; old saved warning.',
        )

        const html = renderToStaticMarkup(<PlanScreen plan={plan} today={NOW} onOpenSession={noop} />)

        expect(html).not.toContain('Your Running Fitness &amp; Training Paces')
        expect(html).toContain('Your Current Fitness')
        expect(html).not.toContain('Recommended Training Paces')
        expect(html).toContain('<strong>5 km time:</strong> 35:00')
        expect(html).toContain('<strong>Average pace:</strong> 7:00 min/km')
        expect(html).toContain('<strong>Estimated VDOT:</strong> 25.6')
        expect(html).not.toContain('old saved text')
        expect(html).not.toContain('old saved warning')
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

        const html = renderToStaticMarkup(<PlanScreen plan={plan} today={NOW} onOpenSession={noop} />)

        expect(html).toContain('<strong>Easy run</strong>')
        expect(html).not.toContain('<strong>Long run</strong>')
    })

    it('renders the sessions of the expanded week only', () => {
        const plan = generateTrainingPlan({ baseline: derivePersonalBaseline({ ...BASE, ...RACE }), now: NOW })!
        const html = renderToStaticMarkup(<PlanScreen plan={plan} today={NOW} onOpenSession={noop} />)
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
