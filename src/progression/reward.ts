import type { Character } from '../domain/preferences'
import { SCHEMA_VERSION, type CompletedRun, type Progression, type RunSession } from '../domain/types'
import type { Repositories } from '../storage/repository'

/** Active running time a finished run needs to earn a reward and enter the run log. */
export const QUALIFYING_RUN_MS = 300_000

/** Sessions saved before the character was recorded have no characterId. They credit the default character. */
const LEGACY_CHARACTER: Character = 'shiba'

export function isQualifyingRun(run: RunSession): boolean {
    return run.completed && run.result !== undefined && run.result.elapsedMs >= QUALIFYING_RUN_MS
}

/**
 * Credits one unit to the run's character and records the run id, so the same run never pays twice.
 * Pure: returns a new progression and leaves the input untouched.
 */
export function awardRunReward(
    progression: Progression,
    run: Pick<CompletedRun, 'id' | 'characterId'>,
    now = new Date(),
): { progression: Progression; awarded: boolean } {
    if (progression.rewardedRunIds.includes(run.id)) return { progression, awarded: false }
    return {
        awarded: true,
        progression: {
            ...progression,
            wallets: { ...progression.wallets, [run.characterId]: progression.wallets[run.characterId] + 1 },
            rewardedRunIds: [...progression.rewardedRunIds, run.id],
            updatedAt: now.toISOString(),
        },
    }
}

/** The run log entry for a qualifying session, or null when the session does not qualify. */
export function completedRunFromSession(session: RunSession, now = new Date()): CompletedRun | null {
    if (!isQualifyingRun(session) || !session.result) return null
    const stamp = now.toISOString()
    return {
        id: session.id,
        schemaVersion: SCHEMA_VERSION,
        createdAt: stamp,
        updatedAt: stamp,
        characterId: session.characterId ?? LEGACY_CHARACTER,
        workoutId: session.workoutId,
        planSessionId: session.planSessionId ?? null,
        completedAt: stamp,
        elapsedMs: session.result.elapsedMs,
        distanceKm: session.result.distanceKm,
    }
}

/**
 * Records a finished run. Order matters: the progression is saved first, then the run log entry.
 * Safe to repeat: a run id already in rewardedRunIds pays nothing, and a run log entry already
 * present is not rewritten. If the first attempt stopped between the two writes, a repeat adds
 * the missing run log entry without a second unit.
 */
export async function recordCompletedRun(
    repositories: Pick<Repositories, 'progression' | 'completedRuns'>,
    session: RunSession,
    now = new Date(),
): Promise<{ awarded: boolean }> {
    const run = completedRunFromSession(session, now)
    if (!run) return { awarded: false }
    const current = await repositories.progression.load()
    const { progression, awarded } = awardRunReward(current, run, now)
    if (awarded) await repositories.progression.save(progression)
    if ((await repositories.completedRuns.load(run.id)) === null) await repositories.completedRuns.save(run)
    return { awarded }
}
