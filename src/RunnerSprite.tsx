import type { CSSProperties } from 'react'
import { CHARACTER_SPRITES, OBESE_RUN_SHEETS } from './sprites'
import { CHARACTER_NAMES, type Character } from './domain/preferences'
import type { WornSlots } from './cosmetics/catalog'
import { overlayUrls } from './cosmetics/runOverlay'

export type RunnerState = 'running' | 'idle'
export type RunnerHealth = 'healthy' | 'obese'

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
    /** Selects the obese run sheet. Healthy is the default. */
    health?: RunnerHealth
    /** The items worn in each slot. Each one with run art is drawn over the body sheet. */
    equipped?: WornSlots
    className?: string
}

export function RunnerSprite({
    character,
    state = 'running',
    scale = 0.5,
    speedKmh,
    cycleSeconds,
    health = 'healthy',
    equipped,
    className,
}: Props) {
    const sheet = health === 'obese' ? OBESE_RUN_SHEETS[character] : CHARACTER_SPRITES[character]
    // Overlays copy the body sheet's frame grid and timing, so each one stays on the same frame.
    const overlays = equipped ? overlayUrls(equipped, health) : []
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
        >
            {overlays.map((url) => (
                <span
                    key={url}
                    className="runner-overlay"
                    aria-hidden="true"
                    style={{
                        ...style,
                        backgroundImage: `url(${url})`,
                    }}
                />
            ))}
        </span>
    )
}
