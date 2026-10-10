import type { Character } from '../domain/preferences'
import type { Progression } from '../domain/types'
import { daysBetween } from '../plan/dates'
import { localDateOf } from './localDate'

/** Most units a character can hold unclaimed. Days beyond this are forfeited on claim. */
export const BACKLOG_CAP = 14

export interface ClaimResult {
    progression: Progression
    claimed: number
}

/**
 * Units waiting to be claimed for one character: one per local calendar day after the last
 * claim up to and including today, capped at BACKLOG_CAP. Zero when the clock has moved
 * before the last claim or the start date.
 */
export function pendingIncome(progression: Progression, character: Character, today: Date): number {
    const todayIso = localDateOf(today.getTime())
    const lastClaimed = progression.lastClaimedDate[character]
    if (todayIso < lastClaimed || todayIso < progression.startDate) return 0
    const eligibleDays = daysBetween(lastClaimed, todayIso)
    return Math.min(Math.max(eligibleDays, 0), BACKLOG_CAP)
}

/**
 * Adds the pending units to the character's wallet and sets lastClaimedDate to today, so any
 * days beyond the cap are forfeited. Returns the input unchanged with claimed 0 when nothing is
 * pending, so a second claim on the same day does nothing. The caller persists the returned
 * progression in one repository save.
 */
export function claimIncome(progression: Progression, character: Character, today: Date): ClaimResult {
    const claimed = pendingIncome(progression, character, today)
    if (claimed === 0) return { progression, claimed: 0 }

    const todayIso = localDateOf(today.getTime())
    return {
        claimed,
        progression: {
            ...progression,
            updatedAt: today.toISOString(),
            wallets: { ...progression.wallets, [character]: progression.wallets[character] + claimed },
            lastClaimedDate: { ...progression.lastClaimedDate, [character]: todayIso },
        },
    }
}
