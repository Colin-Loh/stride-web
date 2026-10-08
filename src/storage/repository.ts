import type { Answers, RunSession, Stamped, TrainingPlan } from '../domain/types'
import type { Preferences } from '../domain/preferences'

/**
 * What the app needs from storage. Methods are async so a database can replace localStorage
 * without touching the UI or hooks. A repository returns only valid records of the current
 * schema version and drops the rest, telling the runner through the storage notice.
 */
export interface Repository<T extends Stamped> {
    /** The record with this id, or null. */
    load(id: string): Promise<T | null>
    /** Insert, or replace the record with the same id. */
    save(item: T): Promise<void>
    /** Every record, most recently updated first. */
    list(): Promise<T[]>
    delete(id: string): Promise<void>
}

export type PlanRepository = Repository<TrainingPlan>
export type AnswersRepository = Repository<Answers>
export type RunSessionRepository = Repository<RunSession>

export interface PreferencesRepository {
    load(): Promise<Preferences>
    save(preferences: Preferences): Promise<void>
}

/** Everything the app persists. The concrete implementation is chosen in one place: main.tsx. */
export interface Repositories {
    plans: PlanRepository
    answers: AnswersRepository
    runSessions: RunSessionRepository
    preferences: PreferencesRepository
}
