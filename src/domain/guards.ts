import { MAX_SPEED, MIN_SPEED } from '../plan/convert'
import { ZONES } from '../plan/vdot'
import { isAnswers as isAnswerValues } from '../plan/questions'
import type { PersonalBaseline, PersonalizedWorkout, PlanSection } from '../plan/types'
import { WORKOUT_NAMES } from '../workouts'
import { SCHEMA_VERSION, type Answers, type PaceSet, type RunSession, type Session, type Stamped, type TrainingPlan, type Week } from './types'

/**
 * Runtime checks for stored data. Anything that does not pass is discarded, never repaired:
 * records from an older format (old workout ids, the old plan shape, a missing schemaVersion)
 * fail here and the repository reports them with the "outdated or invalid" notice.
 */

/** Rate of perceived exertion runs from 1 to 10. */
const MAX_RPE = 10

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const nonnegative = (v: unknown): v is number => finite(v) && v >= 0
const positive = (v: unknown): v is number => finite(v) && v > 0
const text = (v: unknown): v is string => typeof v === 'string'
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(text)
const nullOr = (check: (v: unknown) => boolean) => (v: unknown) => v === null || check(v)
const isSpeed = (v: unknown) => v === null || (finite(v) && v >= MIN_SPEED && v <= MAX_SPEED)
const isoDateTime = (v: unknown): v is string => text(v) && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v))
const isoDate = (v: unknown): v is string => text(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00Z`))

/** The fields every stored record carries. */
function isStamped(v: unknown): v is Stamped {
    return record(v) && text(v.id) && v.id.length > 0 && v.schemaVersion === SCHEMA_VERSION
        && isoDateTime(v.createdAt) && isoDateTime(v.updatedAt)
}

function isTarget(v: unknown): boolean {
    return record(v) && ((v.basis === 'time' && positive(v.durationSeconds) && v.distanceKm === undefined)
        || (v.basis === 'distance' && positive(v.distanceKm) && v.durationSeconds === undefined))
}

const isRpe = (v: unknown) => v === undefined || (finite(v) && v >= 1 && v <= MAX_RPE)
const isCue = (v: unknown) => v === undefined || text(v)

function isSection(v: unknown): v is PlanSection {
    return record(v) && text(v.id) && text(v.label) && text(v.effort)
        && ['warmup', 'run', 'cooldown'].includes(String(v.type)) && isTarget(v.target) && isSpeed(v.speedKmh)
        && isRpe(v.targetRpe) && isCue(v.audioCue)
        && (v.runWalk === undefined || (record(v.runWalk) && positive(v.runWalk.runSeconds) && v.runWalk.runSeconds >= 1
            && positive(v.runWalk.walkSeconds) && v.runWalk.walkSeconds >= 1 && isSpeed(v.runWalk.walkSpeedKmh)
            && isCue(v.runWalk.runLabel) && isCue(v.runWalk.walkLabel) && isCue(v.runWalk.runCue) && isCue(v.runWalk.walkCue)
            && isRpe(v.runWalk.runRpe) && isRpe(v.runWalk.walkRpe)))
}

function isSections(v: unknown): v is PlanSection[] {
    return Array.isArray(v) && v.length > 0 && v.every(isSection) && new Set(v.map((item) => item.id)).size === v.length
}

function isBaseline(v: unknown): v is PersonalBaseline {
    return record(v)
        && nullOr(positive)(v.vdot) && nullOr((m) => ['recent_race', 'estimated_race', 'easy_pace'].includes(String(m)))(v.fitnessMethod)
        && nullOr((r) => record(r) && positive(r.distanceKm) && positive(r.seconds))(v.race)
        && nullOr(positive)(v.reportedEasySpeedKmh) && nullOr(nonnegative)(v.weeklyKm) && nullOr(positive)(v.daysPerWeek)
        && nullOr(text)(v.trainingEffort) && nullOr(text)(v.trainingFocus) && nullOr(text)(v.goalRaceDate)
}

const WORKOUT_IDS = Object.keys(WORKOUT_NAMES)
const SESSION_KINDS = WORKOUT_IDS

function isWorkout(v: unknown): v is PersonalizedWorkout {
    return record(v) && WORKOUT_IDS.includes(String(v.category)) && text(v.categoryName) && isBaseline(v.baseline)
        && isSections(v.sections) && strings(v.explanation) && strings(v.adjustments)
}

function isPaceSet(v: unknown): v is PaceSet {
    if (!isStamped(v) || !nullOr(positive)((v as { vdot?: unknown }).vdot)) return false
    const zones = (v as { zones?: unknown }).zones
    return record(zones) && Object.keys(ZONES).every((zone) => nullOr((p) => record(p) && positive(p.paceSecondsPerKm) && positive(p.speedKmh))(zones[zone]))
}

function isSession(v: unknown): v is Session {
    return isStamped(v) && SESSION_KINDS.includes(String((v as { kind?: unknown }).kind)) && text((v as { name?: unknown }).name)
        && isSections((v as { sections?: unknown }).sections) && strings((v as { explanation?: unknown }).explanation)
        && strings((v as { adjustments?: unknown }).adjustments)
}

function isWeek(v: unknown, index: number): v is Week {
    if (!isStamped(v)) return false
    const week = v as unknown as Record<string, unknown>
    return week.number === index + 1 && isoDate(week.startDate) && positive(week.targetKm)
        && Array.isArray(week.sessions) && week.sessions.length > 0 && week.sessions.every(isSession)
}

export function isTrainingPlan(v: unknown): v is TrainingPlan {
    if (!isStamped(v)) return false
    const plan = v as unknown as Record<string, unknown>
    return nullOr(text)(plan.answersId) && isBaseline(plan.baseline) && isPaceSet(plan.paces) && isoDate(plan.startDate)
        && Array.isArray(plan.weeks) && plan.weeks.length > 0 && plan.weeks.every(isWeek) && strings(plan.notes)
}

export function isAnswersRecord(v: unknown): v is Answers {
    return isStamped(v) && isAnswerValues((v as { values?: unknown }).values)
}

export function isRunSession(v: unknown): v is RunSession {
    if (!isStamped(v)) return false
    const run = v as unknown as Record<string, unknown>
    if (!isWorkout(run.plan) || run.workoutId !== run.plan.category) return false
    if (!nonnegative(run.startedAt) || !nonnegative(run.pausedMs) || typeof run.paused !== 'boolean' || typeof run.completed !== 'boolean') return false
    if (run.pauseStartedAt !== undefined && (!nonnegative(run.pauseStartedAt) || run.pauseStartedAt < run.startedAt)) return false
    if (run.paused && !run.completed && run.startedAt > 0 && run.pauseStartedAt === undefined) return false
    if (!Array.isArray(run.speedChanges) || !run.speedChanges.every((e, i, all) => record(e) && nonnegative(e.atMs)
        && finite(e.offset) && Math.abs(e.offset) <= MAX_SPEED && (i === 0 || e.atMs >= all[i - 1].atMs))) return false
    return !run.completed || (record(run.result) && nonnegative(run.result.elapsedMs)
        && (run.result.distanceKm === null || nonnegative(run.result.distanceKm)))
}
