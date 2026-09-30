import type { Character } from './storage'

interface SpriteSheet {
    url: string
    frames: number
    frameWidth: number
    frameHeight: number
    cycleSeconds: number
}

/** Each sheet is one horizontal strip of equal-width frames. */
export const CHARACTER_SPRITES: Record<Character, SpriteSheet> = {
    shiba: {
        url: `${import.meta.env.BASE_URL}sprites/shiba-run.png`,
        frames: 7,
        frameWidth: 290,
        frameHeight: 222,
        cycleSeconds: 0.55,
    },
    cat: {
        url: `${import.meta.env.BASE_URL}sprites/cat-run.png`,
        frames: 8,
        frameWidth: 290,
        frameHeight: 222,
        cycleSeconds: 0.55,
    },
}
