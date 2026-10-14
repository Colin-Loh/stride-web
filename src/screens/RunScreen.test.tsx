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

describe('RunScreen forest stage', () => {
    it('marks a started, unpaused run as running and keeps scenery decorative', () => {
        const html = renderRun(runningSession(), 'shiba')
        expect(html).toContain('data-motion="running"')
        expect(html).toContain('class="run-decor" aria-hidden="true"')
    })

    it('freezes the scene when paused and when not yet started', () => {
        const paused = { ...runningSession(), paused: true }
        expect(renderRun(paused, 'shooshy')).toContain('data-motion="paused"')
        const ready = { ...runningSession(), startedAt: 0 }
        expect(renderRun(ready, 'shooshy')).toContain('data-motion="ready"')
    })

    it.each(['shiba', 'shooshy'] as const)('draws only the selected character (%s)', (character) => {
        const html = renderRun(runningSession(), character)
        const other = character === 'shiba' ? 'shooshy' : 'shiba'
        expect(html).not.toContain(`sprites/${other}`)
    })
})

describe('RunScreen milestones', () => {
    it('shortens marathon pace to marathon in the milestone list', () => {
        const session = runningSession()
        const section = session.plan.sections[0]
        session.plan.sections = [
            { ...section, label: 'Warm-up' },
            { ...section, id: 'main-2', label: 'Marathon pace' },
        ]

        const html = renderRun(session, 'shiba')
        expect(html).toContain('<li class="upcoming">Marathon</li>')
        expect(html).toContain('Next section: Marathon pace')
    })
})
