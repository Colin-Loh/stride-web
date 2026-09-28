import type { Character } from './storage'

interface SpriteSheet {
    url: string
    frames: number
    frameWidth: number
    frameHeight: number
}

/** Each sheet is one horizontal strip of equal-width frames. */
export const CHARACTER_SPRITES: Record<Character, SpriteSheet> = {
    boy: {
        url: `${import.meta.env.BASE_URL}sprites/boy-running-8frames.png`,
        frames: 10,
        frameWidth: 236,
        frameHeight: 286,
    },
    girl: {
        url: `${import.meta.env.BASE_URL}sprites/girl-running-8frames.png`,
        frames: 8,
        frameWidth: 244,
        frameHeight: 280,
    },
}
