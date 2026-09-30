import type { RunnerLevel, WorkoutId } from '../workouts'

export type SectionType = 'warmup' | 'run' | 'cooldown'
export type TargetBasis = 'time' | 'distance'

/** Exactly one canonical target. Everything else is derived. */
export type SectionTarget =
    | { basis: 'time'; durationSeconds: number }
    | { basis: 'distance'; distanceKm: number }

export interface PlanSubstep {
    id: string
    kind: 'run' | 'walk'
    durationSeconds: number
    speedKmh: number | null
}

export interface PlanSection {
    id: string
    type: SectionType
    label: string
    target: SectionTarget
    /** Target speed, not measured performance. Null when unknown. */
    speedKmh: number | null
    effort: string
    /** Used when the main section is a run/walk mix. */
    substeps?: PlanSubstep[]
}

export interface SectionMetrics {
    durationSeconds: number | null
    distanceKm: number | null
    speedKmh: number | null
    paceSecondsPerKm: number | null
    /** True when the value came from target x speed rather than being the target. */
    distanceEstimated: boolean
    durationEstimated: boolean
}

export type CapacityKind = 'distance' | 'time'

export interface BaselineAnswers {
    capacityBasis?: CapacityKind
    capacityDistanceKm?: number
    capacityMinutes?: number
    /** Time taken to cover capacityDistanceKm, which is what yields a speed. */
    capacityTimeMinutes?: number
    continuity?: 'continuous' | 'run-walk'
    paceKnown?: boolean
    paceMinutes?: number
    paceSeconds?: number
    walkPaceKnown?: boolean
    walkPaceMinutes?: number
    walkPaceSeconds?: number
    availableMinutes?: number
}

export interface PersonalBaseline {
    /** Comfortable running speed. Null when we genuinely do not know. */
    speedKmh: number | null
    speedSource: 'reported-pace' | 'distance-and-time' | 'unknown'
    comfortableCapacity: SectionTarget | null
    continuity: 'continuous' | 'run-walk'
    walkSpeedKmh: number | null
    availableSeconds: number | null
    /** Questions still worth asking, surfaced in the UI. */
    missing: string[]
}

export interface PersonalizedWorkout {
    category: WorkoutId
    categoryName: string
    level: RunnerLevel
    baseline: PersonalBaseline
    sections: PlanSection[]
    /** How the answers shaped this workout. */
    explanation: string[]
    /** Changes we had to make, for example to fit the available time. */
    adjustments: string[]
}

export interface WorkoutTotals {
    durationSeconds: number | null
    distanceKm: number | null
    /** False when a section's distance is unknown, so the total is incomplete. */
    distanceComplete: boolean
    averageSpeedKmh: number | null
    paceSecondsPerKm: number | null
}
