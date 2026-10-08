import { roundSpeedUp } from './plan/convert'
import { isAnswers, type Answers } from './plan/questions'
import type { PersonalizedWorkout, PlanSection } from './plan/types'
import type { WorkoutId } from './workouts'
import type { SpeedChange } from './run/engine'

export type Character = 'shiba' | 'cat'
export const toCharacter = (value: unknown): Character => value === 'cat' || value === 'girl' ? 'cat' : 'shiba'
export interface Profile { name: string; character: Character }
export interface RunSession {
  version: 2
  workoutId: WorkoutId
  plan: PersonalizedWorkout
  speedChanges: SpeedChange[]
  startedAt: number
  pausedMs: number
  paused: boolean
  pauseStartedAt?: number
  completed: boolean
  result?: { elapsedMs: number; distanceKm: number | null }
}
let notice = ''
export function storageNotice() { return notice }
function warn(message: string) {
  notice = message
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('stride-storage'))
}
export function clearStorageNotice() { notice = '' }
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const nonnegative = (v: unknown): v is number => finite(v) && v >= 0
const positive = (v: unknown): v is number => finite(v) && v > 0
const speed = (v: unknown) => v === null || (finite(v) && v >= 0.5 && v <= 25)
const category = (v: unknown) => ['test', 'long', 'threshold', 'interval', 'repetition', 'filler'].includes(String(v))
const strings = (v: unknown) => Array.isArray(v) && v.every(x => typeof x === 'string')
function target(v: unknown): boolean {
  return record(v) && ((v.basis === 'time' && positive(v.durationSeconds) && v.distanceKm === undefined)
    || (v.basis === 'distance' && positive(v.distanceKm) && v.durationSeconds === undefined))
}
const rpe = (v: unknown) => v === undefined || (finite(v) && v >= 1 && v <= 10)
const cue = (v: unknown) => v === undefined || typeof v === 'string'
function section(v: unknown): v is PlanSection {
  return record(v) && typeof v.id === 'string' && typeof v.label === 'string' && typeof v.effort === 'string'
    && ['warmup', 'run', 'cooldown'].includes(String(v.type)) && target(v.target) && speed(v.speedKmh)
    && rpe(v.targetRpe) && cue(v.audioCue)
    && (v.runWalk === undefined || (record(v.runWalk) && positive(v.runWalk.runSeconds) && v.runWalk.runSeconds >= 1
      && positive(v.runWalk.walkSeconds) && v.runWalk.walkSeconds >= 1 && speed(v.runWalk.walkSpeedKmh)
      && cue(v.runWalk.runLabel) && cue(v.runWalk.walkLabel) && cue(v.runWalk.runCue) && cue(v.runWalk.walkCue)
      && rpe(v.runWalk.runRpe) && rpe(v.runWalk.walkRpe)))
}
const nullOr = (check: (v: unknown) => boolean) => (v: unknown) => v === null || check(v)
const nullableText = nullOr(v => typeof v === 'string')
/** Baseline saved by this version. Plans from the old question format lack these fields and are discarded. */
function isBaseline(b: Record<string, unknown>): boolean {
  return nullOr(positive)(b.vdot) && nullOr(v => ['recent_race', 'estimated_race', 'easy_pace'].includes(String(v)))(b.fitnessMethod)
    && nullOr(v => record(v) && positive(v.distanceKm) && positive(v.seconds))(b.race)
    && nullOr(positive)(b.reportedEasySpeedKmh) && nullOr(nonnegative)(b.weeklyKm) && nullOr(positive)(b.daysPerWeek)
    && nullableText(b.trainingEffort) && nullableText(b.trainingFocus) && nullableText(b.goalRaceDate)
}
export function isPlan(v: unknown): v is PersonalizedWorkout {
  if (!record(v) || !record(v.baseline)) return false
  return category(v.category) && typeof v.categoryName === 'string'
    && Array.isArray(v.sections) && v.sections.length > 0 && v.sections.every(section)
    && new Set(v.sections.map(s => s.id)).size === v.sections.length
    && strings(v.explanation) && strings(v.adjustments) && isBaseline(v.baseline)
}
export function isSession(v: unknown): v is RunSession {
  if (!record(v) || v.version !== 2 || !isPlan(v.plan) || v.workoutId !== v.plan.category) return false
  if (!nonnegative(v.startedAt) || !nonnegative(v.pausedMs) || typeof v.paused !== 'boolean' || typeof v.completed !== 'boolean') return false
  if (v.pauseStartedAt !== undefined && (!nonnegative(v.pauseStartedAt) || v.pauseStartedAt < v.startedAt)) return false
  if (v.paused && !v.completed && v.startedAt > 0 && v.pauseStartedAt === undefined) return false
  if (!Array.isArray(v.speedChanges) || !v.speedChanges.every((e, i, all) => record(e) && nonnegative(e.atMs)
    && finite(e.offset) && Math.abs(e.offset) <= 25 && (i === 0 || e.atMs >= all[i - 1].atMs))) return false
  return !v.completed || (record(v.result) && nonnegative(v.result.elapsedMs)
    && (v.result.distanceKm === null || nonnegative(v.result.distanceKm)))
}
function read<T>(key: string, fallback: T, valid: (v: unknown) => v is T): T {
  try {
    const raw = localStorage.getItem(`stride.${key}`)
    if (raw === null) return fallback
    const value: unknown = JSON.parse(raw)
    if (valid(value)) return value
    warn('Some saved data is outdated or invalid. Start a new workout; your valid profile is kept.')
  } catch { warn('Saved data could not be read. You can continue with a new workout.') }
  return fallback
}
function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(`stride.${key}`)
    else localStorage.setItem(`stride.${key}`, JSON.stringify(value))
  } catch { warn('Changes cannot be saved in this browser. Keep this page open; refreshing may lose your workout.') }
}
export const loadProfile = () => read<Partial<Profile>>('profile', {}, (v): v is Partial<Profile> => record(v)
  && (v.name === undefined || (typeof v.name === 'string' && v.name.trim().length > 0)))
export const saveProfile = (v: Profile) => write('profile', v)
export function loadPlan() {
  const plan = read<PersonalizedWorkout | null>('plan', null, (v): v is PersonalizedWorkout | null => v === null || isPlan(v))
  return plan ? {
    ...plan, sections: plan.sections.map(s => ({
      ...s, speedKmh: s.speedKmh === null ? null : roundSpeedUp(s.speedKmh),
      ...(s.runWalk ? { runWalk: { ...s.runWalk, walkSpeedKmh: s.runWalk.walkSpeedKmh === null ? null : roundSpeedUp(s.runWalk.walkSpeedKmh) } } : {})
    }))
  } : null
}
export const savePlan = (v: PersonalizedWorkout | null) => write('plan', v)
export const loadSession = () => read<RunSession | null>('session', null, (v): v is RunSession | null => v === null || isSession(v))
export const saveSession = (v: RunSession | null) => write('session', v)
export function loadMuted(): boolean {
  return read<boolean | number>('muted', false, (v): v is boolean | number => typeof v === 'boolean' || v === 0 || v === 1) ? true : false
}
export const saveMuted = (v: boolean) => write('muted', v)
/** Answers saved in the old question format have unknown ids, fail the check and are discarded with the usual notice. */
export const loadBaseline = () => read<Answers>('baseline', {}, isAnswers)
export const saveBaseline = (v: Answers) => write('baseline', v)
export function elapsedMs(session: RunSession, now = Date.now()): number {
  if (session.completed && session.result) return session.result.elapsedMs
  if (!session.startedAt) return 0
  const until = session.paused ? session.pauseStartedAt ?? now : now
  return Math.max(0, until - session.startedAt - session.pausedMs)
}
export function newSession(plan: PersonalizedWorkout): RunSession {
  return { version: 2, workoutId: plan.category, plan, speedChanges: [], startedAt: 0, pausedMs: 0, paused: false, completed: false }
}
