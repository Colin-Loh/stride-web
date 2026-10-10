import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ShopScreen } from './ShopScreen'
import { SCHEMA_VERSION, type Progression } from '../domain/types'
import { cosmeticUrl } from '../cosmetics/art'
import { COSMETICS, itemsFor } from '../cosmetics/catalog'

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
        <ShopScreen character="shiba" progression={progression()} onBuy={noop} onEquip={noop} onUnequip={noop} onBack={noop} {...props} />,
    )

const escape = (text: string) => text.replace(/'/g, '&#x27;')

/** The markup of one item card, from its heading to the next card. */
const itemFor = (html: string, name: string) => {
    const heading = html.indexOf(`<h3>${escape(name)}</h3>`)
    const start = html.lastIndexOf('<li', heading)
    const next = html.indexOf('<li', heading + 1)
    return html.slice(start, next === -1 ? undefined : next)
}

/** The markup of the fitting room section. */
const fittingRoomFor = (html: string) => {
    const start = html.indexOf('class="shop-fitting"')
    const end = html.indexOf('class="shop-grid"', start)
    return html.slice(start, end)
}

const cardsIn = (html: string) => html.match(/<li class="shop-card[^"]*"/g) ?? []

describe('ShopScreen shows only the selected character', () => {
    it('renders exactly the three items for Chase and none for Shooshy', () => {
        const html = render({ character: 'shiba' })
        expect(cardsIn(html)).toHaveLength(3)
        for (const item of itemsFor('shiba')) expect(html).toContain(`<h3>${escape(item.name)}</h3>`)
        expect(html).not.toContain('Knit scarf')
        expect(html).not.toContain('Sports headband')
        expect(html).not.toContain('Ribbon bow')
    })

    it('renders exactly the three items for Shooshy and none for Chase', () => {
        const html = render({ character: 'shooshy', progression: progression({ wallets: { shiba: 9, shooshy: 2 } }) })
        expect(cardsIn(html)).toHaveLength(3)
        for (const item of itemsFor('shooshy')) expect(html).toContain(`<h3>${escape(item.name)}</h3>`)
        expect(html).not.toContain('Bandana')
        expect(html).not.toContain('Runner')
    })

    it('shows only the selected character wallet, in its own currency', () => {
        const html = render({ character: 'shiba', progression: progression({ wallets: { shiba: 4, shooshy: 2 } }) })
        expect(html).toContain('4 bones')
        expect(html).not.toContain('2 fish')
        expect(html).not.toContain('Fish')

        const fish = render({ character: 'shooshy', progression: progression({ wallets: { shiba: 4, shooshy: 2 } }) })
        expect(fish).toContain('2 fish')
        expect(fish).not.toContain('4 bones')
    })

    it('uses the singular word for a balance of one', () => {
        expect(render({ progression: progression({ wallets: { shiba: 1, shooshy: 0 } }) })).toContain('1 bone<')
    })

    it('lists every catalog item under its own character only', () => {
        for (const item of COSMETICS) {
            const html = render({ character: item.character })
            expect(html).toContain(`<h3>${escape(item.name)}</h3>`)
        }
    })
})

describe('ShopScreen price and status text', () => {
    it('prices in the owning currency, singular for one unit', () => {
        const html = render()
        expect(itemFor(html, 'Bandana')).toContain('1 bone')
        expect(itemFor(html, 'Aviator sunglasses')).toContain('3 bones')
        const fish = render({ character: 'shooshy' })
        expect(itemFor(fish, 'Ribbon bow')).toContain('1 fish')
        expect(itemFor(fish, 'Knit scarf')).toContain('3 fish')
    })

    it('shows Costs N on an affordable, unowned item', () => {
        const html = render({ progression: progression({ wallets: { shiba: 1, shooshy: 0 } }) })
        expect(itemFor(html, 'Bandana')).toContain('<p class="shop-status">Costs 1 bone</p>')
    })

    it('shows Not enough with the missing amount on an unaffordable item', () => {
        const html = render({ progression: progression({ wallets: { shiba: 2, shooshy: 0 } }) })
        expect(itemFor(html, "Runner's medal")).toContain('Not enough (3 needed)')
    })

    it('shows Owned on an owned, unequipped item', () => {
        const html = render({ progression: progression({ wallets: { shiba: 9, shooshy: 0 }, inventory: { shiba: ['chase-bandana'], shooshy: [] } }) })
        expect(itemFor(html, 'Bandana')).toContain('<p class="shop-status">Owned</p>')
    })

    it('shows Equipped on the equipped item and no other card', () => {
        const html = render({
            progression: progression({ inventory: { shiba: ['chase-bandana'], shooshy: [] }, equipped: { shiba: 'chase-bandana', shooshy: null } }),
        })
        expect(itemFor(html, 'Bandana')).toContain('<p class="shop-status">Equipped</p>')
        expect(html.match(/>Equipped</g)).toHaveLength(1)
    })
})

describe('ShopScreen card actions', () => {
    it('enables Buy with the existing aria-label when the character can afford the item', () => {
        const html = render({ progression: progression({ wallets: { shiba: 1, shooshy: 0 } }) })
        const bandana = itemFor(html, 'Bandana')
        expect(bandana).toContain('aria-label="Buy Bandana for 1 bone"')
        expect(bandana).toContain('>Buy<')
        expect(bandana).not.toMatch(/<button[^>]*disabled/)
    })

    it('disables the action at insufficient funds with the existing aria-label', () => {
        const html = render({ progression: progression({ wallets: { shiba: 2, shooshy: 0 } }) })
        const medal = itemFor(html, "Runner's medal")
        expect(medal).toMatch(/<button[^>]*disabled/)
        expect(medal).toContain('aria-label="Not enough bones for Runner&#x27;s medal"')
        expect(medal).toContain('Not enough bones')
    })

    it('uses fish wording for unaffordable Shooshy items', () => {
        const html = render({ character: 'shooshy' })
        const headband = itemFor(html, 'Sports headband')
        expect(headband).toMatch(/<button[^>]*disabled/)
        expect(headband).toContain('Not enough fish')
    })

    it('shows an Equip button for an owned, unequipped item', () => {
        const html = render({ progression: progression({ inventory: { shiba: ['chase-bandana'], shooshy: [] } }) })
        const bandana = itemFor(html, 'Bandana')
        expect(bandana).toContain('aria-label="Equip Bandana"')
        expect(bandana).not.toContain('Buy')
    })

    it('shows an Unequip button for the equipped item', () => {
        const html = render({
            progression: progression({ inventory: { shiba: ['chase-bandana'], shooshy: [] }, equipped: { shiba: 'chase-bandana', shooshy: null } }),
        })
        const bandana = itemFor(html, 'Bandana')
        expect(bandana).toContain('aria-label="Unequip Bandana"')
        expect(bandana).toContain('>Unequip<')
    })
})

describe('ShopScreen fitting room', () => {
    it('shows Nothing equipped and no overlay when nothing is worn', () => {
        const room = fittingRoomFor(render())
        expect(room).toContain('Nothing equipped')
        expect(room).not.toContain('cosmetic-overlay')
    })

    it('draws the equipped overlay and names the item when one is worn', () => {
        const room = fittingRoomFor(
            render({ progression: progression({ inventory: { shiba: ['chase-medal'], shooshy: [] }, equipped: { shiba: 'chase-medal', shooshy: null } }) }),
        )
        expect(room).toContain('Wearing: Runner&#x27;s medal')
        expect(room).toContain('class="cosmetic-overlay"')
        expect(room).toContain(cosmeticUrl('chase-medal'))
        expect(room).not.toContain('Nothing equipped')
    })

    it('draws the overlay that matches the equipped id, not another item', () => {
        const room = fittingRoomFor(
            render({ progression: progression({ inventory: { shiba: ['chase-medal', 'chase-bandana'], shooshy: [] }, equipped: { shiba: 'chase-bandana', shooshy: null } }) }),
        )
        expect(room).toContain(cosmeticUrl('chase-bandana'))
        expect(room).not.toContain(cosmeticUrl('chase-medal'))
    })
})

describe('ShopScreen grid and accessibility', () => {
    it('renders a grid of three item cards, each a list item with a name heading', () => {
        const html = render()
        expect(html).toContain('class="shop-grid"')
        expect(cardsIn(html)).toHaveLength(3)
        expect(html.match(/<h3>/g)).toHaveLength(3)
    })

    it('marks the artwork as decorative with empty alt text', () => {
        const html = render()
        const images = html.match(/<img[^>]*>/g) ?? []
        expect(images.length).toBeGreaterThan(0)
        for (const image of images.filter((img) => img.includes('shop-art-image'))) {
            expect(image).toContain('alt=""')
        }
    })

    it('labels every button and gives the back action text', () => {
        const html = render({ progression: progression({ wallets: { shiba: 9, shooshy: 9 } }) })
        const buttons = html.match(/<button[^>]*>[^<]*<\/button>/g) ?? []
        expect(buttons).toHaveLength(4)
        for (const button of buttons) {
            expect(button).toMatch(/aria-label="|>[^<]+</)
        }
        expect(html).toContain('Back to home')
    })
})

describe('cosmetic art urls', () => {
    it('points each item at its own still-frame art', () => {
        for (const item of COSMETICS) {
            expect(cosmeticUrl(item.id)).toMatch(new RegExp(`cosmetics/${item.id}\\.png$`))
        }
    })
})
