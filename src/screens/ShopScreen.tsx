import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { Character } from '../domain/preferences'
import type { Progression } from '../domain/types'
import { itemsFor, nothingWorn, type Cosmetic, type CosmeticId, type Slot } from '../cosmetics/catalog'
import { canAfford } from '../cosmetics/shop'
import { CharacterStill } from '../components/CharacterStill'
import { BrickWall } from '../components/BrickWall'
import { ShopBunting, ShopCrest, ShopCurrencyIcon, ShopDoorIcon, ShopGlint, ShopVine } from '../components/ShopArt'

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
    onUnequip: (character: Character, slot: Slot) => void
}

type ItemState = 'equipped' | 'owned' | 'affordable' | 'unaffordable'

/** Which state an item is in. Equipped wins over owned, and owned wins over affordability. */
function stateOf(progression: Progression, item: Cosmetic): ItemState {
    if (progression.equipped[item.character][item.slot] === item.id) return 'equipped'
    if (progression.inventory[item.character].includes(item.id)) return 'owned'
    return canAfford(progression, item.id) ? 'affordable' : 'unaffordable'
}

/**
 * The entire card is the action; its accessible name retains the item and its state.
 * A buy never happens here: it asks the screen to open the confirm panel.
 */
function ShopItem({ item, progression, onRequestBuy, onEquip, onUnequip }: Omit<Props, 'character' | 'onBack' | 'onBuy'> & { item: Cosmetic; onRequestBuy: (item: Cosmetic, trigger: HTMLButtonElement) => void }) {
    const { character, name, price } = item
    const cost = priceText(character, price)
    const state = stateOf(progression, item)
    const label = state === 'equipped' ? `Unequip ${name}`
        : state === 'owned' ? `Equip ${name}`
            : state === 'affordable' ? `Buy ${name} for ${cost}`
                : `Not enough ${CURRENCY[character].plural} for ${name}`
    const action = state === 'equipped' ? () => onUnequip(character, item.slot)
        : state === 'owned' ? () => onEquip(item.id)
            : (event: { currentTarget: HTMLButtonElement }) => onRequestBuy(item, event.currentTarget)
    const preview = { ...nothingWorn(), [item.slot]: item.id }

    return (
        <li className={`shop-card shop-card-${state}`}>
            <button type="button" className="shop-action" aria-label={label} disabled={state === 'unaffordable'} onClick={action}>
                {(state === 'owned' || state === 'equipped') && <span className="shop-owned-mark" aria-hidden="true">✔</span>}
                <div className="shop-preview" aria-hidden="true">
                    <CharacterStill character={character} status="healthy" equipped={preview} scale={0.5} />
                </div>
                <span className="shop-price" aria-hidden="true">
                    <ShopCurrencyIcon character={character} />
                    {price}
                </span>
            </button>
        </li>
    )
}

/** The balance as a number with its currency word, e.g. "9 bones" or "1 fish". */
const balanceText = (character: Character, count: number) => `${count} ${wordFor(character, count)}`

function CurrencyAmount({ character, count }: { character: Character; count: number }) {
    return (
        <dd className="shop-confirm-amount" aria-label={balanceText(character, count)}>
            <span aria-hidden="true">{count}</span>
            <ShopCurrencyIcon character={character} />
        </dd>
    )
}

export function ShopScreen({ character, progression, onBuy, onEquip, onUnequip }: Props) {
    const count = progression.wallets[character]

    const [fittingOpen, setFittingOpen] = useState(false)
    const fittingButtonRef = useRef<HTMLButtonElement>(null)

    // The purchase waiting for Confirm, and the card button that opened it (focus returns there).
    const [pendingItem, setPendingItem] = useState<Cosmetic | null>(null)
    const triggerRef = useRef<HTMLButtonElement | null>(null)
    const dialogRef = useRef<HTMLDivElement>(null)
    const confirmRef = useRef<HTMLButtonElement>(null)
    const cancelRef = useRef<HTMLButtonElement>(null)
    const confirmTitleId = useId()
    const fittingPanelId = useId()

    const openConfirm = useCallback((item: Cosmetic, trigger: HTMLButtonElement) => {
        triggerRef.current = trigger
        setPendingItem(item)
    }, [])

    /** Hides the confirm panel and hands focus back to the card that opened it. Nothing is bought. */
    const closeConfirm = useCallback(() => {
        setPendingItem(null)
        if (triggerRef.current?.isConnected) triggerRef.current.focus()
    }, [])

    const confirmPurchase = useCallback(() => {
        if (!pendingItem) return
        onBuy(pendingItem.id)
        closeConfirm()
    }, [pendingItem, onBuy, closeConfirm])

    // Opening moves focus into the dialog, so keyboard users land inside it.
    useEffect(() => {
        if (pendingItem) dialogRef.current?.focus()
    }, [pendingItem])

    // While the confirm panel is open, Escape cancels it.
    useEffect(() => {
        if (!pendingItem) return
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeConfirm()
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [pendingItem, closeConfirm])

    /** Keeps Tab inside the two buttons while the dialog is open (aria-modal). */
    const trapTab = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Tab') return
        const active = document.activeElement
        if (event.shiftKey && (active === dialogRef.current || active === confirmRef.current)) {
            event.preventDefault()
            cancelRef.current?.focus()
        } else if (!event.shiftKey && active === cancelRef.current) {
            event.preventDefault()
            confirmRef.current?.focus()
        }
    }

    const closeFitting = useCallback(() => {
        setFittingOpen(false)
        fittingButtonRef.current?.focus()
    }, [])

    useEffect(() => {
        if (!fittingOpen || pendingItem) return
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeFitting()
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [fittingOpen, pendingItem, closeFitting])

    return (
        <section className="card shop">
            <header className="shop-header">
                <BrickWall />
                <ShopVine className="shop-vine shop-vine-left" />
                <ShopVine className="shop-vine shop-vine-right" />
                <ShopGlint className="shop-glint shop-glint-a" />
                <ShopGlint className="shop-glint shop-glint-b" />
                <ShopGlint className="shop-glint shop-glint-c" />
                <div className="shop-marquee">
                    <div className="shop-sign">
                        <ShopCrest />
                        <h1>Store</h1>
                    </div>
                </div>
                <ShopBunting character={character} className="shop-bunting" />
                <p className="shop-balance" aria-label={`${count} ${wordFor(character, count)}`}>
                    <ShopCurrencyIcon character={character} />
                    <span aria-hidden="true">{count}</span>
                </p>
            </header>
            <ul className="shop-grid" aria-label="Accessories">
                {itemsFor(character).map((item) => (
                    <ShopItem key={item.id} item={item} progression={progression} onRequestBuy={openConfirm} onEquip={onEquip} onUnequip={onUnequip} />
                ))}
            </ul>
            {pendingItem && (
                <div className="shop-confirm-scrim">
                    <div
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={confirmTitleId}
                        tabIndex={-1}
                        className="shop-confirm"
                        onKeyDown={trapTab}
                    >
                        <h2 id={confirmTitleId}>Buy {pendingItem.name}?</h2>
                        <dl className="shop-confirm-sums">
                            <div>
                                <dt>Price</dt>
                                <CurrencyAmount character={character} count={pendingItem.price} />
                            </div>
                            <div>
                                <dt>Balance before</dt>
                                <CurrencyAmount character={character} count={count} />
                            </div>
                            <div>
                                <dt>Balance after</dt>
                                <CurrencyAmount character={character} count={count - pendingItem.price} />
                            </div>
                        </dl>
                        <div className="shop-confirm-actions">
                            <button
                                ref={cancelRef}
                                type="button"
                                className="ghost"
                                aria-label={`Cancel purchase of ${pendingItem.name}`}
                                onClick={closeConfirm}
                            >
                                Cancel
                            </button>
                            <button
                                ref={confirmRef}
                                type="button"
                                className="ghost"
                                aria-label={`Confirm purchase of ${pendingItem.name} for ${priceText(character, pendingItem.price)}`}
                                onClick={confirmPurchase}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <button
                ref={fittingButtonRef}
                type="button"
                className="ghost shop-fitting-toggle"
                aria-expanded={fittingOpen}
                aria-controls={fittingPanelId}
                onClick={() => setFittingOpen((open) => !open)}
            >
                <ShopDoorIcon /> Fitting Room
            </button>
            {fittingOpen && (
                <section id={fittingPanelId} className="shop-fitting" aria-label="Fitting room">
                    <ShopBunting character={character} className="shop-fitting-bunting" />
                    <ShopVine className="shop-vine shop-fitting-vine shop-fitting-vine-left" />
                    <ShopVine className="shop-vine shop-fitting-vine shop-fitting-vine-right" />
                    <CharacterStill character={character} status="healthy" equipped={progression.equipped[character]} />
                </section>
            )}
        </section>
    )
}
