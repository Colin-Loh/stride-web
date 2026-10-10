import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NameScreen } from './NameScreen'
import { nameSubmission } from './nameSubmission'

const noop = () => { }

describe('NameScreen', () => {
    it('onboarding mode renders both character buttons and no locked text', () => {
        const html = renderToStaticMarkup(<NameScreen onContinue={noop} />)
        expect(html).toContain('Your runner')
        expect(html).toContain('class="character')
        expect(html).not.toContain('cannot be changed here')
    })

    it('edit mode renders no character buttons and shows the locked character as text', () => {
        const html = renderToStaticMarkup(<NameScreen initialName="Alex" initialCharacter="shooshy" storedCharacter="shiba" onContinue={noop} />)
        expect(html).not.toContain('Your runner')
        expect(html).not.toContain('aria-pressed')
        expect(html).not.toContain('class="character')
        expect(html).toContain('Runner: Chase. The character is chosen at first use and cannot be changed here.')
    })

    it('offers Chase and Shooshy, with no Cat', () => {
        const html = renderToStaticMarkup(<NameScreen onContinue={noop} />)
        expect(html).toContain('Chase')
        expect(html).not.toContain('Shiba')
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

describe('nameSubmission', () => {
    it('onboarding sends the selected character', () => {
        expect(nameSubmission(' Alex ', '', 'shooshy')).toEqual({ name: 'Alex', character: 'shooshy', weightKg: null })
    })

    it('edit mode ignores a different selection and keeps the stored character', () => {
        expect(nameSubmission('Sam', '61,5', 'shooshy', 'shiba')).toEqual({ name: 'Sam', character: 'shiba', weightKg: 61.5 })
    })

    it('refuses a blank name or an out-of-range weight', () => {
        expect(nameSubmission('   ', '', 'shiba')).toBeNull()
        expect(nameSubmission('Alex', '5', 'shiba')).toBeNull()
    })
})

