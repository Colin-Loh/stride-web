import { useRef, useState } from 'react'
import type { Character } from '../domain/preferences'
import type { Progression } from '../domain/types'
import { ShopCurrencyIcon } from './ShopArt'
import { CURRENCY, questLabel, questState } from '../progression/questState'

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
                <span className="quest-text">Collect</span>
                {state.kind === 'ready' && <span className="quest-count" aria-hidden="true">{state.pending}</span>}
                <ShopCurrencyIcon character={character} />
            </button>
            <p className="quest-status" role="status" aria-live="polite">{message}</p>
        </div>
    )
}
