import type { CSSProperties } from 'react'
import type { Character } from '../domain/preferences'
import type { HealthStatus } from '../progression/health'
import { CHARACTER_SPRITES, OBESE_STILLS } from '../sprites'
import { CosmeticOverlay } from '../cosmetics/CosmeticOverlay'
import { STILL_SCALE } from '../cosmetics/art'
import { isCosmeticId } from '../cosmetics/catalog'

interface Props {
    character: Character
    status: HealthStatus
    equipped: string | null
}

/**
 * The still picture for a character: the obese still when obese, otherwise the first frame of
 * the run sheet, with the equipped item drawn over it. Decorative: the health label beside it
 * carries the meaning, so alt is empty.
 */
export function CharacterStill({ character, status, equipped }: Props) {
    const sprite =
        status === 'obese' ? (
            <img
                className="status-sprite"
                src={OBESE_STILLS[character].url}
                width={Math.round(OBESE_STILLS[character].width * STILL_SCALE)}
                height={Math.round(OBESE_STILLS[character].height * STILL_SCALE)}
                alt=""
            />
        ) : (
            <span
                className="status-sprite status-sprite-run"
                aria-hidden="true"
                style={{
                    backgroundImage: `url(${CHARACTER_SPRITES[character].url})`,
                    backgroundSize: `${CHARACTER_SPRITES[character].frames * 100}% 100%`,
                    backgroundPosition: '0 0',
                    width: `${Math.round(CHARACTER_SPRITES[character].frameWidth * STILL_SCALE)}px`,
                    height: `${Math.round(CHARACTER_SPRITES[character].frameHeight * STILL_SCALE)}px`,
                } as CSSProperties}
            />
        )
    return (
        <div className="still-frame">
            {sprite}
            {isCosmeticId(equipped) && <CosmeticOverlay itemId={equipped} />}
        </div>
    )
}
