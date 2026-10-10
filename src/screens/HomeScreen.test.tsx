import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { HomeNav, HomeScreen } from './HomeScreen'
import { SCHEMA_VERSION, type CompletedRun, type Progression } from '../domain/types'
import { OBESE_STILLS } from '../sprites'
import { cosmeticUrl } from '../cosmetics/art'

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

const run = (id: string, characterId: CompletedRun['characterId']): CompletedRun => ({
    id, schemaVersion: SCHEMA_VERSION, createdAt: STAMP, updatedAt: STAMP, characterId,
    workoutId: 'easyRun', planSessionId: null, completedAt: new Date(2026, 9, 10, 9, 0).toISOString(),
    elapsedMs: 1_500_000, distanceKm: 5,
})

const render = (props: Partial<Parameters<typeof HomeScreen>[0]> = {}) =>
    renderToStaticMarkup(
        <HomeScreen
            character="shiba"
            progression={progression()}
            runs={[]}
            now={NOW}
            onPlan={noop}
            onWorkouts={noop}
            onShop={noop}
            onStatus={noop}
            onCollect={async () => 0}
            {...props}
        />,
    )

describe('HomeScreen single character', () => {
    it('shows only the selected character, not the other one', () => {
        const html = render({ character: 'shiba' })
        expect(html).toContain('Chase is obese')
        expect(html).not.toContain('Shooshy')
        expect(html).not.toContain('shooshy')
        expect(html).not.toContain('fish')
    })

    it('shows only the other character when that one is selected', () => {
        const html = render({ character: 'shooshy', progression: progression({ wallets: { shiba: 4, shooshy: 2 } }) })
        expect(html).toContain('Shooshy is obese')
        expect(html).not.toContain('Chase')
        expect(html).not.toContain('bone')
        expect(html).toContain('2 fish')
    })
})

describe('HomeScreen health statement', () => {
    it('shows the obese statement and the obese still on a fresh install', () => {
        const html = render()
        expect(html).toContain('<p class="home-health">Chase is obese</p>')
        expect(html).toContain(`src="${OBESE_STILLS.shiba.url}"`)
        expect(html).not.toContain('very healthy')
    })

    it('shows the healthy statement and the first run frame after a qualifying run', () => {
        const html = render({ runs: [run('r1', 'shiba')] })
        expect(html).toContain('<p class="home-health">Chase is very healthy</p>')
        expect(html).toContain('sprites/shiba-run.png')
        expect(html).not.toContain(OBESE_STILLS.shiba.url)
    })

    it('draws the equipped item over the still', () => {
        const html = render({ progression: progression({ inventory: { shiba: ['chase-medal'], shooshy: [] }, equipped: { shiba: 'chase-medal', shooshy: null } }) })
        expect(html).toContain(`src="${cosmeticUrl('chase-medal')}"`)
        expect(html).toMatch(/<img[^>]*class="cosmetic-overlay"[^>]*aria-hidden="true"/)
    })

    it('keeps the still decorative', () => {
        expect(render()).toMatch(/<img[^>]*alt=""/)
    })
})

describe('HomeScreen wallet', () => {
    it('shows bones for Chase, singular for one and plural otherwise', () => {
        expect(render({ progression: progression({ wallets: { shiba: 1, shooshy: 0 } }) })).toContain('<span>1 bone</span>')
        expect(render({ progression: progression({ wallets: { shiba: 3, shooshy: 0 } }) })).toContain('<span>3 bones</span>')
    })

    it('shows fish for Shooshy, singular for one and plural otherwise', () => {
        expect(render({ character: 'shooshy', progression: progression({ wallets: { shiba: 0, shooshy: 1 } }) })).toContain('<span>1 fish</span>')
        expect(render({ character: 'shooshy', progression: progression({ wallets: { shiba: 0, shooshy: 7 } }) })).toContain('<span>7 fish</span>')
    })

    it('shows one wallet only', () => {
        const html = render({ progression: progression({ wallets: { shiba: 3, shooshy: 7 } }) })
        expect(html.match(/home-balance/g)?.length).toBe(1)
        expect(html).not.toContain('7')
    })
})

describe('HomeScreen navigation', () => {
    it('renders a Main landmark with four labelled buttons in order', () => {
        const html = render()
        expect(html).toContain('<nav class="home-nav" aria-label="Main">')
        const labels = [...html.matchAll(/<button[^>]*class="home-nav-button"[^>]*>([^<]+)<\/button>/g)].map((m) => m[1])
        expect(labels).toEqual(['Workouts', 'My plan', 'Shop', 'Status'])
    })

    it('marks only the current destination with aria-current', () => {
        const html = render({ current: 'shop' })
        expect(html.match(/aria-current="page"/g)?.length).toBe(1)
        expect(html).toMatch(/aria-current="page"[^>]*>Shop</)
    })

    it('marks no destination when none is current', () => {
        expect(render()).not.toContain('aria-current')
    })

    it('calls the matching handler for each button', () => {
        const calls: string[] = []
        // HomeNav is a plain function, so its element tree can be walked without a DOM.
        const tree = HomeNav({
            onWorkouts: () => calls.push('workouts'),
            onPlan: () => calls.push('plan'),
            onShop: () => calls.push('shop'),
            onStatus: () => calls.push('status'),
        }) as unknown as { props: { children: { props: { children: string; onClick: () => void } }[] } }
        const buttons = tree.props.children
        for (const button of buttons) button.props.onClick()
        expect(calls).toEqual(['workouts', 'plan', 'shop', 'status'])
    })
})
