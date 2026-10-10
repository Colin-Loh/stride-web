import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StatusScreen } from './StatusScreen'
import { SCHEMA_VERSION, type CompletedRun, type Progression } from '../domain/types'
import { OBESE_STILLS } from '../sprites'

const noop = () => { }
const STAMP = '2026-10-01T00:00:00.000Z'
// Local calendar day D is 2026-10-10 (month index 9 is October).
const NOW = new Date(2026, 9, 10, 12, 0)

const progression = (overrides: Partial<Progression> = {}): Progression => ({
    id: 'progression', schemaVersion: SCHEMA_VERSION, createdAt: STAMP, updatedAt: STAMP,
    startDate: '2026-10-10',
    wallets: { shiba: 0, shooshy: 0 },
    lastClaimedDate: { shiba: '2026-10-10', shooshy: '2026-10-10' },
    rewardedRunIds: [], inventory: { shiba: [], shooshy: [] }, equipped: { shiba: null, shooshy: null },
    ...overrides,
})

const run = (id: string, characterId: CompletedRun['characterId'], planSessionId: string | null = null): CompletedRun => ({
    id, schemaVersion: SCHEMA_VERSION, createdAt: STAMP, updatedAt: STAMP, characterId,
    workoutId: 'easyRun', planSessionId, completedAt: new Date(2026, 9, 10, 9, 0).toISOString(),
    elapsedMs: 1_500_000, distanceKm: 5,
})

const render = (props: Partial<Parameters<typeof StatusScreen>[0]> = {}) =>
    renderToStaticMarkup(<StatusScreen progression={progression()} runs={[]} now={NOW} onCollect={noop} onBack={noop} {...props} />)

/** The markup of one character's card, from its heading to the next card. */
const cardFor = (html: string, name: string) => {
    const heading = html.indexOf(`<h2 id="status-${name === 'Chase' ? 'shiba' : 'shooshy'}"`)
    const start = html.lastIndexOf('<article', heading)
    const next = html.indexOf('<article', heading + 1)
    return html.slice(start, next === -1 ? undefined : next)
}

describe('StatusScreen health labels', () => {
    it('shows both characters as obese on a fresh install', () => {
        const html = render()
        expect(html).toContain('Chase is obese')
        expect(html).toContain('Shooshy is obese')
        expect(html).not.toContain('very healthy')
    })

    it('shows a character as very healthy after a qualifying run, and leaves the other obese', () => {
        const html = render({ runs: [run('r1', 'shiba')] })
        expect(cardFor(html, 'Chase')).toContain('Chase is very healthy')
        expect(cardFor(html, 'Shooshy')).toContain('Shooshy is obese')
    })

    it('shows the plan-session count as information, not as a health change', () => {
        const html = render({ runs: [run('r1', 'shiba', 'week-1-session-1')] })
        expect(cardFor(html, 'Chase')).toContain('Completed plan sessions in the last 7 days: 1')
        expect(cardFor(html, 'Chase')).toContain('Chase is very healthy')
    })

    it('shows the plain-text rule explanation', () => {
        expect(render()).toContain('Obese after 7 days with no completed run of 5 minutes or more. A new run restores health.')
    })
})

describe('StatusScreen sprites', () => {
    it('uses the obese still for an obese character, with an empty alt', () => {
        const html = render()
        expect(html).toContain(`src="${OBESE_STILLS.shiba.url}"`)
        expect(html).toContain(`src="${OBESE_STILLS.shooshy.url}"`)
        expect(cardFor(html, 'Chase')).toMatch(/<img[^>]*alt=""/)
    })

    it('drops the obese still for a healthy character and shows the run sprite instead', () => {
        const html = render({ runs: [run('r1', 'shiba')] })
        expect(cardFor(html, 'Chase')).not.toContain(OBESE_STILLS.shiba.url)
        expect(cardFor(html, 'Chase')).toContain('sprites/shiba-run.png')
        expect(cardFor(html, 'Shooshy')).toContain(OBESE_STILLS.shooshy.url)
    })
})

describe('StatusScreen wallets and collect', () => {
    it('labels Chase wallet as bones and Shooshy wallet as fish', () => {
        const html = render({ progression: progression({ wallets: { shiba: 3, shooshy: 7 } }) })
        expect(cardFor(html, 'Chase')).toContain('Bones: 3')
        expect(cardFor(html, 'Shooshy')).toContain('Fish: 7')
    })

    it('disables the button and labels it when nothing is pending', () => {
        const html = render()
        expect(html).toContain('Nothing to collect today')
        expect(html.match(/<button[^>]*disabled[^>]*>/g)?.length).toBe(2)
    })

    it('enables Collect N for a character with pending income', () => {
        const html = render({
            progression: progression({ lastClaimedDate: { shiba: '2026-10-07', shooshy: '2026-10-10' } }),
        })
        expect(cardFor(html, 'Chase')).toContain('Collect 3')
        expect(cardFor(html, 'Chase')).not.toMatch(/<button[^>]*disabled/)
        expect(cardFor(html, 'Shooshy')).toContain('Nothing to collect today')
    })
})
