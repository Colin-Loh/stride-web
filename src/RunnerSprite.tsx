import type { CSSProperties } from 'react'
import { CHARACTER_SPRITES } from './sprites'
import type { Character } from './storage'

export type RunnerState = 'running' | 'idle'

interface Props {
    character: Character
    state?: RunnerState
    /** Fraction of the sheet's native frame size. 0.5 keeps frame edges on whole pixels. */
    scale?: number
    /** Seconds for one full 8-frame cycle. */
    cycleSeconds?: number
    className?: string
}

export function RunnerSprite({
    character,
    state = 'running',
    scale = 0.5,
    cycleSeconds = 0.65,
    className,
}: Props) {
    const sheet = CHARACTER_SPRITES[character]
    const style: CSSProperties = {
        backgroundImage: `url(${sheet.url})`,
        backgroundSize: `${sheet.frames * 100}% 100%`,
        width: `${Math.round(sheet.frameWidth * scale)}px`,
        height: `${Math.round(sheet.frameHeight * scale)}px`,
        animationDuration: `${cycleSeconds}s`,
    }

    return (
        <span
            className={className ? `runner ${className}` : 'runner'}
            role="img"
            aria-label={`${character} ${state}`}
            data-state={state}
            style={style}
        />
    )
}
