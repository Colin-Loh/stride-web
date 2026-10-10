import { useCallback, useEffect, useRef, useState } from 'react'
import { playCelebration, prepareRunAudio, stopCelebration, stopCue } from '../audio'
import { DEFAULT_PREFERENCES, type Character, type Preferences } from '../domain/preferences'
import { SCHEMA_VERSION, type Answers, type CompletedRun, type Progression, type RunSession, type TrainingPlan } from '../domain/types'
import { derivePersonalBaseline } from '../plan/baseline'
import type { AnswersSubmitAction } from '../plan/copy'
import { generatePersonalizedWorkout } from '../plan/generate'
import { missingQuestions, type AnswerValues } from '../plan/questions'
import { runnablePlan } from '../plan/runnable'
import { generateTrainingPlan, sessionWorkout, withSessionSections } from '../plan/trainingPlan'
import type { PersonalizedWorkout } from '../plan/types'
import type { RunProgress } from '../run/engine'
import { newRunSession, withHealthSnapshot } from '../run/session'
import { deriveHealth } from '../progression/health'
import { clearStorageNotice, storageNotice, UNSAVED_NOTICE, warn } from '../storage/notice'
import type { Repositories } from '../storage/repository'
import type { PickableWorkoutId } from '../workouts'
import { claimIncome } from '../progression/income'
import { recordCompletedRun } from '../progression/reward'
import { purchase, equip, unequip } from '../cosmetics/shop'
import type { CosmeticId } from '../cosmetics/catalog'
import { releaseWakeLock } from '../wakeLock'
import { startView } from './startView'

type View = 'name' | 'home' | 'category' | 'baseline' | 'plan' | 'workout' | 'run' | 'complete' | 'status' | 'shop'

/** What the runner was doing when we had to ask for answers first. */
type Pending = { kind: 'plan' } | { kind: 'workout'; category: PickableWorkoutId }

/** The workout on the workout screen, and the plan session it belongs to (null for a single session). */
interface OpenWorkout {
    workout: PersonalizedWorkout
    sessionId: string | null
}

const newId = () => crypto.randomUUID()

/** Every write goes through a repository; a rejected save becomes the usual notice instead of a crash. */
function remember(write: Promise<void>) {
    write.catch(() => warn(UNSAVED_NOTICE))
}

export function useAppFlow(repositories: Repositories) {
    const [ready, setReady] = useState(false)
    const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES)
    const [plan, setPlan] = useState<TrainingPlan | null>(null)
    const [session, setSession] = useState<RunSession | null>(null)
    const [answers, setAnswers] = useState<Answers | null>(null)
    const [notice, setNotice] = useState(storageNotice)
    const [view, setView] = useState<View>('name')
    const [open, setOpen] = useState<OpenWorkout | null>(null)
    const [pending, setPending] = useState<Pending | null>(null)
    const [progression, setProgression] = useState<Progression | null>(null)
    const [runLog, setRunLog] = useState<CompletedRun[]>([])
    const completing = useRef(false)
    const sessionRef = useRef<RunSession | null>(null)

    useEffect(() => {
        let cancelled = false
        void Promise.all([
            repositories.preferences.load(), repositories.plans.list(), repositories.runSessions.list(), repositories.answers.list(),
            repositories.completedRuns.list(), repositories.progression.load(),
        ]).then(([loadedPreferences, plans, runs, savedAnswers, loadedRunLog, loadedProgression]) => {
            if (cancelled) return
            const candidate = runs[0] ?? null
            const resumed = candidate && runnablePlan(candidate.plan) && loadedPreferences.name ? candidate : null
            // A session saved before the health snapshot existed gets today's health, once, and is saved with it.
            const resumedWithHealth = resumed && resumed.healthAtStart === undefined
                ? withHealthSnapshot(resumed, deriveHealth(loadedRunLog, new Date())[loadedPreferences.character].status)
                : resumed
            if (resumedWithHealth && resumedWithHealth !== resumed) remember(repositories.runSessions.save(resumedWithHealth))
            sessionRef.current = resumedWithHealth
            setPreferences(loadedPreferences)
            setPlan(plans[0] ?? null)
            setAnswers(savedAnswers[0] ?? null)
            setRunLog(loadedRunLog)
            setProgression(loadedProgression)
            setSession(resumedWithHealth)
            setView(startView(loadedPreferences.name, resumedWithHealth))
            setNotice(storageNotice())
            setReady(true)
        })
        return () => { cancelled = true }
    }, [repositories])

    useEffect(() => {
        const update = () => setNotice(storageNotice())
        window.addEventListener('stride-storage', update)
        return () => window.removeEventListener('stride-storage', update)
    }, [])

    const persistSession = useCallback((next: RunSession | null) => {
        const previous = sessionRef.current
        const stamped = next === null ? null : { ...next, updatedAt: new Date().toISOString() }
        sessionRef.current = stamped
        setSession(stamped)
        if (stamped) remember(repositories.runSessions.save(stamped))
        else if (previous) remember(repositories.runSessions.delete(previous.id))
    }, [repositories])

    function persistPreferences(next: Preferences) {
        setPreferences(next)
        remember(repositories.preferences.save(next))
    }

    /** Replaces any earlier plan: there is one current plan. */
    function persistPlan(next: TrainingPlan) {
        const previous = plan
        setPlan(next)
        remember(repositories.plans.save(next))
        if (previous && previous.id !== next.id) remember(repositories.plans.delete(previous.id))
    }

    /** Loads the wallets fresh each time the status screen opens. The run log is already in memory. */
    function openStatus() {
        void repositories.progression.load().then((loaded) => {
            setProgression(loaded)
            setView('status')
        })
    }

    function openShop() {
        void repositories.progression.load().then((loaded) => {
            setProgression(loaded)
            setView('shop')
        })
    }

    /** Reads the saved progression, applies one shop rule to it, and saves only when the rule changed something. */
    function changeShop(rule: (current: Progression) => Progression) {
        remember(repositories.progression.load().then(async (current) => {
            const next = rule(current)
            if (next === current) return
            await repositories.progression.save(next)
            setProgression(next)
        }))
    }

    /** Each shop action is one rule applied to the saved progression. A refused rule returns the same object, so nothing is written. */
    function buyCosmetic(itemId: CosmeticId) {
        changeShop((current) => { const result = purchase(current, itemId); return result.ok ? result.progression : current })
    }

    function equipCosmetic(itemId: CosmeticId) {
        changeShop((current) => { const result = equip(current, itemId); return result.ok ? result.progression : current })
    }

    function unequipCosmetic(character: Character) {
        changeShop((current) => unequip(current, character))
    }

    /** Claims one character's pending income and saves the progression once. Nothing is written when nothing is pending. Resolves with the number claimed. */
    function collectIncome(character: Character): Promise<number> {
        const claim = repositories.progression.load().then(async (current) => {
            const { progression: next, claimed } = claimIncome(current, character, new Date())
            if (claimed === 0) return 0
            await repositories.progression.save(next)
            setProgression(next)
            return claimed
        })
        remember(claim.then(() => undefined))
        return claim
    }

    function openWorkout(category: PickableWorkoutId, values: AnswerValues) {
        setOpen({ workout: generatePersonalizedWorkout({ category, baseline: derivePersonalBaseline(values) }), sessionId: null })
        setView('workout')
    }

    /** Builds and saves a fresh plan from the answers; false when they cannot make one. */
    function makePlan(values: AnswerValues, record: Answers | null): boolean {
        const next = generateTrainingPlan({ baseline: derivePersonalBaseline(values), answersId: record?.id ?? null, newId })
        if (next) persistPlan(next)
        return next !== null
    }

    function pickCategory(category: PickableWorkoutId) {
        if (missingQuestions(answers?.values ?? {}).length) {
            setPending({ kind: 'workout', category }); setView('baseline')
        } else openWorkout(category, answers?.values ?? {})
    }

    function showPlan() {
        if (plan) { setView('plan'); return }
        if (missingQuestions(answers?.values ?? {}).length) {
            setPending({ kind: 'plan' }); setView('baseline')
        } else if (makePlan(answers?.values ?? {}, answers)) setView('plan')
    }

    function finishAnswers(values: AnswerValues) {
        const stamp = new Date().toISOString()
        const record: Answers = answers
            ? { ...answers, values, updatedAt: stamp }
            : { id: newId(), schemaVersion: SCHEMA_VERSION, createdAt: stamp, updatedAt: stamp, values }
        setAnswers(record)
        remember(repositories.answers.save(record))
        const action = pending
        setPending(null)
        if (action?.kind === 'workout') openWorkout(action.category, values)
        else if (action?.kind === 'plan') setView(makePlan(values, record) ? 'plan' : 'category')
        else {
            // Edited answers make an existing plan stale, so it is rebuilt from them.
            if (plan) makePlan(values, record)
            setView('category')
        }
    }

    function changeWorkout(workout: PersonalizedWorkout) {
        if (!open) return
        setOpen({ ...open, workout })
        if (plan && open.sessionId) persistPlan(withSessionSections(plan, open.sessionId, workout.sections, new Date()))
    }

    function openSession(sessionId: string) {
        if (!plan) return
        for (const week of plan.weeks) {
            const found = week.sessions.find((candidate) => candidate.id === sessionId)
            if (found) {
                setOpen({ workout: sessionWorkout(plan, week, found), sessionId })
                setView('workout')
                return
            }
        }
    }

    const handleComplete = useCallback((result: RunProgress) => {
        if (completing.current || !session || session.completed) return
        completing.current = true
        const finished: RunSession = { ...session, completed: true, paused: true, result: { elapsedMs: result.elapsedMs, distanceKm: result.distanceKm } }
        persistSession(finished)
        remember(recordCompletedRun(repositories, finished).then(() => Promise.all([repositories.completedRuns.list(), repositories.progression.load()])).then(([runs, loaded]) => { setRunLog(runs); setProgression(loaded) }))
        void releaseWakeLock(); stopCue()
        if (!preferences.muted) void playCelebration()
        setView('complete')
    }, [session, preferences.muted, persistSession, repositories])

    function quitRun() {
        completing.current = false; persistSession(null); void releaseWakeLock(); stopCue(); stopCelebration()
        setView(open?.sessionId && plan ? 'plan' : 'category')
    }

    function startWorkout() {
        if (!open || !runnablePlan(open.workout)) return
        // The health at this moment is the run's snapshot; later changes to health do not touch it.
        const health = deriveHealth(runLog, new Date())[preferences.character].status
        completing.current = false
        persistSession(newRunSession(open.workout, newId(), new Date(), preferences.character, health)); setView('run')
    }

    function toggleMute() {
        const muted = !preferences.muted
        persistPreferences({ ...preferences, muted })
        if (muted) { stopCue(); stopCelebration() } else prepareRunAudio()
    }

    return {
        ready, preferences, plan, session, answers, open, notice, view, setView, pickCategory, showPlan,
        finishAnswers, persistSession, changeWorkout, openSession, startWorkout, handleComplete, quitRun, toggleMute,
        progression, runLog, openStatus, collectIncome, openShop, buyCosmetic, equipCosmetic, unequipCosmetic,
        persistName: (name: string, character: Character, weightKg: number | null) => persistPreferences({ ...preferences, name, character, weightKg }),
        dismissNotice: () => { clearStorageNotice(); setNotice('') },
        submitAction: (pending?.kind ?? 'edit') as AnswersSubmitAction,
        editAnswers: () => { setPending(null); setView('baseline') },
    }
}
