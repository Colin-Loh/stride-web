import type { Character } from '../domain/preferences'
import type { PerCharacter, Progression, StoredEquipped, StoredProgression } from '../domain/types'
import { CHARACTERS, nothingWorn, SLOTS, type WornSlots } from './catalog'

/**
 * The six accessories that were removed from the shop. This file is the only place their ids
 * appear. They are used by the one-time refund migration and nowhere else.
 */

/** Grant marker for the one-time refund. Once it is in grantsApplied, the refund never runs again. */
export const LEGACY_MIGRATION_ID = 'refund-legacy-accessories-v1'

export interface LegacyItem {
    id: string
    character: Character
    /** The price paid, refunded in full by the migration. */
    price: number
}

export const LEGACY_ITEMS: readonly LegacyItem[] = [
    { id: 'chase-bandana', character: 'shiba', price: 1 },
    { id: 'chase-sunglasses', character: 'shiba', price: 3 },
    { id: 'chase-medal', character: 'shiba', price: 5 },
    { id: 'shooshy-ribbon', character: 'shooshy', price: 1 },
    { id: 'shooshy-scarf', character: 'shooshy', price: 3 },
    { id: 'shooshy-headband', character: 'shooshy', price: 5 },
]

const LEGACY_PRICE: ReadonlyMap<string, number> = new Map(LEGACY_ITEMS.map((item) => [item.id, item.price]))

const isLegacy = (id: string | null | undefined): id is string => typeof id === 'string' && LEGACY_PRICE.has(id)

/**
 * Converts the stored equipped value to the slot shape. A legacy value (one id or null per
 * character) becomes all-null slots. A slot record keeps every slot it has and fills the rest with null.
 */
export function toSlotEquipped(stored: StoredProgression['equipped']): PerCharacter<WornSlots> {
    const convert = (value: StoredEquipped | string | null): WornSlots => {
        if (typeof value !== 'object' || value === null) return nothingWorn()
        return { face: value.face ?? null, head: value.head ?? null, body: value.body ?? null }
    }
    return { shiba: convert(stored.shiba), shooshy: convert(stored.shooshy) }
}

/**
 * Refunds every owned legacy accessory to its owner's wallet, removes it from the inventory,
 * clears it from any slot, and records the marker. Runs once per profile: a progression that
 * already has the marker is returned unchanged. Pure: the input is never mutated.
 */
export function migrateLegacyAccessories(progression: Progression, now: Date): Progression {
    if (progression.grantsApplied.includes(LEGACY_MIGRATION_ID)) return progression
    const wallets = { ...progression.wallets }
    const inventory = { ...progression.inventory }
    const equipped = { ...progression.equipped }
    for (const character of CHARACTERS) {
        const owned = progression.inventory[character]
        for (const id of owned) {
            if (isLegacy(id)) wallets[character] += LEGACY_PRICE.get(id) ?? 0
        }
        inventory[character] = owned.filter((id) => !isLegacy(id))
        const worn = { ...progression.equipped[character] }
        for (const slot of SLOTS) {
            if (isLegacy(worn[slot])) worn[slot] = null
        }
        equipped[character] = worn
    }
    return {
        ...progression,
        updatedAt: now.toISOString(),
        wallets,
        inventory,
        equipped,
        grantsApplied: [...progression.grantsApplied, LEGACY_MIGRATION_ID],
    }
}
