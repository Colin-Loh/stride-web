import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import App from './App'
import type { Repositories } from './storage/repository'

// The flow hook is replaced so each view can be rendered without storage or effects.
const flowState = vi.hoisted(() => ({ view: 'home' as string }))

vi.mock('./hooks/useAppFlow', () => ({
    useAppFlow: () => ({
        ready: true,
        preferences: { name: 'Colin', character: 'shiba', weightKg: null, muted: false },
        view: flowState.view,
        session: null,
        plan: { id: 'plan' },
        open: null,
        notice: '',
        progression: { wallets: { shiba: 0, shooshy: 0 }, inventory: { shiba: [], shooshy: [] }, equipped: { shiba: { face: null, head: null, body: null }, shooshy: { face: null, head: null, body: null } } },
        runLog: [],
        answers: null,
        setView: () => {},
        showPlan: () => {}, openShop: () => {}, openStatus: () => {},
        collectIncome: async () => 0, buyCosmetic: () => {}, equipCosmetic: () => {}, unequipCosmetic: () => {},
        dismissNotice: () => {}, submitAction: 'edit', editAnswers: () => {},
    }),
}))

vi.mock('./screens/PlanScreen', () => ({ PlanScreen: () => <div data-testid="plan-body" /> }))
vi.mock('./screens/ShopScreen', () => ({ ShopScreen: () => <div data-testid="shop-body" /> }))
vi.mock('./screens/StatusScreen', () => ({ StatusScreen: () => <div data-testid="status-body" /> }))
vi.mock('./screens/CategoryScreen', () => ({ CategoryScreen: () => <div data-testid="category-body" /> }))

const repositories = {} as Repositories

const renderView = (view: string) => {
    flowState.view = view
    return renderToStaticMarkup(<App repositories={repositories} />)
}

const mainNav = (html: string) => {
    const match = html.match(/<nav class="home-nav" aria-label="Main">[\s\S]*?<\/nav>/)
    return match?.[0] ?? ''
}

const buttonCount = (nav: string) => (nav.match(/<button/g) ?? []).length

describe('main navigation bar on every main view', () => {
    it.each(['plan', 'shop', 'status', 'category'])('renders the Main nav with four buttons on %s', (view) => {
        const nav = mainNav(renderView(view))
        expect(nav).not.toBe('')
        expect(buttonCount(nav)).toBe(4)
        expect(nav).toContain('Workouts')
        expect(nav).toContain('My plan')
        expect(nav).toContain('Shop')
        expect(nav).toContain('Status')
    })

    it.each([
        ['plan', 'My plan'],
        ['shop', 'Shop'],
        ['status', 'Status'],
        ['category', 'Workouts'],
    ])('marks the %s destination as the current page', (view, label) => {
        const nav = mainNav(renderView(view))
        const current = nav.match(/<button[^>]*aria-current="page"[^>]*>([^<]*)<\/button>/)
        expect(current?.[1]).toBe(label)
    })

    it('does not render the bar on the run, name or baseline views', () => {
        for (const view of ['name', 'baseline']) {
            expect(mainNav(renderView(view))).toBe('')
        }
    })
})
