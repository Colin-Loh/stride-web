import type { Character } from '../domain/preferences'
import type { RunnerHealth } from '../RunnerSprite'
import { CHARACTER_SPRITES, OBESE_RUN_SHEETS, type SpriteSheet } from '../sprites'
import { SLOTS, type WornSlots } from './catalog'

/**
 * Items that have run-sheet art, with the character each one is drawn on. Keyed by item id
 * rather than read from the catalog so the art lookup does not depend on which items are sold.
 */
const RUN_OVERLAY_OWNERS: Readonly<Record<string, Character>> = Object.freeze({
    'chase-black-sunglasses': 'shiba',
    'chase-sushi-hat': 'shiba',
    'shooshy-black-sunglasses': 'shooshy',
    'shooshy-sushi-hat': 'shooshy',
})

/** Public URL of one item's run overlay for one health state. */
const runOverlayUrl = (itemId: string, health: RunnerHealth): string =>
    `${import.meta.env.BASE_URL}cosmetics/run/${itemId}-${health}.png`

/**
 * The run overlay sheet for an item in a health state, or null when the item has no run art.
 * The overlay copies its character's body sheet for frame count, frame size and cycle, so both
 * sheets step through the same frame at the same moment.
 */
export function runOverlaySheet(itemId: string, health: RunnerHealth): SpriteSheet | null {
    const character = Object.prototype.hasOwnProperty.call(RUN_OVERLAY_OWNERS, itemId)
        ? RUN_OVERLAY_OWNERS[itemId]
        : undefined
    if (character === undefined) return null
    const body = health === 'obese' ? OBESE_RUN_SHEETS[character] : CHARACTER_SPRITES[character]
    return { ...body, url: runOverlayUrl(itemId, health) }
}

/**
 * Overlay URLs for every equipped item that has run art in the given health state, in slot order
 * (face, head, body). Empty slots and unknown ids select nothing.
 */
export function overlayUrls(equipped: WornSlots, health: RunnerHealth): string[] {
    const urls: string[] = []
    for (const slot of SLOTS) {
        const itemId = equipped[slot]
        if (itemId === null) continue
        const sheet = runOverlaySheet(itemId, health)
        if (sheet) urls.push(sheet.url)
    }
    return urls
}
