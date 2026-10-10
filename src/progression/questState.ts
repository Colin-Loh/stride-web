import type { Character } from '../domain/preferences'
import type { Progression } from '../domain/types'
import { localDateOf } from './localDate'
import { pendingIncome } from './income'

/** The currency each character earns, singular and plural. Only the selected character's currency is shown. */
export const CURRENCY: Record<Character, { singular: string; plural: string }> = {
    shiba: { singular: 'bone', plural: 'bones' },
    shooshy: { singular: 'fish', plural: 'fish' },
}

/** What the quest offers right now for one character. */
export type QuestState =
    | { kind: 'ready'; pending: number }
    | { kind: 'claimed' }
    | { kind: 'nothing' }

/**
 * Ready when units are pending. Claimed when today's units were already collected after the
 * first day. Otherwise nothing is due yet. The first day has no units to collect, so a claim
 * made on it is not shown as "done", which is why the start date is checked.
 */
export function questState(progression: Progression, character: Character, now: Date): QuestState {
    const pending = pendingIncome(progression, character, now)
    if (pending > 0) return { kind: 'ready', pending }
    const today = localDateOf(now.getTime())
    if (progression.lastClaimedDate[character] === today && progression.startDate < today) return { kind: 'claimed' }
    return { kind: 'nothing' }
}

/** The accessible name of the quest button for a state. */
export function questLabel(state: QuestState, character: Character): string {
    const currency = CURRENCY[character]
    if (state.kind === 'ready') {
        const word = state.pending === 1 ? currency.singular : currency.plural
        return `Quest: collect ${state.pending} ${word}`
    }
    if (state.kind === 'claimed') return 'Quest done today'
    return 'Quest: nothing to collect yet'
}
