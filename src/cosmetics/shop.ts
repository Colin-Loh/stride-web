import type { Character } from '../domain/preferences'
import type { Progression } from '../domain/types'
import { COSMETIC_BY_ID, isCosmeticId } from './catalog'

/** Why a purchase or equip was refused. */
export type ShopFailure = 'unknown' | 'owned' | 'unaffordable' | 'not-owned'

export interface ShopResult {
    /** The new progression on success, or the input progression unchanged on failure. */
    progression: Progression
    ok: boolean
    reason?: ShopFailure
}

/** True when the character's wallet holds at least the item's price. False for unknown ids. */
export function canAfford(progression: Progression, itemId: string): boolean {
    if (!isCosmeticId(itemId)) return false
    const item = COSMETIC_BY_ID[itemId]
    return progression.wallets[item.character] >= item.price
}

/**
 * Buys one cosmetic with its character's currency. Atomic: the wallet and the inventory change
 * together in the returned progression, or nothing changes. Owned items are never bought twice,
 * and no refunds exist. Pure: the input is never mutated.
 */
export function purchase(progression: Progression, itemId: string, now = new Date()): ShopResult {
    if (!isCosmeticId(itemId)) return { progression, ok: false, reason: 'unknown' }
    const item = COSMETIC_BY_ID[itemId]
    if (progression.inventory[item.character].includes(itemId)) return { progression, ok: false, reason: 'owned' }
    if (!canAfford(progression, itemId)) return { progression, ok: false, reason: 'unaffordable' }
    return {
        ok: true,
        progression: {
            ...progression,
            updatedAt: now.toISOString(),
            wallets: { ...progression.wallets, [item.character]: progression.wallets[item.character] - item.price },
            inventory: {
                ...progression.inventory,
                [item.character]: [...progression.inventory[item.character], itemId],
            },
        },
    }
}

/**
 * Wears an owned cosmetic. Equipping a second item for the same character replaces the first.
 * Free and unlimited. Fails when the id is unknown or not owned.
 */
export function equip(progression: Progression, itemId: string): ShopResult {
    if (!isCosmeticId(itemId)) return { progression, ok: false, reason: 'unknown' }
    const item = COSMETIC_BY_ID[itemId]
    if (!progression.inventory[item.character].includes(itemId)) return { progression, ok: false, reason: 'not-owned' }
    return {
        ok: true,
        progression: {
            ...progression,
            equipped: { ...progression.equipped, [item.character]: itemId },
        },
    }
}

/** Takes off whatever the character is wearing. Free and unlimited. Inventory is unchanged. */
export function unequip(progression: Progression, character: Character): Progression {
    return {
        ...progression,
        equipped: { ...progression.equipped, [character]: null },
    }
}

/**
 * Clears any equipped id that is not in that character's inventory. Everything else is kept.
 * Returns the same object when nothing needs clearing. Called on load.
 */
export function normalizeEquipped(progression: Progression): Progression {
    const characters: Character[] = ['shiba', 'shooshy']
    const stale = characters.filter((character) => {
        const id = progression.equipped[character]
        return id !== null && !progression.inventory[character].includes(id)
    })
    if (stale.length === 0) return progression
    const equipped = { ...progression.equipped }
    for (const character of stale) equipped[character] = null
    return { ...progression, equipped }
}
