import { SCHEMA_VERSION, type RunSession } from '../domain/types'
import type { PersonalizedWorkout } from '../plan/types'

/** Active running time: wall time minus every pause. A finished run reports its recorded result. */
export function elapsedMs(session: RunSession, now = Date.now()): number {
    if (session.completed && session.result) return session.result.elapsedMs
    if (!session.startedAt) return 0
    const until = session.paused ? session.pauseStartedAt ?? now : now
    return Math.max(0, until - session.startedAt - session.pausedMs)
}

export function newRunSession(workout: PersonalizedWorkout, id: string, now = new Date()): RunSession {
    const stamp = now.toISOString()
    return {
        id, schemaVersion: SCHEMA_VERSION, createdAt: stamp, updatedAt: stamp,
        workoutId: workout.category, plan: workout, speedChanges: [], startedAt: 0, pausedMs: 0, paused: false, completed: false,
    }
}
