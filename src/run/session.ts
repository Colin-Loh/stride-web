import type { Character } from '../domain/preferences'
import { SCHEMA_VERSION, type RunSession } from '../domain/types'
import type { PersonalizedWorkout } from '../plan/types'

/** Active running time: wall time minus every pause. A finished run reports its recorded result. */
export function elapsedMs(session: RunSession, now = Date.now()): number {
    if (session.completed && session.result) return session.result.elapsedMs
    if (!session.startedAt) return 0
    const until = session.paused ? session.pauseStartedAt ?? now : now
    return Math.max(0, until - session.startedAt - session.pausedMs)
}

/**
 * The character is fixed at start: a later character switch does not change who gets the reward.
 * The health snapshot is stored only when given, so sessions without it stay valid.
 */
export function newRunSession(
    workout: PersonalizedWorkout, id: string, now = new Date(), characterId?: Character,
    healthAtStart?: NonNullable<RunSession['healthAtStart']>,
): RunSession {
    const stamp = now.toISOString()
    return {
        id, schemaVersion: SCHEMA_VERSION, createdAt: stamp, updatedAt: stamp,
        workoutId: workout.category, plan: workout, speedChanges: [], startedAt: 0, pausedMs: 0, paused: false, completed: false,
        ...(characterId ? { characterId } : {}),
        ...(healthAtStart ? { healthAtStart } : {}),
    }
}

/**
 * A session restored without a health snapshot gets the health the run log gives now. Sessions
 * that already have one are returned unchanged, so the snapshot is written once and never moves.
 */
export function withHealthSnapshot(session: RunSession, health: RunSession['healthAtStart']): RunSession {
    if (session.healthAtStart !== undefined || health === undefined) return session
    return { ...session, healthAtStart: health }
}
