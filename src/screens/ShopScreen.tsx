import type { ReactNode } from 'react'
import type { Character } from '../domain/preferences'
import type { Progression } from '../domain/types'
import { itemsFor, type Cosmetic, type CosmeticId } from '../cosmetics/catalog'
import { cosmeticUrl } from '../cosmetics/art'
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

/** One item card: artwork, name, price, a status line as text, and the single action for its state. */
function ShopItem({ item, progression, onBuy, onEquip, onUnequip }: Omit<Props, 'character' | 'onBack'> & { item: Cosmetic }) {
    const { character, name, price } = item
    const wallet = progression.wallets[character]
    const cost = priceText(character, price)
    const state = stateOf(progression, item)

    let status: string
    let action: ReactNode
    switch (state) {
        case 'equipped':
            status = 'Equipped'
            action = (
                <button type="button" className="ghost shop-action" aria-label={`Unequip ${name}`} onClick={() => onUnequip(character)}>
                    Unequip
                </button>
            )
            break
        case 'owned':
            status = 'Owned'
            action = (
                <button type="button" className="ghost shop-action" aria-label={`Equip ${name}`} onClick={() => onEquip(item.id)}>
                    Equip
                </button>
            )
            break
        case 'affordable':
            status = `Costs ${cost}`
            action = (
                <button type="button" className="ghost shop-action" aria-label={`Buy ${name} for ${cost}`} onClick={() => onBuy(item.id)}>
                    Buy
                </button>
            )
            break
        case 'unaffordable': {
            const missing = price - wallet
            status = `Not enough (${missing} needed)`
            action = (
                <button type="button" className="ghost shop-action" disabled aria-label={`Not enough ${CURRENCY[character].plural} for ${name}`}>
                    {`Not enough ${CURRENCY[character].plural}`}
                </button>
            )
            break
        }
    }

    return (
        <li className={`shop-card shop-card-${state}`}>
            <div className="shop-art">
                <img className="shop-art-image" src={cosmeticUrl(item.id)} alt="" />
            </div>
            <h3>{name}</h3>
            <p className="shop-price">{cost}</p>
            <p className="shop-status">{status}</p>
            {action}
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

/** A pixel-style hanging lamp, drawn in the Stride palette. Decorative. */
function Lamp() {
    return (
        <svg className="shop-lamp" viewBox="0 0 48 40" aria-hidden="true" focusable="false">
            <rect x="23" y="0" width="2" height="12" fill="#0b1f18" />
            <path d="M14 22 L34 22 L40 34 L8 34 Z" fill="#3dd68c" />
            <rect x="8" y="34" width="32" height="3" fill="#1f7a52" />
            <rect x="21" y="25" width="6" height="4" fill="#f4fff9" />
        </svg>
    )
}

export function ShopScreen({ character, progression, onBuy, onEquip, onUnequip, onBack }: Props) {
    const count = progression.wallets[character]
    const equippedId = progression.equipped[character]
    const equippedItem = itemsFor(character).find((item) => item.id === equippedId)

    return (
        <section className="card shop">
            <header className="shop-header">
                <BrickWall />
                <Lamp />
                <div className="shop-sign">
                    <h1>Welcome to the Stride Shop!</h1>
                </div>
                <p className="shop-balance">
                    <CurrencyIcon character={character} />
                    <span>{`${count} ${wordFor(character, count)}`}</span>
                </p>
            </header>
            <div className="shop-strip">
                <h2>Accessories</h2>
            </div>
            <section className="shop-fitting" aria-label="Fitting room">
                <CharacterStill character={character} status="healthy" equipped={equippedId} />
                <p className="shop-wearing">{equippedItem ? `Wearing: ${equippedItem.name}` : 'Nothing equipped'}</p>
            </section>
            <ul className="shop-grid">
                {itemsFor(character).map((item) => (
                    <ShopItem key={item.id} item={item} progression={progression} onBuy={onBuy} onEquip={onEquip} onUnequip={onUnequip} />
                ))}
            </ul>
            <button type="button" className="link" onClick={onBack}>
                Back to home
            </button>
        </section>
    )
}
