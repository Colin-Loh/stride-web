import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { QuestBadge } from './QuestBadge'
import { questState } from '../progression/questState'
import { SCHEMA_VERSION, type Progression } from '../domain/types'

const STAMP = '2026-10-01T00:00:00.000Z'
// Local calendar day D is 2026-10-10 (month index 9 is October).
const NOW = new Date(2026, 9, 10, 12, 0)
const noop = async () => 0

const progression = (overrides: Partial<Progression> = {}): Progression => ({
    id: 'progression', schemaVersion: SCHEMA_VERSION, createdAt: STAMP, updatedAt: STAMP,
    startDate: '2026-10-01',
    wallets: { shiba: 0, shooshy: 0 },
    lastClaimedDate: { shiba: '2026-10-10', shooshy: '2026-10-10' },
    rewardedRunIds: [], inventory: { shiba: [], shooshy: [] }, equipped: { shiba: null, shooshy: null },
    ...overrides,
})

const render = (props: Partial<Parameters<typeof QuestBadge>[0]> = {}) =>
    renderToStaticMarkup(<QuestBadge progression={progression()} character="shiba" now={NOW} onCollect={noop} {...props} />)

const buttonOf = (html: string) => html.match(/<button[^>]*>/)?.[0] ?? ''

describe('questState', () => {
    it('is nothing when no units are pending and today is already claimed', () => {
        expect(questState(progression(), 'shiba', NOW)).toEqual({ kind: 'claimed' })
    })

    it('is nothing yet on the first day, before any claim', () => {
        const first = progression({ startDate: '2026-10-10', lastClaimedDate: { shiba: '2026-10-10', shooshy: '2026-10-10' } })
        expect(questState(first, 'shiba', NOW)).toEqual({ kind: 'nothing' })
    })

    it('is ready with the pending count when a day was missed', () => {
        const missed = progression({ lastClaimedDate: { shiba: '2026-10-08', shooshy: '2026-10-10' } })
        expect(questState(missed, 'shiba', NOW)).toEqual({ kind: 'ready', pending: 2 })
    })

    it('caps the ready count at 14', () => {
        const old = progression({ startDate: '2026-01-01', lastClaimedDate: { shiba: '2026-08-01', shooshy: '2026-10-10' } })
        expect(questState(old, 'shiba', NOW)).toEqual({ kind: 'ready', pending: 14 })
    })

    it('reads only the selected character', () => {
        const onlyFish = progression({ lastClaimedDate: { shiba: '2026-10-10', shooshy: '2026-10-08' } })
        expect(questState(onlyFish, 'shiba', NOW)).toEqual({ kind: 'claimed' })
        expect(questState(onlyFish, 'shooshy', NOW)).toEqual({ kind: 'ready', pending: 2 })
    })
})

describe('QuestBadge states', () => {
    it('ready: names the count in the accessible name and is enabled', () => {
        const html = render({ progression: progression({ lastClaimedDate: { shiba: '2026-10-09', shooshy: '2026-10-10' } }) })
        expect(buttonOf(html)).toContain('aria-label="Quest: collect 1 bone"')
        expect(buttonOf(html)).toContain('aria-disabled="false"')
        expect(html).toContain('>1</span>')
    })

    it('ready: uses the plural for more than one unit and the fish name for Shooshy', () => {
        const html = render({ character: 'shooshy', progression: progression({ lastClaimedDate: { shiba: '2026-10-10', shooshy: '2026-10-07' } }) })
        expect(buttonOf(html)).toContain('aria-label="Quest: collect 3 fish"')
    })

    it('claimed: shows done today and is aria-disabled, with no count', () => {
        const html = render()
        expect(buttonOf(html)).toContain('aria-label="Quest done today"')
        expect(buttonOf(html)).toContain('aria-disabled="true"')
        expect(html).not.toContain('quest-count')
    })

    it('nothing yet: is aria-disabled with the nothing-yet name', () => {
        const html = render({ progression: progression({ startDate: '2026-10-10' }) })
        expect(buttonOf(html)).toContain('aria-label="Quest: nothing to collect yet"')
        expect(buttonOf(html)).toContain('aria-disabled="true"')
    })

    it('shows the backlog note once in the panel', () => {
        const html = render()
        expect(html.match(/Up to 14 days can be collected. Older days are not kept./g)?.length).toBe(1)
    })

    it('keeps the icon decorative', () => {
        expect(render()).toMatch(/<svg[^>]*aria-hidden="true"/)
    })
})

describe('claim rule behind the quest (pure)', () => {
    it('a second claim on the same day adds nothing', async () => {
        const { claimIncome } = await import('../progression/income')
        const first = claimIncome(progression({ lastClaimedDate: { shiba: '2026-10-08', shooshy: '2026-10-10' } }), 'shiba', NOW)
        const second = claimIncome(first.progression, 'shiba', NOW)
        expect(first.claimed).toBe(2)
        expect(second.claimed).toBe(0)
        expect(second.progression.wallets.shiba).toBe(2)
    })
})
