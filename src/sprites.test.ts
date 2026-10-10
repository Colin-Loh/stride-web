import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CHARACTER_SPRITES, OBESE_RUN_SHEETS, type SpriteSheet } from './sprites'

/** Reads width and height from the IHDR chunk, which always sits at bytes 16 to 24 of a PNG. */
function pngSize(file: string): { width: number; height: number } {
    const bytes = readFileSync(fileURLToPath(new URL(`../public/sprites/${file}`, import.meta.url)))
    expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG')
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

const sheetFile = (sheet: SpriteSheet) => sheet.url.split('/').pop() ?? ''

describe('run sprite sheets', () => {
    it.each([
        ['healthy', CHARACTER_SPRITES],
        ['obese', OBESE_RUN_SHEETS],
    ])('%s sheets match their declared frame grid', (_health, sheets) => {
        for (const [character, sheet] of Object.entries(sheets)) {
            const file = sheetFile(sheet)
            const { width, height } = pngSize(file)
            expect({ character, file, width, height }).toEqual({
                character,
                file,
                width: sheet.frames * sheet.frameWidth,
                height: sheet.frameHeight,
            })
        }
    })
})
