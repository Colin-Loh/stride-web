// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { cleanup, fireEvent, render as rtl, screen } from '@testing-library/react'
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
    rewardedRunIds: [], grantsApplied: [], inventory: { shiba: [], shooshy: [] }, equipped: { shiba: { face: null, head: null, body: null }, shooshy: { face: null, head: null, body: null } },
    ...overrides,
})

const render = (props: Partial<Parameters<typeof ShopScreen>[0]> = {}) =>
    renderToStaticMarkup(
        <ShopScreen character="shiba" progression={progression()} onBuy={noop} onEquip={noop} onUnequip={noop} onBack={noop} {...props} />,
    )

const escape = (text: string) => text.replace(/'/g, '&#x27;')

/** The markup of one card, located by its accessible button name. */
const itemFor = (html: string, name: string) => {
    const label = html.indexOf(escape(name))
    const start = html.lastIndexOf('<li', label)
    const end = html.indexOf('</li>', label)
    return html.slice(start, end + 5)
}

const interactive = (props: Partial<Parameters<typeof ShopScreen>[0]> = {}) =>
    rtl(<ShopScreen character="shiba" progression={progression()} onBuy={noop} onEquip={noop} onUnequip={noop} onBack={noop} {...props} />)

const fittingButton = () => screen.getByRole('button', { name: 'Fitting Room' })

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
})

const cardsIn = (html: string) => html.match(/<li class="shop-card[^"]*"/g) ?? []

describe('ShopScreen shows only the selected character', () => {
    it('renders exactly the two items for Chase and none for Shooshy', () => {
        const html = render({ character: 'shiba' })
        expect(cardsIn(html)).toHaveLength(2)
        for (const item of itemsFor('shiba')) expect(html).toContain(`aria-label="Not enough bones for ${escape(item.name)}"`)
        expect(html).not.toContain('cosmetics/icons/shooshy-')
    })

    it('renders the two Shooshy items and none of the Chase items', () => {
        const html = render({ character: 'shooshy', progression: progression({ wallets: { shiba: 9, shooshy: 2 } }) })
        expect(cardsIn(html)).toHaveLength(2)
        for (const item of itemsFor('shooshy')) expect(itemFor(html, item.name)).toContain(`cosmetics/icons/${item.id}.png`)
        expect(html).not.toContain('cosmetics/icons/chase-')
    })

    it('shows only the selected character wallet as an icon and number', () => {
        const html = render({ character: 'shiba', progression: progression({ wallets: { shiba: 4, shooshy: 2 } }) })
        expect(html).toContain('aria-label="4 bones"')
        expect(html).toContain('<span aria-hidden="true">4</span>')
        expect(html).not.toContain('2 fish')
        const fish = render({ character: 'shooshy', progression: progression({ wallets: { shiba: 4, shooshy: 2 } }) })
        expect(fish).toContain('aria-label="2 fish"')
        expect(fish).not.toContain('4 bones')
    })

    it('uses the singular word for an accessible balance of one', () => {
        expect(render({ progression: progression({ wallets: { shiba: 1, shooshy: 0 } }) })).toContain('aria-label="1 bone"')
    })

    it('lists every catalog item under its own character only', () => {
        for (const item of COSMETICS) {
            const html = render({ character: item.character })
            expect(itemFor(html, item.name)).toContain(`cosmetics/icons/${item.id}.png`)
        }
    })
})

describe('ShopScreen visual card contents', () => {
    it('shows the correct pixel icon, currency glyph and numeric price without body copy', () => {
        for (const item of COSMETICS) {
            const card = itemFor(render({ character: item.character }), item.name)
            expect(card).toContain(`cosmetics/icons/${item.id}.png`)
            expect(card).toContain('class="home-currency-icon"')
            expect(card).toContain(`</svg>${item.price}</span>`)
            expect(card).not.toMatch(/<h3|<p[ >]|shop-status|>Buy<|>Equip<|>Owned<|>Worn</)
        }
    })

    it('marks owned items with a check and equipped items with a highlighted frame and check', () => {
        const owned = itemFor(render({ progression: progression({ inventory: { shiba: ['chase-sushi-hat'], shooshy: [] } }) }), 'Sushi hat')
        expect(owned).toContain('shop-card-owned')
        expect(owned).toContain('class="shop-owned-mark"')
        expect(owned).not.toContain('shop-card-equipped')
        const equipped = itemFor(render({ progression: progression({ inventory: { shiba: ['chase-sushi-hat'], shooshy: [] }, equipped: { shiba: { face: null, head: 'chase-sushi-hat', body: null }, shooshy: { face: null, head: null, body: null } } }) }), 'Sushi hat')
        expect(equipped).toContain('shop-card-equipped')
        expect(equipped).toContain('class="shop-owned-mark"')
        expect(equipped).not.toMatch(/>Worn<|>Owned</)
    })
})

describe('ShopScreen card actions', () => {
    it('enables Buy with the existing aria-label when the character can afford the item', () => {
        const html = render({ progression: progression({ wallets: { shiba: 3, shooshy: 0 } }) })
        const sushi = itemFor(html, 'Sushi hat')
        expect(sushi).toContain('aria-label="Buy Sushi hat for 3 bones"')
        expect(sushi).toContain('class="shop-price"')
        expect(sushi).not.toMatch(/<button[^>]*disabled/)
    })

    it('disables the action at insufficient funds with the existing aria-label', () => {
        const html = render({ progression: progression({ wallets: { shiba: 2, shooshy: 0 } }) })
        const sushi = itemFor(html, 'Sushi hat')
        expect(sushi).toMatch(/<button[^>]*disabled/)
        expect(sushi).toContain('aria-label="Not enough bones for Sushi hat"')
        expect(sushi).toContain('class="shop-price"')
    })

    it('offers Buy for a Shooshy item the Shooshy wallet can afford', () => {
        const html = render({ character: 'shooshy', progression: progression({ wallets: { shiba: 0, shooshy: 3 } }) })
        expect(itemFor(html, 'Sushi hat')).toContain('aria-label="Buy Sushi hat for 3 fish"')
        expect(html).toContain('aria-label="Buy Black sunglasses for 2 fish"')
    })

    it('shows an Equip button for an owned, unequipped item', () => {
        const html = render({ progression: progression({ inventory: { shiba: ['chase-sushi-hat'], shooshy: [] } }) })
        const sushi = itemFor(html, 'Sushi hat')
        expect(sushi).toContain('aria-label="Equip Sushi hat"')
        expect(sushi).not.toContain('aria-label="Buy')
    })

    it('shows an Unequip button for the equipped item', () => {
        const html = render({
            progression: progression({ inventory: { shiba: ['chase-sushi-hat'], shooshy: [] }, equipped: { shiba: { face: null, head: 'chase-sushi-hat', body: null }, shooshy: { face: null, head: null, body: null } } }),
        })
        const sushi = itemFor(html, 'Sushi hat')
        expect(sushi).toContain('aria-label="Unequip Sushi hat"')
        expect(sushi).toContain('class="shop-owned-mark"')
    })
    it('routes buy, equip and unequip through the existing handlers', () => {
        const onBuy = vi.fn()
        const onEquip = vi.fn()
        const onUnequip = vi.fn()
        const { rerender } = interactive({ progression: progression({ wallets: { shiba: 9, shooshy: 0 } }), onBuy, onEquip, onUnequip })
        fireEvent.click(screen.getByRole('button', { name: 'Buy Sushi hat for 3 bones' }))
        fireEvent.click(screen.getByRole('button', { name: 'Confirm purchase of Sushi hat for 3 bones' }))
        expect(onBuy).toHaveBeenCalledWith('chase-sushi-hat')
        rerender(<ShopScreen character="shiba" progression={progression({ inventory: { shiba: ['chase-sushi-hat'], shooshy: [] } })} onBuy={onBuy} onEquip={onEquip} onUnequip={onUnequip} onBack={noop} />)
        fireEvent.click(screen.getByRole('button', { name: 'Equip Sushi hat' }))
        expect(onEquip).toHaveBeenCalledWith('chase-sushi-hat')
        rerender(<ShopScreen character="shiba" progression={progression({ inventory: { shiba: ['chase-sushi-hat'], shooshy: [] }, equipped: { shiba: { face: null, head: 'chase-sushi-hat', body: null }, shooshy: { face: null, head: null, body: null } } })} onBuy={onBuy} onEquip={onEquip} onUnequip={onUnequip} onBack={noop} />)
        fireEvent.click(screen.getByRole('button', { name: 'Unequip Sushi hat' }))
        expect(onUnequip).toHaveBeenCalledWith('shiba', 'head')
    })
})

describe('ShopScreen fitting room button and panel', () => {
    it('renders a Fitting Room button that starts collapsed with no panel', () => {
        interactive()
        const button = fittingButton()
        expect(button.getAttribute('aria-expanded')).toBe('false')
        expect(screen.queryByRole('region', { name: 'Fitting room' })).toBeNull()
        expect(screen.queryByText(/Nothing equipped|Wearing:/)).toBeNull()
    })

    it('opens the panel on click and shows Nothing equipped with no overlay', () => {
        const { container } = interactive()
        fireEvent.click(fittingButton())
        expect(fittingButton().getAttribute('aria-expanded')).toBe('true')
        expect(screen.getByRole('region', { name: 'Fitting room' })).toBeTruthy()
        expect(screen.getByText('Nothing equipped')).toBeTruthy()
        expect(container.querySelector('.cosmetic-overlay')).toBeNull()
    })

    it('names the equipped item and draws its overlay when one is worn', () => {
        const { container } = interactive({
            progression: progression({ inventory: { shiba: ['chase-sushi-hat'], shooshy: [] }, equipped: { shiba: { face: null, head: 'chase-sushi-hat', body: null }, shooshy: { face: null, head: null, body: null } } }),
        })
        fireEvent.click(fittingButton())
        expect(screen.getByText('Wearing: Sushi hat')).toBeTruthy()
        expect(screen.queryByText('Nothing equipped')).toBeNull()
        expect(container.querySelector('.shop-fitting .cosmetic-overlay')?.getAttribute('src')).toBe(cosmeticUrl('chase-sushi-hat'))
    })

    it('draws the overlay that matches the equipped id, not another item', () => {
        const { container } = interactive({
            progression: progression({ inventory: { shiba: ['chase-black-sunglasses', 'chase-sushi-hat'], shooshy: [] }, equipped: { shiba: { face: null, head: 'chase-sushi-hat', body: null }, shooshy: { face: null, head: null, body: null } } }),
        })
        fireEvent.click(fittingButton())
        const overlays = [...container.querySelectorAll('.shop-fitting .cosmetic-overlay')].map((img) => img.getAttribute('src'))
        expect(overlays).toEqual([cosmeticUrl('chase-sushi-hat')])
    })

    it('closes with the Close button and returns focus to the Fitting Room button', () => {
        interactive()
        fireEvent.click(fittingButton())
        fireEvent.click(screen.getByRole('button', { name: 'Close' }))
        expect(screen.queryByRole('region', { name: 'Fitting room' })).toBeNull()
        expect(fittingButton().getAttribute('aria-expanded')).toBe('false')
        expect(document.activeElement).toBe(fittingButton())
    })

    it('closes on Escape and returns focus to the Fitting Room button', () => {
        interactive()
        fireEvent.click(fittingButton())
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(screen.queryByRole('region', { name: 'Fitting room' })).toBeNull()
        expect(document.activeElement).toBe(fittingButton())
    })

    it('ignores keys other than Escape while open', () => {
        interactive()
        fireEvent.click(fittingButton())
        fireEvent.keyDown(document, { key: 'Enter' })
        expect(screen.getByRole('region', { name: 'Fitting room' })).toBeTruthy()
    })

    it('toggles closed when the Fitting Room button is pressed again', () => {
        interactive()
        fireEvent.click(fittingButton())
        fireEvent.click(fittingButton())
        expect(screen.queryByRole('region', { name: 'Fitting room' })).toBeNull()
        expect(fittingButton().getAttribute('aria-expanded')).toBe('false')
    })

    it('writes nothing to storage when the panel opens or closes', () => {
        const setItem = vi.spyOn(Storage.prototype, 'setItem')
        interactive()
        fireEvent.click(fittingButton())
        fireEvent.click(screen.getByRole('button', { name: 'Close' }))
        fireEvent.click(fittingButton())
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(setItem).not.toHaveBeenCalled()
    })
})

describe('ShopScreen grid and accessibility', () => {
    it('renders a grid of equal-format icon cards, one per item for the character', () => {
        const html = render()
        expect(html).toContain('class="shop-grid" aria-label="Accessories"')
        expect(cardsIn(html)).toHaveLength(itemsFor('shiba').length)
        expect(html.match(/class="shop-art-image"/g)).toHaveLength(itemsFor('shiba').length)
        expect(html).not.toContain('<h3>')
    })

    it('marks the artwork as decorative with empty alt text', () => {
        const html = render()
        const images = html.match(/<img[^>]*>/g) ?? []
        expect(images.length).toBeGreaterThan(0)
        for (const image of images.filter((img) => img.includes('shop-art-image'))) {
            expect(image).toContain('alt=""')
        }
    })

    it('labels every button including icon-only cards and the back action', () => {
        interactive({ progression: progression({ wallets: { shiba: 9, shooshy: 9 } }) })
        for (const button of screen.getAllByRole('button')) expect(button.getAttribute('aria-label') || button.textContent?.trim()).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Back to home' })).toBeTruthy()
        expect(fittingButton().querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    })
})

describe('ShopScreen lays out the item grid as a centred row', () => {
    it.each(['shiba', 'shooshy'] as const)('centres the cards in the grid for %s', (character) => {
        const html = render({ character })
        const grid = html.match(/<ul class="shop-grid"[^>]*>/)
        expect(grid).not.toBeNull()
        expect(grid?.[0]).not.toContain('style=')
        expect(cardsIn(html)).toHaveLength(itemsFor(character).length)
    })
})

describe('ShopScreen header, sign and section label', () => {
    it('keeps the welcome sign and labels the grid without a visible section strip', () => {
        const html = render()
        expect(html).toMatch(/<h1>Welcome to the Stride Shop!<\/h1>/)
        expect(html).toContain('aria-label="Accessories"')
        expect(html).not.toContain('class="shop-strip"')
    })

    it('draws the brick wall as decorative SVG', () => {
        const html = render()
        const header = html.slice(html.indexOf('class="shop-header"'), html.indexOf('class="shop-grid"'))
        expect(header).toContain('class="shop-wall"')
        expect(header).not.toContain('class="shop-lamp"')
        expect(header.match(/<svg[^>]*>/g)?.every((svg) => svg.includes('aria-hidden="true"'))).toBe(true)
    })
})

describe('ShopScreen currency pill', () => {
    it('shows only the selected character wallet in the header pill', () => {
        const html = render({ character: 'shooshy', progression: progression({ wallets: { shiba: 7, shooshy: 3 } }) })
        const pill = html.slice(html.indexOf('class="shop-balance"'), html.indexOf('</p>', html.indexOf('class="shop-balance"')))
        expect(pill).toContain('aria-label="3 fish"')
        expect(pill).toContain('<span aria-hidden="true">3</span>')
        expect(pill).not.toContain('7 bones')
        expect(pill).toContain('<svg')
        expect(html.match(/class="shop-balance"/g)).toHaveLength(1)
    })

    it('uses the singular word in the pill for a balance of one', () => {
        const html = render({ progression: progression({ wallets: { shiba: 1, shooshy: 5 } }) })
        expect(html).toContain('aria-label="1 bone"')
    })
})

describe('ShopScreen state styling', () => {
    it('has a distinct card class for each purchase or ownership state', () => {
        const states = [
            ['equipped', progression({ inventory: { shiba: ['chase-sushi-hat'], shooshy: [] }, equipped: { shiba: { face: null, head: 'chase-sushi-hat', body: null }, shooshy: { face: null, head: null, body: null } } }), 'Sushi hat'],
            ['owned', progression({ inventory: { shiba: ['chase-sushi-hat'], shooshy: [] } }), 'Sushi hat'],
            ['affordable', progression({ wallets: { shiba: 3, shooshy: 0 } }), 'Sushi hat'],
            ['unaffordable', progression(), 'Sushi hat'],
        ] as const
        for (const [state, data, name] of states) expect(itemFor(render({ progression: data }), name)).toContain(`shop-card-${state}`)
    })
})

describe('ShopScreen purchase confirm panel', () => {
    const confirmDialog = () => screen.queryByRole('dialog')
    const openSushi = (props: Partial<Parameters<typeof ShopScreen>[0]> = {}) => {
        const onBuy = vi.fn()
        const result = interactive({ progression: progression({ wallets: { shiba: 9, shooshy: 0 } }), onBuy, ...props })
        fireEvent.click(screen.getByRole('button', { name: 'Buy Sushi hat for 3 bones' }))
        return { ...result, onBuy }
    }

    it('does not call onBuy when a buyable item is clicked, and opens the dialog instead', () => {
        const onBuy = vi.fn()
        interactive({ progression: progression({ wallets: { shiba: 9, shooshy: 0 } }), onBuy })
        fireEvent.click(screen.getByRole('button', { name: 'Buy Sushi hat for 3 bones' }))
        expect(onBuy).not.toHaveBeenCalled()
        const dialog = confirmDialog()
        expect(dialog).not.toBeNull()
        expect(dialog?.getAttribute('aria-modal')).toBe('true')
    })

    it('shows the item name, price, and balance before and after as numbers with the currency word', () => {
        openSushi()
        const dialog = confirmDialog() as HTMLElement
        expect(dialog.textContent).toContain('Sushi hat')
        expect(dialog.textContent).toContain('3 bones')
        expect(dialog.textContent).toContain('9 bones')
        expect(dialog.textContent).toContain('6 bones')
    })

    it('uses the singular word when the balance after the purchase is one', () => {
        interactive({ progression: progression({ wallets: { shiba: 4, shooshy: 0 } }) })
        fireEvent.click(screen.getByRole('button', { name: 'Buy Sushi hat for 3 bones' }))
        expect((confirmDialog() as HTMLElement).textContent).toContain('1 bone')
    })

    it('moves focus into the dialog on open', () => {
        openSushi()
        expect(document.activeElement).toBe(confirmDialog())
    })

    it('calls onBuy exactly once on Confirm, then closes the dialog and returns focus to the card', () => {
        const { onBuy } = openSushi()
        fireEvent.click(screen.getByRole('button', { name: 'Confirm purchase of Sushi hat for 3 bones' }))
        expect(onBuy).toHaveBeenCalledTimes(1)
        expect(onBuy).toHaveBeenCalledWith('chase-sushi-hat')
        expect(confirmDialog()).toBeNull()
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Buy Sushi hat for 3 bones' }))
    })

    it('Cancel calls nothing, closes the dialog, and returns focus to the card', () => {
        const onBuy = vi.fn()
        const setItem = vi.spyOn(Storage.prototype, 'setItem')
        interactive({ progression: progression({ wallets: { shiba: 9, shooshy: 0 } }), onBuy })
        fireEvent.click(screen.getByRole('button', { name: 'Buy Sushi hat for 3 bones' }))
        fireEvent.click(screen.getByRole('button', { name: 'Cancel purchase of Sushi hat' }))
        expect(onBuy).not.toHaveBeenCalled()
        expect(setItem).not.toHaveBeenCalled()
        expect(confirmDialog()).toBeNull()
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Buy Sushi hat for 3 bones' }))
    })

    it('Escape cancels with no change and closes the dialog', () => {
        const onBuy = vi.fn()
        const setItem = vi.spyOn(Storage.prototype, 'setItem')
        interactive({ progression: progression({ wallets: { shiba: 9, shooshy: 0 } }), onBuy })
        fireEvent.click(screen.getByRole('button', { name: 'Buy Sushi hat for 3 bones' }))
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(onBuy).not.toHaveBeenCalled()
        expect(setItem).not.toHaveBeenCalled()
        expect(confirmDialog()).toBeNull()
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Buy Sushi hat for 3 bones' }))
    })

    it('Escape closes only the confirm dialog, not the fitting room behind it', () => {
        interactive({ progression: progression({ wallets: { shiba: 9, shooshy: 0 } }) })
        fireEvent.click(fittingButton())
        fireEvent.click(screen.getByRole('button', { name: 'Buy Sushi hat for 3 bones' }))
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(confirmDialog()).toBeNull()
        expect(screen.getByRole('region', { name: 'Fitting room' })).toBeTruthy()
    })

    it('has accessible names on both Confirm and Cancel', () => {
        openSushi()
        expect(screen.getByRole('button', { name: 'Confirm purchase of Sushi hat for 3 bones' })).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Cancel purchase of Sushi hat' })).toBeTruthy()
    })

    it('shows the new wallet balance once the parent applies the purchase', () => {
        const { rerender, onBuy } = openSushi()
        fireEvent.click(screen.getByRole('button', { name: 'Confirm purchase of Sushi hat for 3 bones' }))
        expect(onBuy).toHaveBeenCalledTimes(1)
        rerender(<ShopScreen character="shiba" progression={progression({ wallets: { shiba: 6, shooshy: 0 }, inventory: { shiba: ['chase-sushi-hat'], shooshy: [] } })} onBuy={onBuy} onEquip={noop} onUnequip={noop} onBack={noop} />)
        expect(screen.getByLabelText('6 bones')).toBeTruthy()
    })
})

describe('cosmetic art urls', () => {
    it('points each item at its own still-frame art', () => {
        for (const item of COSMETICS) {
            expect(cosmeticUrl(item.id)).toMatch(new RegExp(`cosmetics/${item.id}\\.png$`))
        }
    })
})
