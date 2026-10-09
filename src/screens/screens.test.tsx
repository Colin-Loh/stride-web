import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RunScreen } from './RunScreen'
import { BaselineScreen } from './BaselineScreen'
import { generatePersonalizedWorkout } from '../plan/generate'
import { derivePersonalBaseline } from '../plan/baseline'
import { QUESTIONS } from '../plan/questions'
import { newRunSession } from '../run/session'

const noop = () => { }
afterEach(() => vi.useRealTimers())
describe('screen regressions', () => {
  it('shows the corrected distance-section countdown after a speed change', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_300_000)
    const plan = generatePersonalizedWorkout({ category: 'threshold', baseline: derivePersonalBaseline({}) })
    plan.sections = [{
      id: 'main', type: 'run', label: 'Main', effort: 'steady', speedKmh: 6,
      target: { basis: 'distance', distanceKm: 1 }
    }]
    const session = { ...newRunSession(plan, 'run-1'), startedAt: 1_000_000, speedChanges: [{ atMs: 300_000, offset: 6 }] }
    const html = renderToStaticMarkup(<RunScreen session={session} muted character="shooshy" onSession={noop}
      onComplete={noop} onQuit={noop} onToggleMute={noop} />)
    expect(html).toContain('Main · 2:30 left')
  })
  it('shows the partial final repetition as two of two', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_190_000)
    const plan = generatePersonalizedWorkout({ category: 'threshold', baseline: derivePersonalBaseline({}) })
    plan.sections = [{
      id: 'main', type: 'run', label: 'Main', effort: 'steady', speedKmh: 12,
      target: { basis: 'time', durationSeconds: 200 }, runWalk: { runSeconds: 120, walkSeconds: 60, walkSpeedKmh: 6 }
    }]
    const html = renderToStaticMarkup(<RunScreen session={{ ...newRunSession(plan, 'run-1'), startedAt: 1_000_000 }} muted
      character="shooshy" onSession={noop} onComplete={noop} onQuit={noop} onToggleMute={noop} />)
    expect(html).toContain('Run 2 of 2')
  })
  it('asks only the always-visible questions before a fitness method is chosen', () => {
    const html = renderToStaticMarkup(<BaselineScreen initial={{}} submitAction="plan" onBack={noop} onDone={noop} />)
    const asked = [...html.matchAll(/data-question="([a-z_]+)"/g)].map(m => m[1])
    expect(asked).toEqual(QUESTIONS.filter(q => !('askWhen' in q)).map(q => q.id))
    expect(html).toContain('disabled=""')
  })
  it.each([
    ['recent_race', ['recent_race_distance', 'recent_race_time']],
    ['estimated_race', ['estimated_distance_time']],
    ['easy_pace', ['conversational_easy_pace']],
  ] as const)('shows only the %s follow-up questions', (method, followUps) => {
    const html = renderToStaticMarkup(<BaselineScreen submitAction="plan" initial={{ fitness_method: method }} onBack={noop} onDone={noop} />)
    const asked = [...html.matchAll(/data-question="([a-z_]+)"/g)].map(m => m[1])
    const branches = ['recent_race_distance', 'recent_race_time', 'estimated_distance_time', 'conversational_easy_pace']
    expect(asked.filter(id => branches.includes(id))).toEqual(followUps)
  })
  it('shows the goal race date only for a race focus', () => {
    const ask = (focus: string) => renderToStaticMarkup(<BaselineScreen submitAction="plan" initial={{ training_focus: focus }} onBack={noop} onDone={noop} />)
    expect(ask('base')).not.toContain('goal_race_date')
    expect(ask('10k')).toContain('goal_race_date')
  })
  it('enables the build button once every required answer is valid', () => {
    const complete = {
      fitness_method: 'easy_pace', conversational_easy_pace: 420, training_focus: 'base', weekly_volume: 30,
      running_days: 3, training_effort: 'base'
    } as const
    expect(renderToStaticMarkup(<BaselineScreen initial={complete} submitAction="plan" onBack={noop} onDone={noop} />)).not.toContain('disabled=""')
  })
})
