import type { RunnerHealth } from '../RunnerSprite'
import type { CosmeticId, WornSlots } from './catalog'
import { isCosmeticId, SLOTS } from './catalog'

export interface RunOverlay {
    itemId: CosmeticId
    url: string
}

/** Run-sheet overlays advance in lockstep with the character's body frames. */
export function overlayItems(equipped: WornSlots, health: RunnerHealth): RunOverlay[] {
    const overlays: RunOverlay[] = []
    for (const slot of SLOTS) {
        const itemId = equipped[slot]
        if (!isCosmeticId(itemId)) continue
        const assetName = itemId.endsWith('-sushi-hat') ? `${itemId}-${health}-status.png` : `${itemId}-${health}.png`
        overlays.push({
            itemId,
            url: `${import.meta.env.BASE_URL}cosmetics/run/${assetName}`,
        })
    }
    return overlays
}