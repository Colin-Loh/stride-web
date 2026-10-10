import { useCallback, useEffect, useRef, useState } from 'react'
import type { Character } from '../domain/preferences'
import type { Progression } from '../domain/types'
import { itemsFor, type Cosmetic, type CosmeticId } from '../cosmetics/catalog'
import { canAfford } from '../cosmetics/shop'
import { CharacterStill } from '../components/CharacterStill'
import { CurrencyIcon } from '../components/CurrencyIcon'

/** Each character's currency, singular and plural, as used on screen. */
const CURRENCY: Record<Character, { singular: string; plural: string }> = {
    shiba: { singular: 'bone', plural: 'bones' },
    shooshy: { singular: 'fish', plural: 'fish' },
}

const wordFor = (character: Character, count: number) =>
    count === 1 ? CURRENCY[character].singular : CURRENCY[character].plural

const priceText = (character: Character, price: number) => `${price} ${wordFor(character, price)}`

interface Props {
    character: Character
    progression: Progression
    onBuy: (itemId: CosmeticId) => void
    onEquip: (itemId: CosmeticId) => void
    onUnequip: (character: Character) => void
    onBack: () => void
}

type ItemState = 'equipped' | 'owned' | 'affordable' | 'unaffordable'

/** Which state an item is in. Equipped wins over owned, and owned wins over affordability. */
function stateOf(progression: Progression, item: Cosmetic): ItemState {
    if (progression.equipped[item.character] === item.id) return 'equipped'
    if (progression.inventory[item.character].includes(item.id)) return 'owned'
    return canAfford(progression, item.id) ? 'affordable' : 'unaffordable'
}

/** The entire card is the action; its accessible name retains the item and its state. */
function ShopItem({ item, progression, onBuy, onEquip, onUnequip }: Omit<Props, 'character' | 'onBack'> & { item: Cosmetic }) {
    const { character, name, price } = item
    const cost = priceText(character, price)
    const state = stateOf(progression, item)
    const label = state === 'equipped' ? `Unequip ${name}`
        : state === 'owned' ? `Equip ${name}`
            : state === 'affordable' ? `Buy ${name} for ${cost}`
                : `Not enough ${CURRENCY[character].plural} for ${name}`
    const action = state === 'equipped' ? () => onUnequip(character)
        : state === 'owned' ? () => onEquip(item.id)
            : () => onBuy(item.id)

    return (
        <li className={`shop-card shop-card-${state}`}>
            <button type="button" className="shop-action" aria-label={label} disabled={state === 'unaffordable'} onClick={action}>
                {(state === 'owned' || state === 'equipped') && <span className="shop-owned-mark" aria-hidden="true">✓</span>}
                <img className="shop-art-image" src={`${import.meta.env.BASE_URL}cosmetics/icons/${item.id}.png`} alt="" />
                <span className="shop-price" aria-hidden="true">
                    <CurrencyIcon character={character} />
                    {price}
                </span>
            </button>
        </li>
    )
}

/**
 * The brick wall behind the sign: a pixel-style pattern of two courses of bricks, the second
 * course offset by half a brick. Decorative, so it carries no text.
 */
function BrickWall() {
    return (
        <svg className="shop-wall" aria-hidden="true" focusable="false">
            <defs>
                <pattern id="shop-brick" width="32" height="16" patternUnits="userSpaceOnUse">
                    <rect width="32" height="16" fill="#1d4a3a" />
                    <rect x="0" y="0" width="32" height="2" fill="#0b1f18" />
                    <rect x="0" y="0" width="2" height="8" fill="#0b1f18" />
                    <rect x="16" y="8" width="2" height="8" fill="#0b1f18" />
                    <rect x="3" y="4" width="10" height="3" fill="#245a46" />
                    <rect x="19" y="12" width="10" height="3" fill="#245a46" />
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#shop-brick)" />
        </svg>
    )
}

const FITTING_PANEL_ID = 'shop-fitting-panel'

export function ShopScreen({ character, progression, onBuy, onEquip, onUnequip, onBack }: Props) {
    const count = progression.wallets[character]
    const equippedId = progression.equipped[character]
    const equippedItem = itemsFor(character).find((item) => item.id === equippedId)

    const [fittingOpen, setFittingOpen] = useState(false)
    const toggleRef = useRef<HTMLButtonElement>(null)
    const closeRef = useRef<HTMLButtonElement>(null)

    /** Hides the panel and hands focus back to the button that opened it. Nothing is stored. */
    const closeFitting = useCallback(() => {
        setFittingOpen(false)
        toggleRef.current?.focus()
    }, [])

    // Opening moves focus to the panel's Close button, so keyboard users land inside it.
    useEffect(() => {
        if (fittingOpen) closeRef.current?.focus()
    }, [fittingOpen])

    // Escape closes the panel from anywhere on the page while it is open.
    useEffect(() => {
        if (!fittingOpen) return
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeFitting()
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [fittingOpen, closeFitting])

    return (
        <section className="card shop">
            <header className="shop-header">
                <BrickWall />
                <div className="shop-sign">
                    <h1>Welcome to the Stride Shop!</h1>
                </div>
                <p className="shop-balance" aria-label={`${count} ${wordFor(character, count)}`}>
                    <CurrencyIcon character={character} />
                    <span aria-hidden="true">{count}</span>
                </p>
            </header>
            <ul className="shop-grid" aria-label="Accessories">
                {itemsFor(character).map((item) => (
                    <ShopItem key={item.id} item={item} progression={progression} onBuy={onBuy} onEquip={onEquip} onUnequip={onUnequip} />
                ))}
            </ul>
            <div className="shop-fitting-bar">
                <button
                    ref={toggleRef}
                    type="button"
                    className="ghost shop-fitting-button"
                    aria-expanded={fittingOpen}
                    aria-controls={fittingOpen ? FITTING_PANEL_ID : undefined}
                    onClick={() => (fittingOpen ? closeFitting() : setFittingOpen(true))}
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M10 6a2 2 0 1 1 3 1.73C12.4 8.1 12 8.5 12 9.2V11l9 7v2H3v-2l9-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                    </svg>
                    Fitting Room
                </button>
            </div>
            {fittingOpen && (
                <section id={FITTING_PANEL_ID} className="shop-fitting" aria-label="Fitting room">
                    <CharacterStill character={character} status="healthy" equipped={equippedId} />
                    <p className="shop-wearing">{equippedItem ? `Wearing: ${equippedItem.name}` : 'Nothing equipped'}</p>
                    <button ref={closeRef} type="button" className="ghost shop-fitting-close" onClick={closeFitting}>
                        Close
                    </button>
                </section>
            )}
            <button type="button" className="link" onClick={onBack}>
                Back to home
            </button>
        </section>
    )
}
