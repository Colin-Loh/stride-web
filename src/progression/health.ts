import { CHARACTER_NAMES, type Character } from '../domain/preferences'
import type { CompletedRun, PerCharacter } from '../domain/types'
import { localDateOf } from './localDate'

/** A run counts toward health only if its active time reaches this many milliseconds. */
export const MIN_QUALIFYING_ELAPSED_MS = 300_000

/** Number of local calendar days in the rolling window, today included. */
export const HEALTH_WINDOW_DAYS = 7

export type HealthStatus = 'healthy' | 'obese'

export interface CharacterHealth {
    characterId: Character
    status: HealthStatus
    label: string
    /** Informational only: qualifying plan sessions completed in the window. Does not affect status. */
    planSessionsInWindow: number
}

const isQualifying = (run: CompletedRun): boolean => run.elapsedMs >= MIN_QUALIFYING_ELAPSED_MS

/**
 * Derives each character's health from the run log, on every call. Nothing is stored.
 *
 * Both characters start obese. A character is healthy while at least one qualifying run
 * credited to it falls on a local calendar day in the rolling window today-6 .. today.
 * Runs credited to the other character never count. `now` is a parameter so the result is
 * deterministic; this function never reads the clock itself.
 */
export function deriveHealth(runs: readonly CompletedRun[], now: Date): PerCharacter<CharacterHealth> {
    const today = localDateOf(now.getTime())
    const windowStart = localDateOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (HEALTH_WINDOW_DAYS - 1)).getTime())
    const inWindow = (run: CompletedRun) => {
        const day = localDateOf(run.completedAt)
        return day >= windowStart && day <= today
    }
    const recent = runs.filter((run) => isQualifying(run) && inWindow(run))

    const forCharacter = (characterId: Character): CharacterHealth => {
        const mine = recent.filter((run) => run.characterId === characterId)
        const status: HealthStatus = mine.length > 0 ? 'healthy' : 'obese'
        const name = CHARACTER_NAMES[characterId]
        return {
            characterId,
            status,
            label: status === 'healthy' ? `${name} is very healthy` : `${name} is obese`,
            planSessionsInWindow: mine.filter((run) => run.planSessionId !== null).length,
        }
    }

    return { shiba: forCharacter('shiba'), shooshy: forCharacter('shooshy') }
}
