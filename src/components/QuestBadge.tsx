import { useRef, useState } from 'react'
import type { Character } from '../domain/preferences'
import type { Progression } from '../domain/types'
import { CURRENCY, questLabel, questState } from '../progression/questState'

/** Drawn in code in the app's palette. Decorative: the button's label names it. */
function QuestIcon() {
    return (
        <svg className="quest-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <rect x="6" y="4" width="12" height="16" rx="2" fill="currentColor" />
            <circle cx="6" cy="12" r="2.5" fill="currentColor" />
            <circle cx="18" cy="12" r="2.5" fill="currentColor" />
            <path d="M9 9 H15 M9 12 H15 M9 15 H13" stroke="#0c241c" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    )
}

interface Props {
    progression: Progression
    character: Character
    now: Date
    /** Claims the character's pending units. Resolves with the number collected, 0 when nothing was pending. */
    onCollect: (character: Character) => Promise<number>
}

/**
 * The quest button on the home screen. It shows whether today's units are ready and claims
 * them on activation. Focus stays on the button after a claim, so it uses aria-disabled
 * rather than the disabled attribute, which would drop focus.
 */
export function QuestBadge({ progression, character, now, onCollect }: Props) {
    const state = questState(progression, character, now)
    const [claiming, setClaiming] = useState(false)
    const [message, setMessage] = useState('')
    // A ref, not state, so a second activation before the re-render is still ignored.
    const inFlight = useRef(false)
    const blocked = state.kind !== 'ready' || claiming
    const currency = CURRENCY[character]

    async function activate() {
        if (blocked || inFlight.current) return
        inFlight.current = true
        setClaiming(true)
        try {
            const collected = await onCollect(character)
            if (collected > 0) setMessage(`Collected ${collected} ${collected === 1 ? currency.singular : currency.plural}`)
        } catch {
            // The flow already shows the unsaved-progress notice, so nothing more is added here.
        } finally {
            inFlight.current = false
            setClaiming(false)
        }
    }

    const className = blocked ? 'quest-button is-disabled' : 'quest-button'

    return (
        <div className="quest-panel">
            <button
                type="button"
                className={className}
                aria-label={questLabel(state, character)}
                aria-disabled={blocked}
                onClick={() => void activate()}
            >
                <QuestIcon />
                <span className="quest-text">Quest</span>
                {state.kind === 'ready' && <span className="quest-count" aria-hidden="true">{state.pending}</span>}
            </button>
            <p className="quest-status" role="status" aria-live="polite">{message}</p>
            <p className="quest-note">Up to 14 days can be collected. Older days are not kept.</p>
        </div>
    )
}
