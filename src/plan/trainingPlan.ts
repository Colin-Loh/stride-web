import { SCHEMA_VERSION, type Session, type SessionKind, type TrainingPlan, type Week } from '../domain/types'
import { calculateSectionMetrics } from './metrics'
import { CONFLICT_NOTE, REDUCED_QUALITY_NOTE } from './copy'
import { addDays, weeksUntil } from './dates'
import { DAYS_PER_WEEK, planWeekCount, qualityKinds, qualitySessionsPerWeek, trainingSpeedsKmh, weekStructure, weeklyVolumes } from './daniels'
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

/** Quality sessions and E runs alternate, with the long run last. */
function orderSessions(quality: SessionKind[], easy: number, long: boolean): SessionKind[] {
    const order: SessionKind[] = []
    const speed = [...quality]
    let fillers = easy
    while (speed.length > 0 || fillers > 0) {
        const next = speed.shift()
        if (next) order.push(next)
        if (fillers > 0) { order.push('filler'); fillers -= 1 }
    }
    return long ? [...order, 'long'] : order
}

/**
 * A multi-week plan from the runner's answers. Each week holds the long run, the speed sessions
 * the training effort allows and E running for the rest of that week's target distance (from
 * `weeklyVolumes`), all sized with the caps in daniels.ts. Null when the weekly distance or
 * running days are unknown.
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
    let easyLongerThanLong = false

    const weeks: Week[] = volumes.map((targetKm, index) => {
        const weekId = `${planId}-w${index + 1}`
        const weekBaseline: PersonalBaseline = { ...baseline, weeklyKm: targetKm }
        const toSession = (workout: PersonalizedWorkout, kind: SessionKind, position: number): Session => ({
            id: `${weekId}-s${position}`, schemaVersion: SCHEMA_VERSION, createdAt: stamp, updatedAt: stamp,
            kind, name: workout.categoryName,
            sections: workout.sections, explanation: workout.explanation, adjustments: workout.adjustments,
        })

        const kinds = orderSessions(qualityKinds(index, structure.quality), structure.easy, structure.long > 0)
        const fixed = kinds.filter((kind) => kind !== 'filler').map((kind) => buildWorkout({ category: kind, baseline: weekBaseline }))
        const fixedKm = fixed.reduce((km, workout) => km + knownDistanceKm(workout.sections), 0)
        const easyKm = structure.easy > 0 ? Math.max(0, targetKm - fixedKm) / structure.easy : 0
        const longKm = fixed.find((workout) => workout.category === 'long')?.sections[0].target
        if (structure.easy > 0 && longKm?.basis === 'distance' && easyKm > longKm.distanceKm) easyLongerThanLong = true

        const queue = [...fixed]
        const workouts = kinds.map((kind) =>
            kind === 'filler'
                ? buildWorkout({ category: 'filler', baseline: weekBaseline, distanceKm: easyKm })
                : queue.shift()!)
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
        easyLongerThanLong ? CONFLICT_NOTE : null,
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
        categoryName: session.name,
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
