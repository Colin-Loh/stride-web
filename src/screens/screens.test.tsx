import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RunScreen } from './RunScreen'
import { BaselineScreen } from './BaselineScreen'
import { generatePersonalizedWorkout } from '../plan/generate'
import { derivePersonalBaseline } from '../plan/baseline'
import { newSession } from '../storage'

const noop = () => {}
afterEach(() => vi.useRealTimers())
describe('screen regressions', () => {
  it('shows the corrected distance-section countdown after a speed change', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_300_000)
    const plan = generatePersonalizedWorkout({ category: 'test', baseline: derivePersonalBaseline({}) })
    plan.sections = [{ id: 'main', type: 'run', label: 'Main', effort: 'steady', speedKmh: 6,
      target: { basis: 'distance', distanceKm: 1 } }]
    const session = { ...newSession(plan), startedAt: 1_000_000, speedChanges: [{ atMs: 300_000, offset: 6 }] }
    const html = renderToStaticMarkup(<RunScreen session={session} muted character="cat" onSession={noop}
      onComplete={noop} onQuit={noop} onToggleMute={noop} />)
    expect(html).toContain('Main · 2:30 left')
  })
  it('shows the partial final repetition as two of two', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_190_000)
    const plan = generatePersonalizedWorkout({ category: 'test', baseline: derivePersonalBaseline({}) })
    plan.sections = [{ id: 'main', type: 'run', label: 'Main', effort: 'steady', speedKmh: 12,
      target: { basis: 'time', durationSeconds: 200 }, runWalk: { runSeconds: 120, walkSeconds: 60, walkSpeedKmh: 6 } }]
    const html = renderToStaticMarkup(<RunScreen session={{ ...newSession(plan), startedAt: 1_000_000 }} muted
      character="cat" onSession={noop} onComplete={noop} onQuit={noop} onToggleMute={noop} />)
    expect(html).toContain('Run 2 of 2')
  })
  it('retains the race, weekly, running and availability questions after extraction', () => {
    const html = renderToStaticMarkup(<BaselineScreen initial={{ raceKnown: true, continuity: 'run-walk' }}
      editAll onBack={noop} onDone={noop} />)
    for (const label of ['Finish time', 'Kilometres per week', 'Running days (1 to 7)', 'Walking pace', 'Run minutes', 'Total minutes available']) {
      expect(html).toContain(label)
    }
    expect(html).toContain('disabled=""')
  })
})
