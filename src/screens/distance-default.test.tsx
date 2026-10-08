import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BaselineScreen } from './BaselineScreen'
import { derivePersonalBaseline } from '../plan/baseline'
import { generatePersonalizedWorkout } from '../plan/generate'
import type { AnswerValues } from '../plan/questions'

const noop = () => {}
const USER_REPORT: AnswerValues = {
    fitness_method: 'recent_race', recent_race_distance: 5, recent_race_time: 35 * 60,
    training_focus: 'half_marathon', weekly_volume: 10, running_days: 3, training_effort: 'base',
}

describe('recent race distance', () => {
    it('does not show a distance as chosen before the runner picks one', () => {
        const html = renderToStaticMarkup(<BaselineScreen submitAction="plan" initial={{ fitness_method: 'recent_race' }} onBack={noop} onDone={noop} />)
        const question = html.split('data-question="recent_race_distance"')[1].split('data-question=')[0]
        expect(question).not.toMatch(/<option[^>]*selected=""[^>]*>5 km/)
    })
    it('enables Build my plan and builds a plan for the reported answers', () => {
        const html = renderToStaticMarkup(<BaselineScreen initial={USER_REPORT} submitAction="plan" onBack={noop} onDone={noop} />)
        expect(html).not.toMatch(/disabled=""[^>]*>Build my plan/)
        const plan = generatePersonalizedWorkout({ category: 'long', baseline: derivePersonalBaseline(USER_REPORT) })
        expect(plan.sections.length).toBeGreaterThan(0)
    })
})

describe('answers screen button label', () => {
    it.each([
        ['plan', 'Build my plan'],
        ['workout', 'Build my workout'],
        ['edit', 'Save my answers'],
    ] as const)('says what happens next for %s', (action, label) => {
        const html = renderToStaticMarkup(<BaselineScreen initial={{}} submitAction={action} onBack={noop} onDone={noop} />)
        expect(html).toContain(label)
    })
})

describe('user-facing copy', () => {
    it('never shows developer notes such as file paths or TODO markers', async () => {
        const copy = await import('../plan/copy')
        const text = JSON.stringify(copy)
        expect(text).not.toMatch(/src\/|TODO|\.ts\b|research/i)
    })
})
