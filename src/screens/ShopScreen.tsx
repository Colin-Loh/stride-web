import { CHARACTER_NAMES, type Character } from '../domain/preferences'
import type { Progression } from '../domain/types'
import { itemsFor, type Cosmetic, type CosmeticId } from '../cosmetics/catalog'
import { canAfford } from '../cosmetics/shop'

/** Each character's currency, with the words used on screen. */
const CURRENCY: Record<Character, { singular: string; plural: string; wallet: string }> = {
    shiba: { singular: 'bone', plural: 'bones', wallet: 'Bones' },
    shooshy: { singular: 'fish', plural: 'fish', wallet: 'Fish' },
}

const ROWS: Character[] = ['shiba', 'shooshy']

const priceText = (character: Character, price: number) =>
    `${price} ${price === 1 ? CURRENCY[character].singular : CURRENCY[character].plural}`

interface Props {
    progression: Progression
    onBuy: (itemId: CosmeticId) => void
    onEquip: (itemId: CosmeticId) => void
    onUnequip: (character: Character) => void
    onBack: () => void
}

/** One item: its name, its status as text, and the single action that applies to it. */
function ShopItem({ item, progression, onBuy, onEquip, onUnequip }: Omit<Props, 'onBack'> & { item: Cosmetic }) {
    const { character, name, price } = item
    const currency = CURRENCY[character]
    const cost = priceText(character, price)
    const wallet = progression.wallets[character]
    const owned = progression.inventory[character].includes(item.id)
    const equipped = progression.equipped[character] === item.id

    if (equipped) {
        return (
            <li className="shop-item">
                <h3>{name}</h3>
                <p>Equipped</p>
                <button type="button" className="ghost" aria-label={`Unequip ${name}`} onClick={() => onUnequip(character)}>
                    Unequip
                </button>
            </li>
        )
    }
    if (owned) {
        return (
            <li className="shop-item">
                <h3>{name}</h3>
                <p>Owned</p>
                <button type="button" className="ghost" aria-label={`Equip ${name}`} onClick={() => onEquip(item.id)}>
                    Equip
                </button>
            </li>
        )
    }
    if (canAfford(progression, item.id)) {
        return (
            <li className="shop-item">
                <h3>{name}</h3>
                <p>{`Costs ${cost}`}</p>
                <button type="button" className="ghost" aria-label={`Buy ${name} for ${cost}`} onClick={() => onBuy(item.id)}>
                    Buy
                </button>
            </li>
        )
    }
    return (
        <li className="shop-item">
            <h3>{name}</h3>
            <p>{`Costs ${cost}. You have ${wallet} ${wallet === 1 ? currency.singular : currency.plural}.`}</p>
            <button type="button" className="ghost" disabled aria-label={`Not enough ${currency.plural} for ${name}`}>
                {`Not enough ${currency.plural}`}
            </button>
        </li>
    )
}

export function ShopScreen({ progression, onBuy, onEquip, onUnequip, onBack }: Props) {
    return (
        <section className="card shop">
            <p className="eyebrow">Shop</p>
            <h1>Spend your currency</h1>
            <p className="lede">Each character spends only its own wallet. Equipped items show on the status screen.</p>
            <div className="stack">
                {ROWS.map((character) => {
                    const currency = CURRENCY[character]
                    const name = CHARACTER_NAMES[character]
                    return (
                        <article key={character} className="status-card" aria-labelledby={`shop-${character}`}>
                            <h2 id={`shop-${character}`}>{name}</h2>
                            <p>{`${currency.wallet}: ${progression.wallets[character]}`}</p>
                            <ul className="shop-list">
                                {itemsFor(character).map((item) => (
                                    <ShopItem
                                        key={item.id}
                                        item={item}
                                        progression={progression}
                                        onBuy={onBuy}
                                        onEquip={onEquip}
                                        onUnequip={onUnequip}
                                    />
                                ))}
                            </ul>
                        </article>
                    )
                })}
            </div>
            <button type="button" className="link" onClick={onBack}>
                Back to status
            </button>
        </section>
    )
}
