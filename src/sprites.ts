import type { Character } from './domain/preferences'

export interface SpriteSheet {
    url: string
    frames: number
    frameWidth: number
    frameHeight: number
    cycleSeconds: number
}

const sprite = (file: string) => `${import.meta.env.BASE_URL}sprites/${file}`

/** Each sheet is one horizontal strip of equal-width frames, measured from the PNG files. */
export const CHARACTER_SPRITES: Record<Character, SpriteSheet> = {
    shiba: { url: sprite('shiba-run.png'), frames: 7, frameWidth: 296, frameHeight: 222, cycleSeconds: 0.55 },
    shooshy: { url: sprite('shooshy-run.png'), frames: 8, frameWidth: 236, frameHeight: 196, cycleSeconds: 0.55 },
}

/** The celebration dance: 12 frames at 90 ms each (output/sprites/sprites.json). */
export const DANCE_SPRITES: Record<Character, SpriteSheet> = {
    shiba: { url: sprite('shiba-dance.png'), frames: 12, frameWidth: 296, frameHeight: 222, cycleSeconds: 1.08 },
    shooshy: { url: sprite('shooshy-dance.png'), frames: 12, frameWidth: 236, frameHeight: 196, cycleSeconds: 1.08 },
}

/** Dance frame (zero-based) shown still: the top of the hop with its sparkle. */
export const DANCE_STILL_FRAME = 3

/** How long the complete screen dances before settling on the still frame. */
export const DANCE_PLAY_SECONDS = 2.5
