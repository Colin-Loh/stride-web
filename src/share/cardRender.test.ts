import { describe, expect, it } from 'vitest'
import { DANCE_SPRITES, DANCE_STILL_FRAME } from '../sprites'
import { drawCard, type CardSprite } from './cardRender'
import type { CardItem } from './cardLayout'

/** Records the calls drawCard makes, standing in for a canvas. */
function recorder() {
    const calls: string[] = []
    const ctx = {
        fillStyle: '', font: '', textAlign: '', textBaseline: '', imageSmoothingEnabled: true,
        beginPath: () => calls.push('beginPath'),
        roundRect: (...args: unknown[]) => calls.push(`roundRect ${JSON.stringify(args)}`),
        arc: (...args: unknown[]) => calls.push(`arc ${args.slice(0, 3).join(',')}`),
        fill: () => calls.push(`fill ${ctx.fillStyle}`),
        fillText: (text: string, x: number, y: number) => calls.push(`fillText ${text} ${x} ${y} [${ctx.font}] ${ctx.fillStyle}`),
        measureText: () => ({ width: 100 }),
        drawImage: (...args: unknown[]) => calls.push(`drawImage ${args.slice(1).join(',')} smoothing=${ctx.imageSmoothingEnabled}`),
    }
    return { calls, ctx: ctx as unknown as CanvasRenderingContext2D }
}

describe('drawCard', () => {
    const items: CardItem[] = [
        { kind: 'rect', x: 0, y: 0, width: 1080, height: 1350, fill: '#101a24', decor: true },
        { kind: 'circle', x: 920, y: 250, radius: 310, fill: '#19342f', decor: true },
        { kind: 'text', x: 80, y: 130, text: 'stride', size: 48, weight: 800, fill: '#fff', suffix: { text: '.', size: 48, fill: '#81e8c2' } },
        { kind: 'character', x: 620, y: 360, width: 380, height: 300 },
    ]

    it('paints shapes and text, with the suffix right after the measured text in its own colour', () => {
        const { calls, ctx } = recorder()
        drawCard(ctx, items, null)
        expect(calls).toContain('roundRect [0,0,1080,1350,0]')
        expect(calls).toContain('arc 920,250,310')
        expect(calls).toContain('fillText stride 80 130 [800 48px system-ui, "Segoe UI", sans-serif] #fff')
        expect(calls).toContain('fillText . 180 130 [800 48px system-ui, "Segoe UI", sans-serif] #81e8c2')
        expect(calls.some((call) => call.startsWith('drawImage'))).toBe(false)
    })

    it('draws the still dance frame from the sheet, scaled to fit without smoothing', () => {
        const sheet = DANCE_SPRITES.shooshy
        const sprite: CardSprite = { image: {} as CanvasImageSource, sheet, frame: DANCE_STILL_FRAME }
        const { calls, ctx } = recorder()
        drawCard(ctx, items, sprite)
        const scale = Math.min(380 / 236, 300 / 196)
        const w = 236 * scale
        const h = 196 * scale
        expect(calls).toContain(`drawImage ${DANCE_STILL_FRAME * 236},0,236,196,${620 + (380 - w) / 2},${360 + (300 - h) / 2},${w},${h} smoothing=false`)
    })
})
