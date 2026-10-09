import type { CSSProperties } from 'react'
import { CHARACTER_NAMES, type Character } from './domain/preferences'
import { DANCE_PLAY_SECONDS, DANCE_SPRITES, DANCE_STILL_FRAME } from './sprites'

interface Props {
    character: Character
    /** Fraction of the sheet's native frame size. 0.5 keeps frame edges on whole pixels. */
    scale?: number
    className?: string
}

/**
 * The celebration dance, played for about DANCE_PLAY_SECONDS and then held on the still frame.
 * With prefers-reduced-motion the stylesheet never animates it, so the still frame is all there is.
 */
export function DanceSprite({ character, scale = 0.5, className }: Props) {
    const sheet = DANCE_SPRITES[character]
    const cycles = Math.max(1, Math.round(DANCE_PLAY_SECONDS / sheet.cycleSeconds))
    const style = {
        backgroundImage: `url(${sheet.url})`,
        backgroundSize: `${sheet.frames * 100}% 100%`,
        width: `${Math.round(sheet.frameWidth * scale)}px`,
        height: `${Math.round(sheet.frameHeight * scale)}px`,
        animationDuration: `${sheet.cycleSeconds}s`,
        animationTimingFunction: `steps(${sheet.frames})`,
        animationIterationCount: cycles,
        // The last frame sits at 100%, so the steps run past it to show them all.
        '--run-end': `${(sheet.frames * 100) / (sheet.frames - 1)}%`,
        '--still-x': `${(DANCE_STILL_FRAME * 100) / (sheet.frames - 1)}%`,
    } as CSSProperties
    return (
        <span
            className={className ? `runner dance ${className}` : 'runner dance'}
            role="img"
            aria-label={`${CHARACTER_NAMES[character]} celebrating`}
            data-state="running"
            style={style}
        />
    )
}
