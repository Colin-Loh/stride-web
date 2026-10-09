import { SCHEMA_VERSION, type Session, type SessionKind, type TrainingPlan, type Week } from '../domain/types'
import { WORKOUT_NAMES } from '../workouts'
import { calculateSectionMetrics } from './metrics'
import { CONFLICT_NOTE, REDUCED_QUALITY_NOTE } from './copy'
import { addDays, weeksUntil } from './dates'
import {
    DAYS_PER_WEEK, planWeekCount, qualityKinds, qualitySessionsPerWeek, steadyKindForFocus, trainingSpeedsKmh, weekStructure,
    weeklyVolumes, type SteadyKind,
} from './vdot'
import { fitnessNote, goalNote } from './explanations'
import { buildWorkout } from './generate'
import { buildPaceSet } from './paces'
import { toIsoDate } from './questions'
import type { PersonalBaseline, PersonalizedWorkout, PlanSection } from './types'

export interface PlanInput {
    baseline: PersonalBaseline
    answersId?: string | null
    now?: Date
    /** Source of new record ids. Defaults to random UUIDs. */
    newId?: () => string
}

const knownDistanceKm = (sections: PlanSection[]) =>
    sections.reduce((km, item) => km + (calculateSectionMetrics(item).distanceKm ?? 0), 0)

/** A day in a plan week: its workout kind, and whether it is a steady run sized from the week's remainder. */
interface Slot {
    kind: SessionKind
    steady: boolean
}

/** Speed sessions and steady (M or T) runs alternate, with the long run last. */
function orderSessions(quality: SessionKind[], steadyKind: SteadyKind, steady: number, long: boolean): Slot[] {
    const order: Slot[] = []
    const speed = [...quality]
    let remaining = steady
    while (speed.length > 0 || remaining > 0) {
        const next = speed.shift()
        if (next) order.push({ kind: next, steady: false })
        if (remaining > 0) { order.push({ kind: steadyKind, steady: true }); remaining -= 1 }
    }
    return long ? [...order, { kind: 'long', steady: false }] : order
}

/**
 * A multi-week plan from the runner's answers. Each week holds one long run, the speed sessions
 * the training effort allows, and steady runs (marathon pace or threshold, by training focus) on
 * the other days. The steady runs share the rest of that week's target distance (from
 * `weeklyVolumes`); every block is sized with the caps in vdot.ts. Null when the weekly distance
 * or running days are unknown.
 */
export function generateTrainingPlan(input: PlanInput): TrainingPlan | null {
    const { baseline, answersId = null, now = new Date(), newId = () => crypto.randomUUID() } = input
    if (baseline.weeklyKm === null || baseline.weeklyKm <= 0 || baseline.daysPerWeek === null || baseline.daysPerWeek < 1) return null

    const stamp = now.toISOString()
    const planId = newId()
    const startDate = toIsoDate(now)
    const goalWeeks = baseline.goalRaceDate === null ? null : weeksUntil(baseline.goalRaceDate, now)
    const volumes = weeklyVolumes(baseline.weeklyKm, baseline.daysPerWeek, planWeekCount(goalWeeks))
    const wantedQuality = baseline.trainingEffort === null ? 0 : qualitySessionsPerWeek(baseline.trainingEffort)
    const structure = weekStructure(baseline.daysPerWeek, baseline.trainingEffort)
    const steadyKind = steadyKindForFocus(baseline.trainingFocus)
    let otherLongerThanLong = false

    const weeks: Week[] = volumes.map((targetKm, index) => {
        const weekId = `${planId}-w${index + 1}`
        const weekBaseline: PersonalBaseline = { ...baseline, weeklyKm: targetKm }
        const toSession = (workout: PersonalizedWorkout, kind: SessionKind, position: number): Session => ({
            id: `${weekId}-s${position}`, schemaVersion: SCHEMA_VERSION, createdAt: stamp, updatedAt: stamp,
            kind, name: workout.categoryName,
            sections: workout.sections, explanation: workout.explanation, adjustments: workout.adjustments,
        })

        // `structure.easy` counts the days that are neither long nor speed; they become steady runs.
        const steadySlots = structure.easy
        const slots = orderSessions(qualityKinds(index, structure.quality), steadyKind, steadySlots, structure.long > 0)
        const fixed = slots.filter((slot) => !slot.steady).map((slot) => buildWorkout({ category: slot.kind, baseline: weekBaseline }))
        const fixedKm = fixed.reduce((km, workout) => km + knownDistanceKm(workout.sections), 0)
        const steadyKm = steadySlots > 0 ? Math.max(0, targetKm - fixedKm) / steadySlots : 0
        const longKm = fixed.find((workout) => workout.category === 'long')?.sections[0].target
        if (steadySlots > 0 && longKm?.basis === 'distance' && steadyKm > longKm.distanceKm) otherLongerThanLong = true

        const queue = [...fixed]
        const workouts = slots.map((slot) =>
            slot.steady
                ? buildWorkout({ category: slot.kind, baseline: weekBaseline, distanceKm: steadyKm })
                : queue.shift()!)
        const kinds = slots.map((slot) => slot.kind)
        return {
            id: weekId, schemaVersion: SCHEMA_VERSION, createdAt: stamp, updatedAt: stamp,
            number: index + 1, startDate: addDays(startDate, index * DAYS_PER_WEEK), targetKm,
            sessions: workouts.map((workout, position) => toSession(workout, kinds[position], position + 1)),
        }
    })

    const rawSpeeds = baseline.vdot === null ? null : trainingSpeedsKmh(baseline.vdot)
    const notes = [
        fitnessNote(baseline, rawSpeeds),
        goalNote(baseline, now),
        wantedQuality > structure.quality ? REDUCED_QUALITY_NOTE : null,
        otherLongerThanLong ? CONFLICT_NOTE : null,
    ].filter((note): note is string => note !== null)

    return {
        id: planId, schemaVersion: SCHEMA_VERSION, createdAt: stamp, updatedAt: stamp,
        answersId, baseline, paces: buildPaceSet(baseline, `${planId}-paces`, stamp), startDate, weeks, notes,
    }
}

/** A plan session as a runnable workout, validated against that week's volume. */
export function sessionWorkout(plan: TrainingPlan, week: Week, session: Session): PersonalizedWorkout {
    return {
        category: session.kind,
        categoryName: WORKOUT_NAMES[session.kind],
        baseline: { ...plan.baseline, weeklyKm: week.targetKm },
        sections: session.sections,
        explanation: session.explanation,
        adjustments: session.adjustments,
    }
}

/** The plan with one session's sections replaced, for edits made on the workout screen. */
export function withSessionSections(plan: TrainingPlan, sessionId: string, sections: PlanSection[], now: Date): TrainingPlan {
    const stamp = now.toISOString()
    return {
        ...plan,
        updatedAt: stamp,
        weeks: plan.weeks.map((week) => week.sessions.some((session) => session.id === sessionId)
            ? { ...week, updatedAt: stamp, sessions: week.sessions.map((session) => session.id === sessionId ? { ...session, sections, updatedAt: stamp } : session) }
            : week),
    }
}
