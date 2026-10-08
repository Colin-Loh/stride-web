import type { WorkoutId } from '../workouts'

export type SectionType = 'warmup' | 'run' | 'cooldown'

/** Exactly one canonical target. Everything else is derived. */
export type SectionTarget =
    | { basis: 'time'; durationSeconds: number }
    | { basis: 'distance'; distanceKm: number }

export interface PlanSection {
    id: string
    type: SectionType
    label: string
    target: SectionTarget
    /** Target speed, not measured performance. Null when unknown. */
    speedKmh: number | null
    effort: string
    /** Rate of perceived exertion, 1-10. The fallback when no speed is known. */
    targetRpe?: number
    /** Spoken by the voice coach when the section starts. */
    audioCue?: string
    /** Repeating run/walk intervals within a section, ending at its original target. */
    runWalk?: {
        runSeconds: number
        walkSeconds: number
        walkSpeedKmh: number | null
        /** Shown and spoken on the working phase, for example "Rep". */
        runLabel?: string
        /** Shown and spoken on the recovery phase, for example "Recovery". */
        walkLabel?: string
        runCue?: string
        walkCue?: string
        runRpe?: number
        walkRpe?: number
    }
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

/** How the runner's current fitness was established, best source first. */
export type FitnessMethod = 'recent_race' | 'estimated_race' | 'easy_pace'

/** What the plan builder needs from the onboarding answers. Nulls mean "not answered". */
export interface PersonalBaseline {
    /** Daniels VDOT. Null for an easy-pace answer, which has no published mapping to VDOT. */
    vdot: number | null
    fitnessMethod: FitnessMethod | null
    /** The race behind the VDOT, for explaining it. */
    race: { distanceKm: number; seconds: number } | null
    /** Reported conversational pace, used for easy running when there is no VDOT. */
    reportedEasySpeedKmh: number | null
    weeklyKm: number | null
    daysPerWeek: number | null
    trainingEffort: string | null
    trainingFocus: string | null
    /** ISO date of the goal race, or null. */
    goalRaceDate: string | null
}

export interface PersonalizedWorkout {
    category: WorkoutId
    categoryName: string
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
