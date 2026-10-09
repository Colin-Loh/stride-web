import { SCHEMA_VERSION, type Session, type SessionKind, type TrainingPlan, type Week } from '../domain/types'
import { WORKOUT_NAMES } from '../workouts'
import { calculateSectionMetrics } from './metrics'
import { CONFLICT_NOTE, REDUCED_QUALITY_NOTE, TAPER_NOTE } from './copy'
import { addDays, daysBetween, weeksUntil } from './dates'
import {
    DAYS_PER_WEEK, hardDayPositions, planWeekCount, qualityKinds, qualitySessionsPerWeek, steadyKindForFocus, TAPER_FINAL_WEEK_HARD_CAP,
    taperWeeks, trainingSpeedsKmh, weekStructure, weeklyVolumes, type SteadyKind, type WeekStructure,
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

/** A day in a plan week: its workout kind, and whether it is sized from the week's remaining distance. */
interface Slot {
    kind: SessionKind
    shared: boolean
}

/**
 * The week's runs in order: hard days (speed sessions, then steady M or T runs) on every other
 * day so none touch, E runs between them, and the long run last. The long run is easy running, so
 * the next week's first hard day is never right after one.
 */
function orderSessions(quality: SessionKind[], steadyKind: SteadyKind, structure: WeekStructure): Slot[] {
    const hard: Slot[] = [
        ...quality.map((kind) => ({ kind, shared: false })),
        ...Array.from({ length: structure.steady }, () => ({ kind: steadyKind, shared: true })),
    ]
    const days: Slot[] = Array.from({ length: hard.length + structure.easy }, () => ({ kind: 'easyRun', shared: true }))
    hardDayPositions(days.length, hard.length).forEach((day, index) => { days[day] = hard[index] })
    return structure.long > 0 ? [...days, { kind: 'long', shared: false }] : days
}

/**
 * A multi-week plan from the runner's answers. Each week holds one long run, the speed sessions
 * the training effort allows, steady runs (marathon pace or threshold, by training focus) and
 * easy runs. Speed plus steady runs are at most `HARD_DAYS_PER_WEEK_CAP`, never on adjacent days.
 * The steady and easy runs share the rest of that week's target distance (from `weeklyVolumes`,
 * reduced by the taper before a goal race); every block is sized with the caps in vdot.ts. Null
 * when the weekly distance or running days are unknown.
 */
export function generateTrainingPlan(input: PlanInput): TrainingPlan | null {
    const { baseline, answersId = null, now = new Date(), newId = () => crypto.randomUUID() } = input
    if (baseline.weeklyKm === null || baseline.weeklyKm <= 0 || baseline.daysPerWeek === null || baseline.daysPerWeek < 1) return null

    const stamp = now.toISOString()
    const planId = newId()
    const startDate = toIsoDate(now)
    const goalWeeks = baseline.goalRaceDate === null ? null : weeksUntil(baseline.goalRaceDate, now)
    const volumes = weeklyVolumes(baseline.weeklyKm, baseline.daysPerWeek, planWeekCount(goalWeeks))
    const tapered = taperWeeks(volumes, baseline.goalRaceDate === null ? -1 : daysBetween(startDate, baseline.goalRaceDate), baseline.trainingFocus)
    const wantedQuality = baseline.trainingEffort === null ? 0 : qualitySessionsPerWeek(baseline.trainingEffort)
    const runsPerWeek = baseline.daysPerWeek
    const structure = weekStructure(runsPerWeek, baseline.trainingEffort)
    const steadyKind = steadyKindForFocus(baseline.trainingFocus)
    let otherLongerThanLong = false

    const weeks: Week[] = tapered.map(({ targetKm, taper, final }, index) => {
        const weekId = `${planId}-w${index + 1}`
        const weekBaseline: PersonalBaseline = { ...baseline, weeklyKm: targetKm }
        const toSession = (workout: PersonalizedWorkout, kind: SessionKind, position: number): Session => ({
            id: `${weekId}-s${position}`, schemaVersion: SCHEMA_VERSION, createdAt: stamp, updatedAt: stamp,
            kind, name: workout.categoryName,
            sections: workout.sections, explanation: workout.explanation, adjustments: workout.adjustments,
        })

        const shape = final ? weekStructure(runsPerWeek, baseline.trainingEffort, TAPER_FINAL_WEEK_HARD_CAP) : structure
        const slots = orderSessions(qualityKinds(index, shape.quality), steadyKind, shape)
        const fixed = slots.filter((slot) => !slot.shared).map((slot) => buildWorkout({ category: slot.kind, baseline: weekBaseline }))
        const fixedKm = fixed.reduce((km, workout) => km + knownDistanceKm(workout.sections), 0)
        const sharedSlots = slots.length - fixed.length
        const sharedKm = sharedSlots > 0 ? Math.max(0, targetKm - fixedKm) / sharedSlots : 0
        const longKm = fixed.find((workout) => workout.category === 'long')?.sections[0].target
        if (sharedSlots > 0 && longKm?.basis === 'distance' && sharedKm > longKm.distanceKm) otherLongerThanLong = true

        const queue = [...fixed]
        const workouts = slots.map((slot) =>
            slot.shared
                ? buildWorkout({ category: slot.kind, baseline: weekBaseline, distanceKm: sharedKm })
                : queue.shift()!)
        const kinds = slots.map((slot) => slot.kind)
        return {
            id: weekId, schemaVersion: SCHEMA_VERSION, createdAt: stamp, updatedAt: stamp,
            number: index + 1, startDate: addDays(startDate, index * DAYS_PER_WEEK), targetKm,
            ...(taper ? { taper: true } : {}),
            sessions: workouts.map((workout, position) => toSession(workout, kinds[position], position + 1)),
        }
    })

    const rawSpeeds = baseline.vdot === null ? null : trainingSpeedsKmh(baseline.vdot)
    const notes = [
        fitnessNote(baseline, rawSpeeds),
        goalNote(baseline, now),
        tapered.some((week) => week.taper) ? TAPER_NOTE : null,
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
