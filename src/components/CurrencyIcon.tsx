import type { Character } from '../domain/preferences'

/** Small glyph for each currency, drawn in code. Decorative: the word beside it names it. */
export function CurrencyIcon({ character }: { character: Character }) {
    if (character === 'shiba') {
        return (
            <svg className="home-currency-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <g fill="currentColor">
                    <circle cx="5" cy="8" r="3" />
                    <circle cx="5" cy="16" r="3" />
                    <circle cx="19" cy="8" r="3" />
                    <circle cx="19" cy="16" r="3" />
                    <rect x="5" y="10" width="14" height="4" rx="2" />
                </g>
            </svg>
        )
    }
    return (
        <svg className="home-currency-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path fill="currentColor" d="M2 12 L6 8 L6 16 Z" />
            <ellipse cx="14" cy="12" rx="8" ry="5" fill="currentColor" />
        </svg>
    )
}
