import { useCallback, useEffect, useRef, useState } from 'react'
import { playCelebration, prepareRunAudio, stopCelebration, stopCue } from '../audio'
import { DEFAULT_PREFERENCES, type Character, type Preferences } from '../domain/preferences'
import { SCHEMA_VERSION, type Answers, type RunSession, type TrainingPlan } from '../domain/types'
import { derivePersonalBaseline } from '../plan/baseline'
import { generatePersonalizedWorkout } from '../plan/generate'
import { missingQuestions, type AnswerValues } from '../plan/questions'
import { runnablePlan } from '../plan/runnable'
import { generateTrainingPlan, sessionWorkout, withSessionSections } from '../plan/trainingPlan'
import type { PersonalizedWorkout } from '../plan/types'
import type { RunProgress } from '../run/engine'
import { newRunSession } from '../run/session'
import { clearStorageNotice, storageNotice, UNSAVED_NOTICE, warn } from '../storage/notice'
import type { Repositories } from '../storage/repository'
import type { PickableWorkoutId } from '../workouts'
import { releaseWakeLock } from '../wakeLock'

type View = 'name' | 'category' | 'baseline' | 'plan' | 'workout' | 'run' | 'complete'

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
    const completing = useRef(false)
    const sessionRef = useRef<RunSession | null>(null)

    useEffect(() => {
        let cancelled = false
        void Promise.all([
            repositories.preferences.load(), repositories.plans.list(), repositories.runSessions.list(), repositories.answers.list(),
        ]).then(([loadedPreferences, plans, runs, savedAnswers]) => {
            if (cancelled) return
            const candidate = runs[0] ?? null
            const resumed = candidate && runnablePlan(candidate.plan) && loadedPreferences.name ? candidate : null
            sessionRef.current = resumed
            setPreferences(loadedPreferences)
            setPlan(plans[0] ?? null)
            setAnswers(savedAnswers[0] ?? null)
            setSession(resumed)
            setView(!loadedPreferences.name ? 'name' : resumed ? (resumed.completed ? 'complete' : 'run') : 'category')
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
        if (category !== 'test' && missingQuestions(answers?.values ?? {}).length) {
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
        persistSession({ ...session, completed: true, paused: true, result: { elapsedMs: result.elapsedMs, distanceKm: result.distanceKm } })
        void releaseWakeLock(); stopCue()
        if (!preferences.muted) void playCelebration()
        setView('complete')
    }, [session, preferences.muted, persistSession])

    function quitRun() {
        completing.current = false; persistSession(null); void releaseWakeLock(); stopCue(); stopCelebration()
        setView(open?.sessionId && plan ? 'plan' : 'category')
    }

    function startWorkout() {
        if (!open || !runnablePlan(open.workout)) return
        completing.current = false; persistSession(newRunSession(open.workout, newId())); setView('run')
    }

    function toggleMute() {
        const muted = !preferences.muted
        persistPreferences({ ...preferences, muted })
        if (muted) { stopCue(); stopCelebration() } else prepareRunAudio()
    }

    return {
        ready, preferences, plan, session, answers, open, notice, view, setView, pickCategory, showPlan,
        finishAnswers, persistSession, changeWorkout, openSession, startWorkout, handleComplete, quitRun, toggleMute,
        persistName: (name: string, character: Character) => persistPreferences({ ...preferences, name, character }),
        dismissNotice: () => { clearStorageNotice(); setNotice('') },
        editAnswers: () => { setPending(null); setView('baseline') },
    }
}
