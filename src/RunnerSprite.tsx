import type { CSSProperties } from 'react'
import { CHARACTER_SPRITES } from './sprites'
import { CHARACTER_NAMES, type Character } from './domain/preferences'

export type RunnerState = 'running' | 'idle'

/** The speed at which a sheet's own cycleSeconds applies. */
const BASE_KMH = 7
const MIN_CYCLE_SECONDS = 0.25
const MAX_CYCLE_SECONDS = 0.9

interface Props {
    character: Character
    state?: RunnerState
    /** Fraction of the sheet's native frame size. 0.5 keeps frame edges on whole pixels. */
    scale?: number
    /** Treadmill speed; faster running turns the legs over quicker. */
    speedKmh?: number
    /** Overrides the computed cadence outright. */
    cycleSeconds?: number
    className?: string
}

export function RunnerSprite({
    character,
    state = 'running',
    scale = 0.5,
    speedKmh,
    cycleSeconds,
    className,
}: Props) {
    const sheet = CHARACTER_SPRITES[character]
    // Stride frequency scales with speed, so the cycle is inversely proportional.
    const paced = sheet.cycleSeconds * (BASE_KMH / (speedKmh ?? BASE_KMH))
    const duration =
        cycleSeconds ??
        Math.min(MAX_CYCLE_SECONDS, Math.max(MIN_CYCLE_SECONDS, paced))

    const style = {
        backgroundImage: `url(${sheet.url})`,
        backgroundSize: `${sheet.frames * 100}% 100%`,
        width: `${Math.round(sheet.frameWidth * scale)}px`,
        height: `${Math.round(sheet.frameHeight * scale)}px`,
        animationDuration: `${duration.toFixed(3)}s`,
        animationTimingFunction: `steps(${sheet.frames})`,
        // 100% aligns the LAST frame, so the steps must run past it to cover them all.
        '--run-end': `${(sheet.frames * 100) / (sheet.frames - 1)}%`,
    } as CSSProperties

    return (
        <span
            className={className ? `runner ${className}` : 'runner'}
            role="img"
            aria-label={`${CHARACTER_NAMES[character]} ${state}`}
            data-state={state}
            style={style}
        />
    )
}
