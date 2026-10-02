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

export interface BaselineAnswers {
    /** A recent all-out race or time trial: the best source of a VDOT. */
    raceKnown?: boolean
    raceDistanceKm?: number
    raceSeconds?: number
    /** Required: Daniels sizes every session as a share of the week. */
    weeklyKm?: number
    /** Required, 1-7: how many runs the week is split into. */
    daysPerWeek?: number
    continuity?: 'continuous' | 'run-walk'
    paceKnown?: boolean
    paceMinutes?: number
    paceSeconds?: number
    walkPaceKnown?: boolean
    walkPaceMinutes?: number
    walkPaceSeconds?: number
    runMinutes?: number
    walkMinutes?: number
    availableMinutes?: number
}

export interface PersonalBaseline {
    /** Comfortable running speed. Null when we genuinely do not know. */
    speedKmh: number | null
    /** 'default' means the runner did not know their pace, so DEFAULT_EASY_PACE_SECONDS stands in. */
    speedSource: 'reported-pace' | 'race' | 'default' | 'unknown'
    /** The runner's own comfortable speed, kept even when a race moved speedKmh into Daniels' easy range. */
    reportedSpeedKmh?: number | null
    /** Daniels VDOT. Optional only so plans saved before it existed still load. */
    vdot?: number | null
    vdotSource?: 'race' | 'easy-pace' | null
    race?: { distanceKm: number; seconds: number } | null
    weeklyKm?: number | null
    daysPerWeek?: number | null
    continuity: 'continuous' | 'run-walk'
    walkSpeedKmh: number | null
    /** 'default' means the runner did not know their walking pace, so DEFAULT_WALK_PACE_SECONDS stands in. */
    walkSpeedSource?: 'reported' | 'default' | null
    runSeconds?: number
    walkSeconds?: number
    availableSeconds: number | null
    /** Questions still worth asking, surfaced in the UI. */
    missing: string[]
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
