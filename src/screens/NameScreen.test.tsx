import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NameScreen } from './NameScreen'

const noop = () => { }

describe('NameScreen', () => {
    it('offers Shiba and Shooshy, with no Cat', () => {
        const html = renderToStaticMarkup(<NameScreen onContinue={noop} />)
        expect(html).toContain('Shiba')
        expect(html).toContain('Shooshy')
        expect(html).not.toMatch(/\bCat\b/)
        expect(html).toContain('aria-label="Shooshy idle"')
    })

    it('asks for an optional weight in kg and prefills a saved one', () => {
        const empty = renderToStaticMarkup(<NameScreen onContinue={noop} />)
        expect(empty).toContain('Body weight in kg (optional)')
        expect(empty).not.toContain('field-error')
        expect(renderToStaticMarkup(<NameScreen initialName="Alex" initialWeightKg={61.5} onContinue={noop} />)).toContain('value="61.5"')
    })

    it('keeps the form valid for a name without weight', () => {
        expect(renderToStaticMarkup(<NameScreen initialName="Alex" onContinue={noop} />)).not.toContain('disabled=""')
    })
})
