import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StatusScreen } from './StatusScreen'
import { SCHEMA_VERSION, type CompletedRun, type Progression } from '../domain/types'
import type { Character } from '../domain/preferences'
import { OBESE_STILLS } from '../sprites'
import { cosmeticUrl } from '../cosmetics/art'
import { derivePersonalBaseline } from '../plan/baseline'
import { generateTrainingPlan } from '../plan/trainingPlan'
import type { AnswerValues } from '../plan/questions'

const noop = async () => 0
const changeCharacter = () => { }
const editAnswers = () => { }
const showPastRun = () => { }
const STAMP = '2026-10-01T00:00:00.000Z'
// Local calendar day D is 2026-10-10 (month index 9 is October).
const NOW = new Date(2026, 9, 10, 12, 0)
const PLAN_ANSWERS: AnswerValues = { training_focus: 'base', weekly_volume: 15, running_days: 3, training_effort: 'base' }
const PLAN = generateTrainingPlan({ baseline: derivePersonalBaseline(PLAN_ANSWERS), now: NOW })!

const progression = (overrides: Partial<Progression> = {}): Progression => ({
    id: 'progression', schemaVersion: SCHEMA_VERSION, createdAt: STAMP, updatedAt: STAMP,
    startDate: '2026-10-01',
    wallets: { shiba: 0, shooshy: 0 },
    lastClaimedDate: { shiba: '2026-10-10', shooshy: '2026-10-10' },
    rewardedRunIds: [], grantsApplied: [], inventory: { shiba: [], shooshy: [] }, equipped: { shiba: { face: null, head: null, body: null }, shooshy: { face: null, head: null, body: null } },
    ...overrides,
})

const run = (id: string, characterId: CompletedRun['characterId'], planSessionId: string | null = null, distanceKm: number | null = 5, completedAt = new Date(2026, 9, 10, 9, 0).toISOString()): CompletedRun => ({
    id, schemaVersion: SCHEMA_VERSION, createdAt: STAMP, updatedAt: STAMP, characterId,
    workoutId: 'easyRun', planSessionId, completedAt,
    elapsedMs: 1_500_000, distanceKm,
})

const render = (props: Partial<Parameters<typeof StatusScreen>[0]> = {}) =>
    renderToStaticMarkup(
        <StatusScreen character="shiba" progression={progression()} runs={[]} plan={PLAN} now={NOW} onCollect={noop} onChangeCharacter={changeCharacter} onEditAnswers={editAnswers} hasPastRun={false} onShowPastRun={showPastRun} {...props} />,
    )

const buttonOf = (html: string) => html.match(/<button[^>]*quest-button[^>]*>/)?.[0] ?? ''

describe('StatusScreen one character', () => {
    it('shows Chase only when Chase is the locked character', () => {
        const html = render({ character: 'shiba' })
        expect(html).toContain('<h1>How is Chase?</h1>')
        expect(html).toContain('Chase is obese')
        expect(html).toContain('Switch to Shooshy')
        expect(html).not.toContain('Shooshy is')
        expect(html).not.toContain('Fish')
        expect(html).not.toContain('fish')
    })

    it('shows Shooshy only when Shooshy is the locked character', () => {
        const html = render({ character: 'shooshy', progression: progression({ wallets: { shiba: 4, shooshy: 2 } }) })
        expect(html).toContain('<h1>How is Shooshy?</h1>')
        expect(html).toContain('Shooshy is obese')
        expect(html).toContain('Switch to Chase')
        expect(html).not.toContain('Chase is')
        expect(html).not.toContain('shiba')
        expect(html).not.toContain('Bones')
        expect(html).not.toContain('bone')
    })

    it('renders exactly one status card', () => {
        expect(render().match(/<article/g)?.length).toBe(1)
    })

    it('offers buttons to switch character and update answers', () => {
        const html = render()
        expect(html).toContain('>Switch to Shooshy</button>')
        expect(html).toContain('>Update answers</button>')
    })

    it('places Daily Food at the far right of the wallet row when enabled', () => {
        const html = render({ hasPastRun: true })
        expect(html.indexOf('class="status-wallet-balance"')).toBeLessThan(html.indexOf('class="quest-panel"'))
        expect(html).toContain('>View past run</button>')
        expect(render()).toMatch(/<button[^>]*disabled=""[^>]*>View past run<\/button>/)
    })

    it('does not show a redundant Back button', () => {
        const html = render()
        expect(html).not.toContain('>Back<')
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

    it('omits the verbose plan-session count while retaining health status', () => {
        const html = render({ runs: [run('r1', 'shiba', 'week-1-session-1')] })
        expect(html).not.toContain('Completed plan sessions in the last 7 days')
        expect(html).toContain('Chase is very healthy')
    })

    it('keeps the still decorative', () => {
        expect(render()).toMatch(/<img[^>]*alt=""/)
    })

    it('draws the equipped item only over the selected character still', () => {
        const html = render({
            progression: progression({ inventory: { shiba: ['chase-sushi-hat'], shooshy: [] }, equipped: { shiba: { face: null, head: 'chase-sushi-hat', body: null }, shooshy: { face: null, head: null, body: null } } }),
        })
        expect(html).toContain(`src="${cosmeticUrl('chase-sushi-hat')}"`)
        expect(html).toMatch(/<img[^>]*class="cosmetic-overlay"[^>]*aria-hidden="true"/)
        expect(html).not.toContain(cosmeticUrl('chase-black-sunglasses'))
    })

    it('draws every equipped slot over the still, one overlay per slot', () => {
        const html = render({
            progression: progression({ inventory: { shiba: ['chase-black-sunglasses', 'chase-sushi-hat'], shooshy: [] }, equipped: { shiba: { face: 'chase-black-sunglasses', head: 'chase-sushi-hat', body: null }, shooshy: { face: null, head: null, body: null } } }),
        })
        expect(html).toContain(`src="${cosmeticUrl('chase-black-sunglasses')}"`)
        expect(html).toContain(`src="${cosmeticUrl('chase-sushi-hat')}"`)
        expect(html.match(/class="cosmetic-overlay"/g)).toHaveLength(2)
    })
})

describe('StatusScreen plan-week distance goal', () => {
    it('tracks completed distance within the current plan week for the selected character', () => {
        const html = render({
            runs: [
                run('r1', 'shiba', null, 1.2),
                run('r2', 'shiba', null, 0.8),
                run('r3', 'shooshy', null, 5),
                run('r4', 'shiba', null, 3, new Date(2026, 9, 9, 9, 0).toISOString()),
            ]
        })

        expect(PLAN.weeks[0].targetKm).toBe(15)
        expect(html).toContain('2.0 / 15.0 km')
        expect(html).toContain('13.0 km left this week')
        expect(html).toContain('value="2" max="15"')
    })

    it('personalizes weekly progress for Shooshy', () => {
        const html = render({ character: 'shooshy', runs: [run('r1', 'shooshy', null, 2)] })
        expect(html).toContain('2.0 / 15.0 km')
        expect(html).toContain('13.0 km left this week')
    })

    it('updates the goal to the current week target, including week 5', () => {
        expect(PLAN.weeks[4].targetKm).toBeCloseTo(19.8, 1)
        const weekFiveStart = new Date(`${PLAN.weeks[4].startDate}T12:00:00`)
        const html = render({ now: weekFiveStart, runs: [run('r1', 'shiba', null, 2, weekFiveStart.toISOString())] })

        expect(html).toContain('2.0 / 19.8 km')
        expect(html).toContain('17.8 km left this week')
        expect(html).toContain('value="2" max="19.8"')
    })

    it('reports completion at the weekly target', () => {
        const html = render({ runs: [run('r1', 'shiba', null, 15.2)] })
        expect(html).toContain('Goal complete')
        expect(html).toContain('value="15" max="15"')
    })

    it('shows no goal without an active plan', () => {
        const html = render({ plan: null })
        expect(html).toContain('No active training plan')
        expect(html).not.toContain('daily 3 km goal')
    })
})

describe('StatusScreen wallet', () => {
    it('shows Chase’s bone icon and balance without the word Bones', () => {
        const html = render({ progression: progression({ wallets: { shiba: 3, shooshy: 0 } }) })
        expect(html).toContain('role="img" aria-label="3 bones"')
        expect(html).toContain('class="home-currency-icon"')
        expect(html).not.toContain('Bones:')
    })

    it('shows Shooshy’s fish icon and balance', () => {
        const html = render({ character: 'shooshy', progression: progression({ wallets: { shiba: 0, shooshy: 7 } }) })
        expect(html).toContain('role="img" aria-label="7 fish"')
        expect(html).toContain('class="home-currency-icon"')
    })

    it('does not show the other wallet', () => {
        const html = render({ progression: progression({ wallets: { shiba: 3, shooshy: 7 } }) })
        expect(html).toContain('aria-label="3 bones"')
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
        expect(buttonOf(html)).toContain('aria-label="Daily Food: collect 1 bone"')
        expect(html).toContain('>Daily Food</span>')
        expect(buttonOf(html)).toContain('aria-disabled="false"')
    })

    it('uses the fish name for Shooshy when units are pending', () => {
        const html = questFor('shooshy', '2026-10-07')
        expect(buttonOf(html)).toContain('aria-label="Daily Food: collect 3 fish"')
    })

    it('shows the claimed state after today is collected', () => {
        const html = questFor('shiba', '2026-10-10')
        expect(buttonOf(html)).toContain('aria-label="Daily Food done today"')
        expect(buttonOf(html)).toContain('aria-disabled="true"')
    })

    it('shows the nothing-yet state on the first day', () => {
        const html = questFor('shiba', '2026-10-10', '2026-10-10')
        expect(buttonOf(html)).toContain('aria-label="Daily Food: nothing to collect yet"')
        expect(buttonOf(html)).toContain('aria-disabled="true"')
    })

    it('does not show the backlog note', () => {
        expect(render()).not.toContain('Up to 14 days can be collected')
    })
})
