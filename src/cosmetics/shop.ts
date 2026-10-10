import type { Character } from '../domain/preferences'
import type { Progression } from '../domain/types'
import { CHARACTERS, COSMETIC_BY_ID, isCosmeticId, SLOTS, type Slot, type WornSlots } from './catalog'

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
 * Wears an owned cosmetic in its own slot. Only that slot changes: the previous item in the same
 * slot is replaced, and items in other slots stay on. Free and unlimited. Fails when the id is
 * unknown or not owned by its character.
 */
export function equip(progression: Progression, itemId: string): ShopResult {
    if (!isCosmeticId(itemId)) return { progression, ok: false, reason: 'unknown' }
    const item = COSMETIC_BY_ID[itemId]
    if (!progression.inventory[item.character].includes(itemId)) return { progression, ok: false, reason: 'not-owned' }
    return {
        ok: true,
        progression: {
            ...progression,
            equipped: {
                ...progression.equipped,
                [item.character]: { ...progression.equipped[item.character], [item.slot]: itemId },
            },
        },
    }
}

/** Takes off whatever the character wears in one slot. Other slots are kept. Free. Inventory is unchanged. */
export function unequip(progression: Progression, character: Character, slot: Slot): Progression {
    return {
        ...progression,
        equipped: {
            ...progression.equipped,
            [character]: { ...progression.equipped[character], [slot]: null },
        },
    }
}

/**
 * Clears any slot whose id is not in that character's inventory. Every other slot is kept.
 * Returns the same object when nothing needs clearing. Called on load.
 */
export function normalizeEquipped(progression: Progression): Progression {
    let changed = false
    const equipped = { ...progression.equipped }
    for (const character of CHARACTERS) {
        const worn: WornSlots = { ...progression.equipped[character] }
        for (const slot of SLOTS) {
            const id = worn[slot]
            if (id !== null && !progression.inventory[character].includes(id)) {
                worn[slot] = null
                changed = true
            }
        }
        equipped[character] = worn
    }
    return changed ? { ...progression, equipped } : progression
}

/**
 * Drops inventory ids that are not in the catalog, with no refund. Returns the same object when
 * nothing is unknown. Called on load, after the legacy migration.
 */
export function dropUnknownItems(progression: Progression): Progression {
    let changed = false
    const inventory = { ...progression.inventory }
    for (const character of CHARACTERS) {
        const kept = progression.inventory[character].filter((id) => isCosmeticId(id))
        if (kept.length !== progression.inventory[character].length) changed = true
        inventory[character] = kept
    }
    return changed ? { ...progression, inventory } : progression
}
