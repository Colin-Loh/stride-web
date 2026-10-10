import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ShopScreen } from './ShopScreen'
import { SCHEMA_VERSION, type Progression } from '../domain/types'
import { cosmeticUrl } from '../cosmetics/art'
import { COSMETICS } from '../cosmetics/catalog'

const noop = () => {}
const STAMP = '2026-10-01T00:00:00.000Z'

const progression = (overrides: Partial<Progression> = {}): Progression => ({
    id: 'progression', schemaVersion: SCHEMA_VERSION, createdAt: STAMP, updatedAt: STAMP,
    startDate: '2026-10-01',
    wallets: { shiba: 0, shooshy: 0 },
    lastClaimedDate: { shiba: '2026-10-01', shooshy: '2026-10-01' },
    rewardedRunIds: [], inventory: { shiba: [], shooshy: [] }, equipped: { shiba: null, shooshy: null },
    ...overrides,
})

const render = (props: Partial<Parameters<typeof ShopScreen>[0]> = {}) =>
    renderToStaticMarkup(
        <ShopScreen progression={progression()} onBuy={noop} onEquip={noop} onUnequip={noop} onBack={noop} {...props} />,
    )

/** The markup of one character's section, from its heading to the next section. */
const sectionFor = (html: string, character: 'shiba' | 'shooshy') => {
    const heading = html.indexOf(`<h2 id="shop-${character}"`)
    const start = html.lastIndexOf('<article', heading)
    const next = html.indexOf('<article', heading + 1)
    return html.slice(start, next === -1 ? undefined : next)
}

/** The markup of one item, from its heading to the next item. */
const itemFor = (html: string, name: string) => {
    const heading = html.indexOf(`<h3>${name}</h3>`)
    const start = html.lastIndexOf('<li', heading)
    const next = html.indexOf('<li', heading + 1)
    return html.slice(start, next === -1 ? undefined : next)
}

describe('ShopScreen labels and prices', () => {
    it('shows each character section with its wallet in its own currency', () => {
        const html = render({ progression: progression({ wallets: { shiba: 4, shooshy: 2 } }) })
        expect(sectionFor(html, 'shiba')).toContain('Bones: 4')
        expect(sectionFor(html, 'shooshy')).toContain('Fish: 2')
    })

    it('prices in the owning currency, singular for one unit', () => {
        const html = render()
        expect(itemFor(html, 'Bandana')).toContain('Costs 1 bone')
        expect(itemFor(html, 'Aviator sunglasses')).toContain('Costs 3 bones')
        expect(itemFor(html, 'Ribbon bow')).toContain('Costs 1 fish')
        expect(itemFor(html, 'Knit scarf')).toContain('Costs 3 fish')
    })

    it('lists every catalog item under its own character only', () => {
        const html = render()
        for (const item of COSMETICS) {
            expect(sectionFor(html, item.character)).toContain(`<h3>${item.name.replace(/'/g, '&#x27;')}</h3>`)
        }
        expect(sectionFor(html, 'shiba')).not.toContain('Knit scarf')
        expect(sectionFor(html, 'shooshy')).not.toContain('Bandana')
    })
})

describe('ShopScreen buy states', () => {
    it('enables Buy when the character can afford the item', () => {
        const html = render({ progression: progression({ wallets: { shiba: 1, shooshy: 0 } }) })
        expect(itemFor(html, 'Bandana')).toContain('>Buy<')
        expect(itemFor(html, 'Bandana')).not.toMatch(/<button[^>]*disabled/)
    })

    it('disables the item and says why when the character cannot afford it', () => {
        const html = render({ progression: progression({ wallets: { shiba: 2, shooshy: 0 } }) })
        const medal = itemFor(html, "Runner&#x27;s medal")
        expect(medal).toMatch(/<button[^>]*disabled/)
        expect(medal).toContain('Not enough bones')
        expect(medal).toContain('You have 2 bones.')
    })

    it('uses fish wording for Shooshy items that are unaffordable', () => {
        const html = render({ progression: progression({ wallets: { shiba: 0, shooshy: 0 } }) })
        const headband = itemFor(html, 'Sports headband')
        expect(headband).toMatch(/<button[^>]*disabled/)
        expect(headband).toContain('Not enough fish')
    })

    it('does not spend or buy across characters: Chase wallet cannot buy a Shooshy item', () => {
        const html = render({ progression: progression({ wallets: { shiba: 99, shooshy: 0 } }) })
        expect(itemFor(html, 'Knit scarf')).toContain('Not enough fish')
    })

    it('shows Owned with an Equip button for an owned, unequipped item', () => {
        const html = render({ progression: progression({ wallets: { shiba: 9, shooshy: 0 }, inventory: { shiba: ['chase-bandana'], shooshy: [] } }) })
        const bandana = itemFor(html, 'Bandana')
        expect(bandana).toContain('Owned')
        expect(bandana).toContain('aria-label="Equip Bandana"')
        expect(bandana).not.toContain('Buy')
    })
})

describe('ShopScreen equipped state', () => {
    const equipped = progression({
        wallets: { shiba: 0, shooshy: 0 },
        inventory: { shiba: ['chase-bandana'], shooshy: ['shooshy-ribbon'] },
        equipped: { shiba: 'chase-bandana', shooshy: null },
    })

    it('shows Equipped with an Unequip button for the equipped item', () => {
        const bandana = itemFor(render({ progression: equipped }), 'Bandana')
        expect(bandana).toContain('Equipped')
        expect(bandana).toContain('aria-label="Unequip Bandana"')
        expect(bandana).toContain('>Unequip<')
    })

    it('leaves the other character with no Equipped text', () => {
        const html = render({ progression: equipped })
        expect(sectionFor(html, 'shooshy')).not.toContain('Equipped')
        expect(itemFor(html, 'Ribbon bow')).toContain('Owned')
    })
})

describe('ShopScreen accessibility', () => {
    it('labels every button and gives the back action text', () => {
        const html = render({ progression: progression({ wallets: { shiba: 9, shooshy: 9 } }) })
        const buttons = html.match(/<button[^>]*>[^<]*<\/button>/g) ?? []
        expect(buttons.length).toBeGreaterThan(0)
        for (const button of buttons) {
            expect(button).toMatch(/aria-label="|>[^<]+</)
        }
        expect(html).toContain('Back to status')
    })
})

describe('cosmetic art urls', () => {
    it('points each item at its own still-frame art', () => {
        for (const item of COSMETICS) {
            expect(cosmeticUrl(item.id)).toMatch(new RegExp(`cosmetics/${item.id}\\.png$`))
        }
    })
})
