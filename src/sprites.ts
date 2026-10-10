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

/** The run cycle for an obese character, same timing as the healthy sheets. */
export const OBESE_RUN_SHEETS: Record<Character, SpriteSheet> = {
    shiba: { url: sprite('shiba-run-obese.png'), frames: 7, frameWidth: 296, frameHeight: 222, cycleSeconds: 0.55 },
    shooshy: { url: sprite('shooshy-run-obese.png'), frames: 8, frameWidth: 236, frameHeight: 196, cycleSeconds: 0.55 },
}

/** A single still image, at its native frame size. */
export interface StillImage {
    url: string
    width: number
    height: number
}

/** The obese still for each character, shown on the status screen when the character is obese. */
export const OBESE_STILLS: Record<Character, StillImage> = {
    shiba: { url: sprite('shiba-obese.png'), width: 296, height: 222 },
    shooshy: { url: sprite('shooshy-obese.png'), width: 236, height: 196 },
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
