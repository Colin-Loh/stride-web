import type { WorkoutId } from '../workouts'
import type { AnswerValues } from '../plan/questions'
import type { PersonalBaseline, PersonalizedWorkout, PlanSection } from '../plan/types'
import type { SpeedChange } from '../run/engine'
import type { Zone } from '../plan/vdot'

/**
 * The stored domain model. Everything here is plain JSON: strings, numbers, booleans, arrays and
 * objects. No functions, Dates or class instances, so any record can move unchanged between
 * localStorage and a database. Every record has a stable string id, a schema version and ISO
 * 8601 timestamps. Bump SCHEMA_VERSION when the shape changes; records with another version are
 * discarded by the repository, not migrated.
 */
export const SCHEMA_VERSION = 1

export interface Stamped {
    /** Stable, unique and never reused. */
    id: string
    schemaVersion: typeof SCHEMA_VERSION
    /** ISO 8601 date-time. */
    createdAt: string
    /** ISO 8601 date-time. */
    updatedAt: string
}

/** One VDOT pace as shown on a pace card. */
export interface ZonePace {
    paceSecondsPerKm: number
    /** Treadmill speed, rounded up to 0.1 km/h. */
    speedKmh: number
}

/** The five VDOT paces. A zone is null when the runner's answers cannot give it. */
export interface PaceSet extends Stamped {
    vdot: number | null
    zones: Record<Zone, ZonePace | null>
}

/** A kind of session inside a plan week. */
export type SessionKind = WorkoutId

export interface Session extends Stamped {
    kind: SessionKind
    name: string
    sections: PlanSection[]
    explanation: string[]
    adjustments: string[]
}

export interface Week extends Stamped {
    /** 1-based position in the plan. */
    number: number
    /** ISO date (YYYY-MM-DD) the week starts. */
    startDate: string
    targetKm: number
    /** True in the weeks before the goal race that run reduced volume. Absent otherwise. */
    taper?: boolean
    sessions: Session[]
}

export interface TrainingPlan extends Stamped {
    /** The answers the plan was built from, or null. */
    answersId: string | null
    baseline: PersonalBaseline
    paces: PaceSet
    /** ISO date (YYYY-MM-DD) week 1 starts. */
    startDate: string
    weeks: Week[]
    /** Plan-level remarks for the runner. */
    notes: string[]
}

/** The onboarding answers, stored with the standard record fields. */
export interface Answers extends Stamped {
    values: AnswerValues
}

/** A run in progress or just finished: the workout snapshot plus pause state and speed history. */
export interface RunSession extends Stamped {
    workoutId: WorkoutId
    plan: PersonalizedWorkout
    speedChanges: SpeedChange[]
    /** Epoch milliseconds, 0 until the run starts. */
    startedAt: number
    pausedMs: number
    paused: boolean
    pauseStartedAt?: number
    completed: boolean
    result?: { elapsedMs: number; distanceKm: number | null }
}
