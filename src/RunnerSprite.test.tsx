import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RunnerSprite } from './RunnerSprite'
import { nothingWorn } from './cosmetics/catalog'
import { STILL_SCALE } from './cosmetics/art'

describe('RunnerSprite overlays', () => {
    it('uses frame-synchronized run assets at the Status still size', () => {
        const html = renderToStaticMarkup(<RunnerSprite character="shiba" scale={STILL_SCALE} health="obese" equipped={{ ...nothingWorn(), face: 'chase-black-sunglasses', head: 'chase-sushi-hat' }} />)
        expect(html.match(/class="runner-overlay/g)?.length).toBe(2)
        expect(html).toContain('cosmetics/run/chase-black-sunglasses-obese.png')
        expect(html).toContain('cosmetics/run/chase-sushi-hat-obese-status.png')
        expect(html).not.toContain('runner-overlay-sushi-hat')
        expect(html).not.toContain('class="cosmetic-overlay"')
        expect(html).toContain('sprites/shiba-run-obese.png')
    })

    it('draws no overlays without an equipped list, and keeps the aria label', () => {
        const html = renderToStaticMarkup(<RunnerSprite character="shooshy" />)
        expect(html).not.toContain('runner-overlay')
        expect(html).toContain('aria-label="Shooshy running"')
        expect(html).toContain('role="img"')
    })
})
