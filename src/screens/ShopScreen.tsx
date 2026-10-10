import type { ReactNode } from 'react'
import { CHARACTER_NAMES, type Character } from '../domain/preferences'
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

export function ShopScreen({ character, progression, onBuy, onEquip, onUnequip, onBack }: Props) {
    const count = progression.wallets[character]
    const equippedId = progression.equipped[character]
    const equippedItem = itemsFor(character).find((item) => item.id === equippedId)

    return (
        <section className="card shop">
            <p className="shop-balance">
                <CurrencyIcon character={character} />
                <span>{`${count} ${wordFor(character, count)}`}</span>
            </p>
            <p className="eyebrow">Shop</p>
            <h1>{`${CHARACTER_NAMES[character]}'s accessories`}</h1>
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
