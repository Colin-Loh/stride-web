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
        const html = renderToStaticMarkup(<BaselineScreen initial={{ fitness_method: 'recent_race' }} onBack={noop} onDone={noop} />)
        const question = html.split('data-question="recent_race_distance"')[1].split('data-question=')[0]
        expect(question).not.toMatch(/<option[^>]*selected=""[^>]*>5 km/)
    })
    it('enables Build my workout and builds a plan for the reported answers', () => {
        const html = renderToStaticMarkup(<BaselineScreen initial={USER_REPORT} onBack={noop} onDone={noop} />)
        expect(html).not.toMatch(/disabled=""[^>]*>Build my workout/)
        const plan = generatePersonalizedWorkout({ category: 'long', baseline: derivePersonalBaseline(USER_REPORT) })
        expect(plan.sections.length).toBeGreaterThan(0)
    })
})
