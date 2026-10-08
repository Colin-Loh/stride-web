import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PlanScreen } from './PlanScreen'
import { derivePersonalBaseline } from '../plan/baseline'
import { formatPaceSeconds, roundSpeedUp } from '../plan/convert'
import { trainingSpeedsKmh, vdotFromRace, ZONES } from '../plan/daniels'
import type { AnswerValues } from '../plan/questions'
import { generateTrainingPlan } from '../plan/trainingPlan'

const noop = () => {}
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
        expect(html).toMatch(/class="week current"[^>]*aria-current="date"><h3>Week 6 /)
    })

    it('opens the picked session of a week', () => {
        const plan = generateTrainingPlan({ baseline: derivePersonalBaseline({ ...BASE, ...RACE }), now: NOW })!
        const opened: string[] = []
        const buttons: ReactElement<{ onClick?: () => void }>[] = []
        const collect = (node: ReactNode) => {
            if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) return
            if (node.type === 'button' && node.props.onClick) buttons.push(node as ReactElement<{ onClick?: () => void }>)
            Children.forEach(node.props.children, collect)
        }
        collect(PlanScreen({ plan, today: NOW, onOpenSession: (id) => opened.push(id), onBack: noop }))
        // The first buttons are the sessions of week 1; the last is "Pick a single session".
        const sessionButtons = buttons.slice(0, -1)
        expect(sessionButtons).toHaveLength(plan.weeks.reduce((count, week) => count + week.sessions.length, 0))
        sessionButtons[2].props.onClick!()
        expect(opened).toEqual([plan.weeks[0].sessions[2].id])
    })
})
