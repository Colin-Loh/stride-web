import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { nothingWorn, type WornSlots } from './catalog'
import { overlayUrls, runOverlaySheet } from './runOverlay'
import { CHARACTER_SPRITES, OBESE_RUN_SHEETS } from '../sprites'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const pngSize = (relative: string) => {
    const bytes = readFileSync(`${ROOT}public/${relative}`)
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}
const worn = (partial: Partial<WornSlots>): WornSlots => ({ ...nothingWorn(), ...partial })

describe('runOverlaySheet', () => {
    it.each([
        ['chase-black-sunglasses', 'healthy', 'cosmetics/run/chase-black-sunglasses-healthy.png'],
        ['chase-black-sunglasses', 'obese', 'cosmetics/run/chase-black-sunglasses-obese.png'],
        ['chase-sushi-hat', 'healthy', 'cosmetics/run/chase-sushi-hat-healthy.png'],
        ['chase-sushi-hat', 'obese', 'cosmetics/run/chase-sushi-hat-obese.png'],
        ['shooshy-black-sunglasses', 'healthy', 'cosmetics/run/shooshy-black-sunglasses-healthy.png'],
        ['shooshy-black-sunglasses', 'obese', 'cosmetics/run/shooshy-black-sunglasses-obese.png'],
        ['shooshy-sushi-hat', 'healthy', 'cosmetics/run/shooshy-sushi-hat-healthy.png'],
        ['shooshy-sushi-hat', 'obese', 'cosmetics/run/shooshy-sushi-hat-obese.png'],
    ] as const)('%s selects its %s sheet', (itemId, health, file) => {
        expect(runOverlaySheet(itemId, health)?.url).toContain(file)
    })

    it('selects nothing for an unknown id or the removed hotdog items', () => {
        for (const id of ['chase-hotdog', 'shooshy-hotdog', 'made-up-item', '']) {
            expect(runOverlaySheet(id, 'healthy')).toBeNull()
            expect(runOverlaySheet(id, 'obese')).toBeNull()
        }
    })

    it('uses the same frame grid and cycle as its body sheet', () => {
        for (const [itemId, character] of [
            ['chase-sushi-hat', 'shiba'],
            ['chase-black-sunglasses', 'shiba'],
            ['shooshy-sushi-hat', 'shooshy'],
            ['shooshy-black-sunglasses', 'shooshy'],
        ] as const) {
            for (const health of ['healthy', 'obese'] as const) {
                const body = health === 'obese' ? OBESE_RUN_SHEETS[character] : CHARACTER_SPRITES[character]
                const overlay = runOverlaySheet(itemId, health)
                expect(overlay).toMatchObject({
                    frames: body.frames,
                    frameWidth: body.frameWidth,
                    frameHeight: body.frameHeight,
                    cycleSeconds: body.cycleSeconds,
                })
            }
        }
    })

    it('has an art file whose size matches the body sheet frame grid', () => {
        for (const itemId of ['chase-sushi-hat', 'chase-black-sunglasses', 'shooshy-sushi-hat', 'shooshy-black-sunglasses']) {
            for (const health of ['healthy', 'obese'] as const) {
                const overlay = runOverlaySheet(itemId, health)
                if (!overlay) throw new Error(`no overlay for ${itemId} ${health}`)
                const file = overlay.url.split('/').slice(-3).join('/')
                expect(existsSync(`${ROOT}public/${file}`)).toBe(true)
                expect(pngSize(file)).toEqual({ width: overlay.frames * overlay.frameWidth, height: overlay.frameHeight })
            }
        }
    })
})

describe('overlayUrls', () => {
    it('returns nothing when nothing is worn', () => {
        expect(overlayUrls(nothingWorn(), 'healthy')).toEqual([])
        expect(overlayUrls(nothingWorn(), 'obese')).toEqual([])
    })

    it('returns one overlay per worn slot, in the chosen health', () => {
        const equipped = worn({ face: 'chase-black-sunglasses', head: 'chase-sushi-hat' })
        expect(overlayUrls(equipped, 'healthy')).toEqual([
            runOverlaySheet('chase-black-sunglasses', 'healthy')?.url,
            runOverlaySheet('chase-sushi-hat', 'healthy')?.url,
        ])
        expect(overlayUrls(equipped, 'obese')).toEqual([
            runOverlaySheet('chase-black-sunglasses', 'obese')?.url,
            runOverlaySheet('chase-sushi-hat', 'obese')?.url,
        ])
    })

    it('skips an id with no run art', () => {
        expect(overlayUrls(worn({ head: 'chase-hotdog' as never }), 'healthy')).toEqual([])
    })
})
