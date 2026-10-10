import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StatusScreen } from './StatusScreen'
import { SCHEMA_VERSION, type CompletedRun, type Progression } from '../domain/types'
import type { Character } from '../domain/preferences'
import { OBESE_STILLS } from '../sprites'
import { cosmeticUrl } from '../cosmetics/art'

const noop = async () => 0
const back = () => { }
const STAMP = '2026-10-01T00:00:00.000Z'
// Local calendar day D is 2026-10-10 (month index 9 is October).
const NOW = new Date(2026, 9, 10, 12, 0)

const progression = (overrides: Partial<Progression> = {}): Progression => ({
    id: 'progression', schemaVersion: SCHEMA_VERSION, createdAt: STAMP, updatedAt: STAMP,
    startDate: '2026-10-01',
    wallets: { shiba: 0, shooshy: 0 },
    lastClaimedDate: { shiba: '2026-10-10', shooshy: '2026-10-10' },
    rewardedRunIds: [], grantsApplied: [], inventory: { shiba: [], shooshy: [] }, equipped: { shiba: null, shooshy: null },
    ...overrides,
})

const run = (id: string, characterId: CompletedRun['characterId'], planSessionId: string | null = null): CompletedRun => ({
    id, schemaVersion: SCHEMA_VERSION, createdAt: STAMP, updatedAt: STAMP, characterId,
    workoutId: 'easyRun', planSessionId, completedAt: new Date(2026, 9, 10, 9, 0).toISOString(),
    elapsedMs: 1_500_000, distanceKm: 5,
})

const render = (props: Partial<Parameters<typeof StatusScreen>[0]> = {}) =>
    renderToStaticMarkup(
        <StatusScreen character="shiba" progression={progression()} runs={[]} now={NOW} onCollect={noop} onBack={back} {...props} />,
    )

const buttonOf = (html: string) => html.match(/<button[^>]*quest-button[^>]*>/)?.[0] ?? ''

describe('StatusScreen one character', () => {
    it('shows Chase only when Chase is the locked character', () => {
        const html = render({ character: 'shiba' })
        expect(html).toContain('<h1>How is Chase?</h1>')
        expect(html).toContain('Chase is obese')
        expect(html).not.toContain('Shooshy')
        expect(html).not.toContain('shooshy')
        expect(html).not.toContain('Fish')
        expect(html).not.toContain('fish')
    })

    it('shows Shooshy only when Shooshy is the locked character', () => {
        const html = render({ character: 'shooshy', progression: progression({ wallets: { shiba: 4, shooshy: 2 } }) })
        expect(html).toContain('<h1>How is Shooshy?</h1>')
        expect(html).toContain('Shooshy is obese')
        expect(html).not.toContain('Chase')
        expect(html).not.toContain('shiba')
        expect(html).not.toContain('Bones')
        expect(html).not.toContain('bone')
    })

    it('renders exactly one status card', () => {
        expect(render().match(/<article/g)?.length).toBe(1)
    })

    it('shows the plain-text rule explanation', () => {
        expect(render()).toContain('Obese after 7 days with no completed run of 5 minutes or more. A new run restores health.')
    })

    it('shows Back and no Shop button', () => {
        const html = render()
        expect(html).toContain('>Back<')
        expect(html).not.toContain('>Shop<')
    })
})

describe('StatusScreen health', () => {
    it('shows the obese label and obese still for Chase on a fresh install', () => {
        const html = render()
        expect(html).toContain(`src="${OBESE_STILLS.shiba.url}"`)
        expect(html).not.toContain('very healthy')
    })

    it('shows the healthy label and run frame after a qualifying run', () => {
        const html = render({ runs: [run('r1', 'shiba')] })
        expect(html).toContain('Chase is very healthy')
        expect(html).toContain('sprites/shiba-run.png')
        expect(html).not.toContain(OBESE_STILLS.shiba.url)
    })

    it('shows Shooshy obese still and then the run frame when healthy', () => {
        const obese = render({ character: 'shooshy' })
        expect(obese).toContain(`src="${OBESE_STILLS.shooshy.url}"`)
        const healthy = render({ character: 'shooshy', runs: [run('r1', 'shooshy')] })
        expect(healthy).toContain('Shooshy is very healthy')
        expect(healthy).toContain('sprites/shooshy-run.png')
        expect(healthy).not.toContain(OBESE_STILLS.shooshy.url)
    })

    it('ignores a qualifying run credited to the other character', () => {
        const html = render({ character: 'shooshy', runs: [run('r1', 'shiba')] })
        expect(html).toContain('Shooshy is obese')
    })

    it('shows the plan-session count as information, not as a health change', () => {
        const html = render({ runs: [run('r1', 'shiba', 'week-1-session-1')] })
        expect(html).toContain('Completed plan sessions in the last 7 days: 1')
        expect(html).toContain('Chase is very healthy')
    })

    it('keeps the still decorative', () => {
        expect(render()).toMatch(/<img[^>]*alt=""/)
    })

    it('draws the equipped item only over the selected character still', () => {
        const html = render({
            progression: progression({ inventory: { shiba: ['chase-medal'], shooshy: ['shooshy-scarf'] }, equipped: { shiba: 'chase-medal', shooshy: 'shooshy-scarf' } }),
        })
        expect(html).toContain(`src="${cosmeticUrl('chase-medal')}"`)
        expect(html).toMatch(/<img[^>]*class="cosmetic-overlay"[^>]*aria-hidden="true"/)
        expect(html).not.toContain(cosmeticUrl('shooshy-scarf'))
    })
})

describe('StatusScreen wallet', () => {
    it('shows the bones wallet line for Chase, singular and plural', () => {
        expect(render({ progression: progression({ wallets: { shiba: 1, shooshy: 0 } }) })).toContain('<p>Bones: 1</p>')
        expect(render({ progression: progression({ wallets: { shiba: 3, shooshy: 0 } }) })).toContain('<p>Bones: 3</p>')
    })

    it('shows the fish wallet line for Shooshy', () => {
        const html = render({ character: 'shooshy', progression: progression({ wallets: { shiba: 0, shooshy: 7 } }) })
        expect(html).toContain('<p>Fish: 7</p>')
    })

    it('does not show the other wallet', () => {
        const html = render({ progression: progression({ wallets: { shiba: 3, shooshy: 7 } }) })
        expect(html).toContain('Bones: 3')
        expect(html).not.toContain('Fish')
        expect(html).not.toContain('Fish: 7')
    })
})

describe('StatusScreen quest button', () => {
    const questFor = (character: Character, lastClaimed: string, startDate = '2026-10-01') =>
        render({
            character,
            progression: progression({ startDate, lastClaimedDate: { shiba: lastClaimed, shooshy: lastClaimed } }),
        })

    it('is on this screen, with the ready name when one unit is pending', () => {
        const html = questFor('shiba', '2026-10-09')
        expect(buttonOf(html)).toContain('aria-label="Quest: collect 1 bone"')
        expect(buttonOf(html)).toContain('aria-disabled="false"')
    })

    it('uses the fish name for Shooshy when units are pending', () => {
        const html = questFor('shooshy', '2026-10-07')
        expect(buttonOf(html)).toContain('aria-label="Quest: collect 3 fish"')
    })

    it('shows the claimed state after today is collected', () => {
        const html = questFor('shiba', '2026-10-10')
        expect(buttonOf(html)).toContain('aria-label="Quest done today"')
        expect(buttonOf(html)).toContain('aria-disabled="true"')
    })

    it('shows the nothing-yet state on the first day', () => {
        const html = questFor('shiba', '2026-10-10', '2026-10-10')
        expect(buttonOf(html)).toContain('aria-label="Quest: nothing to collect yet"')
        expect(buttonOf(html)).toContain('aria-disabled="true"')
    })

    it('shows the backlog note once', () => {
        expect(render().match(/Up to 14 days can be collected. Older days are not kept./g)?.length).toBe(1)
    })
})
