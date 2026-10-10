import { describe, expect, it, vi, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RunScreen } from './RunScreen'
import { generatePersonalizedWorkout } from '../plan/generate'
import { derivePersonalBaseline } from '../plan/baseline'
import { newRunSession } from '../run/session'
import type { RunSession } from '../domain/types'

const noop = () => { }
afterEach(() => vi.useRealTimers())

function runningSession(healthAtStart?: RunSession['healthAtStart']): RunSession {
    vi.useFakeTimers()
    vi.setSystemTime(1_100_000)
    const plan = generatePersonalizedWorkout({ category: 'threshold', baseline: derivePersonalBaseline({}) })
    plan.sections = [{
        id: 'main', type: 'run', label: 'Main', effort: 'steady', speedKmh: 6,
        target: { basis: 'distance', distanceKm: 1 },
    }]
    const session = { ...newRunSession(plan, 'run-1'), startedAt: 1_000_000 }
    return healthAtStart === undefined ? session : { ...session, healthAtStart }
}

function renderRun(session: RunSession, character: 'shiba' | 'shooshy') {
    return renderToStaticMarkup(<RunScreen session={session} muted character={character} onSession={noop}
        onComplete={noop} onQuit={noop} onToggleMute={noop} />)
}

describe('RunScreen run sprite health', () => {
    it.each([
        ['shiba', 'sprites/shiba-run-obese.png'],
        ['shooshy', 'sprites/shooshy-run-obese.png'],
    ] as const)('%s runs the obese sheet when healthAtStart is obese', (character, sheet) => {
        expect(renderRun(runningSession('obese'), character)).toContain(sheet)
    })

    it.each([
        ['shiba', 'sprites/shiba-run.png'],
        ['shooshy', 'sprites/shooshy-run.png'],
    ] as const)('%s runs the healthy sheet when healthAtStart is healthy', (character, sheet) => {
        const html = renderRun(runningSession('healthy'), character)
        expect(html).toContain(sheet)
        expect(html).not.toContain('obese')
    })

    it('falls back to the healthy sheet when no health snapshot exists', () => {
        const html = renderRun(runningSession(), 'shiba')
        expect(html).toContain('sprites/shiba-run.png')
        expect(html).not.toContain('obese')
    })
})
