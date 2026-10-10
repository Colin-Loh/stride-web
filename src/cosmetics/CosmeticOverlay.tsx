import { CHARACTER_SPRITES } from '../sprites'
import { COSMETIC_BY_ID, type CosmeticId } from './catalog'
import { cosmeticUrl, STILL_SCALE } from './art'

/**
 * An equipped item drawn over a still frame. The parent must be position: relative and sized to
 * the still (see .still-frame). Decorative: the item name is listed as text beside the control
 * that equips it, so the image is hidden from assistive technology.
 */
export function CosmeticOverlay({ itemId }: { itemId: CosmeticId }) {
    const { character } = COSMETIC_BY_ID[itemId]
    const frame = CHARACTER_SPRITES[character]
    return (
        <img
            className="cosmetic-overlay"
            src={cosmeticUrl(itemId)}
            width={Math.round(frame.frameWidth * STILL_SCALE)}
            height={Math.round(frame.frameHeight * STILL_SCALE)}
            alt=""
            aria-hidden="true"
        />
    )
}
