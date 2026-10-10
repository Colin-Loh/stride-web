import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RunnerSprite } from './RunnerSprite'
import { nothingWorn } from './cosmetics/catalog'

describe('RunnerSprite overlays', () => {
    it('draws one overlay per worn item, with the same frame grid as the body', () => {
        const html = renderToStaticMarkup(<RunnerSprite character="shiba" health="obese" equipped={{ ...nothingWorn(), face: 'chase-black-sunglasses', head: 'chase-sushi-hat' }} />)
        expect(html.match(/runner-overlay/g)?.length).toBe(2)
        expect(html).toContain('cosmetics/run/chase-black-sunglasses-obese.png')
        expect(html).toContain('cosmetics/run/chase-sushi-hat-obese.png')
        expect(html).toContain('sprites/shiba-run-obese.png')
    })

    it('draws no overlays without an equipped list, and keeps the aria label', () => {
        const html = renderToStaticMarkup(<RunnerSprite character="shooshy" />)
        expect(html).not.toContain('runner-overlay')
        expect(html).toContain('aria-label="Shooshy running"')
        expect(html).toContain('role="img"')
    })
})
