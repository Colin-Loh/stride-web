import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CompleteScreen } from './CompleteScreen'
import { DanceSprite } from '../DanceSprite'
import { CHARACTER_NAMES } from '../domain/preferences'
import { derivePersonalBaseline } from '../plan/baseline'
import { generatePersonalizedWorkout } from '../plan/generate'
import type { PlanSection } from '../plan/types'
import { runProgress } from '../run/engine'
import { newRunSession } from '../run/session'
import type { RunSession } from '../domain/types'

const noop = () => { }
const timed = (id: string, type: PlanSection['type'], seconds: number, speed: number | null): PlanSection => ({
    id, type, label: id, effort: 'x', speedKmh: speed, target: { basis: 'time', durationSeconds: seconds },
})

function finished(sections: PlanSection[]): RunSession {
    const base = generatePersonalizedWorkout({ category: 'threshold', baseline: derivePersonalBaseline({}) })
    const plan = { ...base, category: 'marathon' as const, categoryName: 'Marathon-pace run', sections }
    const end = runProgress(plan, [], Infinity)
    return { ...newRunSession(plan, 'run-1'), completed: true, paused: true, result: { elapsedMs: end.elapsedMs, distanceKm: end.distanceKm } }
}
const SESSION = finished([timed('Warm-up', 'warmup', 480, 7), timed('Main', 'run', 1440, 8.7), timed('Cool-down', 'cooldown', 492, 5.8)])
const render = (props: Partial<Parameters<typeof CompleteScreen>[0]> = {}) =>
    renderToStaticMarkup(<CompleteScreen name="Alex" session={SESSION} character="shiba" weightKg={60} onAgain={noop} {...props} />)

describe('CompleteScreen dashboard', () => {
    it('shows distance, active time, pace in min/km, calories and sections finished', () => {
        const html = render()
        expect(html).toContain('<strong>5.21</strong>')
        expect(html).toContain('40:12')
        expect(html).toContain('7:43 <small>min/km</small>')
        expect(html).toContain('~312 <small>kcal</small>')
        expect(html).toContain('3 <small>/ 3</small>')
        expect(html).toContain('Avg set speed 7.77 km/h')
        expect(html).toContain('No pauses')
        expect(html).toContain('You did it, Alex.')
    })

    it('shows the empty state, not a number, when there is no weight', () => {
        const html = render({ weightKg: null })
        expect(html).toContain('Add your weight to see calories')
        expect(html).not.toContain('kcal</small>')
        expect(html).not.toMatch(/~0\b/)
    })

    it('shows both charts with text equivalents, the recap table and the share button', () => {
        const html = render()
        expect(html).toContain('Set treadmill speed over active time')
        expect(html).toContain('Marathon 24:00 at 8.70 km/h')
        expect(html).toContain('Time by prescribed zone')
        expect(html).toContain('Plan labels, not measured heart-rate zones')
        expect(html).toContain('<th scope="row">M · Main</th>')
        expect(html).toContain('>Share</button>')
        expect(html).toContain('Include calories on the picture')
        expect(render({ weightKg: null })).not.toContain('Include calories on the picture')
    })

    it('has a dance for the chosen character, named Shooshy and not Cat', () => {
        const html = render({ character: 'shooshy' })
        expect(html).toContain('aria-label="Shooshy celebrating"')
        expect(html).toContain('Shooshy is cheering you on.')
        expect(html).not.toMatch(/\bcat\b/i)
    })

    it('shows dashes and an explanation, not zeros, when no speed was set', () => {
        const html = render({ session: finished([timed('Easy', 'run', 600, null)]) })
        expect(html).toContain('<strong>—</strong>')
        expect(html).toContain('Distance unknown')
        expect(html).toContain('No speeds were set for this run')
        expect(html).toContain('—')
        expect(html).not.toContain('0.00')
    })

    it('says the session finished, not that everything is done, when sections were skipped', () => {
        const early = { ...SESSION, result: { elapsedMs: 600_000, distanceKm: 1.5 } }
        const html = render({ session: early })
        expect(html).toContain('Session finished, Alex.')
        expect(html).toContain('1 <small>/ 3</small>')
    })
})

describe('DanceSprite', () => {
    it('plays the sheet twice for about 2.5 seconds and rests on a still frame, per character', () => {
        const shiba = renderToStaticMarkup(<DanceSprite character="shiba" />)
        expect(shiba).toContain('animation-iteration-count:2')
        expect(shiba).toContain('steps(12)')
        expect(shiba).toContain('width:148px;height:111px')
        expect(shiba).toContain('--still-x:27.272727272727273%')
        expect(shiba).toContain('sprites/shiba-dance.png')
        const shooshy = renderToStaticMarkup(<DanceSprite character="shooshy" />)
        expect(shooshy).toContain('width:118px;height:98px')
        expect(shooshy).toContain('sprites/shooshy-dance.png')
    })

    it('labels the shiba dance as Chase celebrating', () => {
        expect(CHARACTER_NAMES.shiba).toBe('Chase')
        expect(renderToStaticMarkup(<DanceSprite character="shiba" />)).toContain('aria-label="Chase celebrating"')
    })
})
