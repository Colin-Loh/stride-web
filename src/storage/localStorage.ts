import { DEFAULT_PREFERENCES, toCharacter, toWeightKg, type Preferences } from '../domain/preferences'
import { isAnswersRecord, isCompletedRun, isProgression, isRunSession, isTrainingPlan } from '../domain/guards'
import { SCHEMA_VERSION, type Answers, type CompletedRun, type Progression, type RunSession, type Stamped, type TrainingPlan } from '../domain/types'
import { localDateOf } from '../progression/localDate'
import { OUTDATED_NOTICE, UNREADABLE_NOTICE, UNSAVED_NOTICE, warn } from './notice'
import type { AnswersRepository, CompletedRunRepository, PlanRepository, PreferencesRepository, ProgressionRepository, Repositories, Repository, RunSessionRepository } from './repository'

const PREFIX = 'stride.'

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * One collection of records kept as a JSON array under a single localStorage key. Anything in the
 * key that is not an array of valid records (including every record written by the first,
 * single-plan version of the app) is discarded with the "outdated or invalid" notice.
 */
class LocalStorageCollection<T extends Stamped> implements Repository<T> {
    private readonly key: string
    private readonly isValid: (value: unknown) => value is T

    constructor(key: string, isValid: (value: unknown) => value is T) {
        this.key = key
        this.isValid = isValid
    }

    private readAll(): T[] {
        try {
            const raw = localStorage.getItem(PREFIX + this.key)
            if (raw === null) return []
            const value: unknown = JSON.parse(raw)
            const items = Array.isArray(value) ? value.filter(this.isValid) : []
            if (!Array.isArray(value) || items.length !== value.length) {
                warn(OUTDATED_NOTICE)
                this.writeAll(items, false)
            }
            return items
        } catch {
            warn(UNREADABLE_NOTICE)
            return []
        }
    }

    private writeAll(items: T[], announce = true) {
        try {
            if (items.length === 0) localStorage.removeItem(PREFIX + this.key)
            else localStorage.setItem(PREFIX + this.key, JSON.stringify(items))
        } catch {
            if (announce) warn(UNSAVED_NOTICE)
        }
    }

    async load(id: string): Promise<T | null> {
        return this.readAll().find((item) => item.id === id) ?? null
    }

    async save(item: T): Promise<void> {
        const others = this.readAll().filter((existing) => existing.id !== item.id)
        this.writeAll([...others, item])
    }

    async list(): Promise<T[]> {
        return this.readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    }

    async delete(id: string): Promise<void> {
        this.writeAll(this.readAll().filter((item) => item.id !== id))
    }
}

export class LocalStoragePlanRepository extends LocalStorageCollection<TrainingPlan> implements PlanRepository {
    constructor() {
        super('plan', isTrainingPlan)
    }
}

export class LocalStorageAnswersRepository extends LocalStorageCollection<Answers> implements AnswersRepository {
    constructor() {
        super('baseline', isAnswersRecord)
    }
}

export class LocalStorageRunSessionRepository extends LocalStorageCollection<RunSession> implements RunSessionRepository {
    constructor() {
        super('session', isRunSession)
    }
}

/** The run log: one CompletedRun per finished run, under 'stride.runlog'. */
export class LocalStorageCompletedRunRepository extends LocalStorageCollection<CompletedRun> implements CompletedRunRepository {
    constructor() {
        super('runlog', isCompletedRun)
    }
}

const INVALID_PROGRESSION_KEY = `${PREFIX}progression.invalid`

const newProgression = (now: Date): Progression => {
    const startDate = localDateOf(now.getTime())
    const stamp = now.toISOString()
    return {
        id: 'progression',
        schemaVersion: SCHEMA_VERSION,
        createdAt: stamp,
        updatedAt: stamp,
        startDate,
        wallets: { shiba: 0, shooshy: 0 },
        lastClaimedDate: { shiba: startDate, shooshy: startDate },
        rewardedRunIds: [],
        inventory: { shiba: [], shooshy: [] },
        equipped: { shiba: null, shooshy: null },
    }
}

/**
 * The single progression record under 'stride.progression'. Created on first load. A record that
 * fails validation is never silently dropped: its raw text is copied to 'stride.progression.invalid'
 * (or to a timestamped key if that one is already taken), the outdated notice is shown, and a fresh
 * record replaces it.
 */
export class LocalStorageProgressionRepository implements ProgressionRepository {
    private readonly key = `${PREFIX}progression`

    async load(): Promise<Progression> {
        let raw: string | null
        try {
            raw = localStorage.getItem(this.key)
        } catch {
            warn(UNREADABLE_NOTICE)
            return newProgression(new Date())
        }
        if (raw === null) {
            const created = newProgression(new Date())
            await this.save(created)
            return created
        }
        try {
            const value: unknown = JSON.parse(raw)
            if (isProgression(value)) return value
        } catch {
            // Fall through: unparseable text is preserved like any other invalid record.
        }
        warn(OUTDATED_NOTICE)
        const fresh = newProgression(new Date())
        // Only replace the bad record once its raw copy is safely written. Otherwise keep it in place.
        if (!this.preserveInvalid(raw)) {
            warn(UNSAVED_NOTICE)
            return fresh
        }
        await this.save(fresh)
        return fresh
    }

    async save(progression: Progression): Promise<void> {
        try {
            localStorage.setItem(this.key, JSON.stringify(progression))
        } catch {
            warn(UNSAVED_NOTICE)
        }
    }

    /** True when the raw copy is written. Never overwrites an earlier preserved copy. */
    private preserveInvalid(raw: string): boolean {
        try {
            const target = localStorage.getItem(INVALID_PROGRESSION_KEY) === null
                ? INVALID_PROGRESSION_KEY
                : `${INVALID_PROGRESSION_KEY}.${Date.now()}`
            localStorage.setItem(target, raw)
            return true
        } catch {
            return false
        }
    }
}

/** Name, character, optional body weight and mute setting, kept in their own keys so earlier saves stay readable. */
export class LocalStoragePreferencesRepository implements PreferencesRepository {
    async load(): Promise<Preferences> {
        const read = (key: string): unknown => {
            try {
                const raw = localStorage.getItem(PREFIX + key)
                return raw === null ? undefined : JSON.parse(raw)
            } catch {
                warn(UNREADABLE_NOTICE)
                return undefined
            }
        }
        const profile = read('profile')
        const muted = read('muted')
        const validProfile = isRecord(profile) && (profile.name === undefined || (typeof profile.name === 'string' && profile.name.trim().length > 0))
        if (profile !== undefined && !validProfile) warn(OUTDATED_NOTICE)
        const stored = validProfile ? profile : {}
        // Older saves stored the mute setting as 0 or 1.
        const validMuted = typeof muted === 'boolean' || muted === 0 || muted === 1
        if (muted !== undefined && !validMuted) warn(OUTDATED_NOTICE)
        // A weight outside the accepted range is dropped, like any other unreadable value.
        const weightKg = toWeightKg(stored.weightKg)
        if (stored.weightKg !== undefined && weightKg === null) warn(OUTDATED_NOTICE)
        return {
            weightKg,
            name: typeof stored.name === 'string' ? stored.name : DEFAULT_PREFERENCES.name,
            character: toCharacter(stored.character),
            muted: validMuted ? Boolean(muted) : DEFAULT_PREFERENCES.muted,
        }
    }

    async save(preferences: Preferences): Promise<void> {
        try {
            localStorage.setItem(`${PREFIX}profile`, JSON.stringify({
                ...(preferences.name === null ? {} : { name: preferences.name }),
                character: preferences.character,
                ...(preferences.weightKg === null ? {} : { weightKg: preferences.weightKg }),
            }))
            localStorage.setItem(`${PREFIX}muted`, JSON.stringify(preferences.muted))
        } catch {
            warn(UNSAVED_NOTICE)
        }
    }
}

/** The browser's localStorage, behind the repository interfaces. */
export function createLocalStorageRepositories(): Repositories {
    return {
        plans: new LocalStoragePlanRepository(),
        answers: new LocalStorageAnswersRepository(),
        runSessions: new LocalStorageRunSessionRepository(),
        completedRuns: new LocalStorageCompletedRunRepository(),
        progression: new LocalStorageProgressionRepository(),
        preferences: new LocalStoragePreferencesRepository(),
    }
}
