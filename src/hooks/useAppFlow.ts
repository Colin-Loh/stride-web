import { useCallback, useEffect, useRef, useState } from 'react'
import { playCelebration, prepareRunAudio, stopCelebration, stopCue } from '../audio'
import { derivePersonalBaseline, missingBaselineFields } from '../plan/baseline'
import { generatePersonalizedWorkout } from '../plan/generate'
import { runnablePlan } from '../plan/runnable'
import type { BaselineAnswers, PersonalizedWorkout } from '../plan/types'
import { loadBaseline, loadMuted, loadPlan, loadProfile, loadSession, newSession,
  saveBaseline, saveMuted, savePlan, saveProfile, saveSession, storageNotice, clearStorageNotice,
  type Profile, type RunSession } from '../storage'
import type { WorkoutId } from '../workouts'
import type { RunProgress } from '../run/engine'
import { releaseWakeLock } from '../wakeLock'

type View = 'name' | 'category' | 'baseline' | 'plan' | 'run' | 'complete'
export function useAppFlow() {
  const [initial] = useState(() => {
    const profile = loadProfile(), plan = loadPlan(), candidate = loadSession(), answers = loadBaseline(), muted = loadMuted()
    const session = candidate && runnablePlan(candidate.plan) && profile.name ? candidate : null
    return { profile, plan, session, answers, muted }
  })
  const [profile, setProfile] = useState(initial.profile)
  const [plan, setPlan] = useState(initial.plan)
  const [session, setSession] = useState(initial.session)
  const [answers, setAnswers] = useState(initial.answers)
  const [muted, setMuted] = useState(initial.muted)
  const [notice, setNotice] = useState(storageNotice)
  const [view, setView] = useState<View>(() => !initial.profile.name ? 'name'
    : initial.session ? initial.session.completed ? 'complete' : 'run' : 'category')
  const [pendingCategory, setPendingCategory] = useState<WorkoutId | null>(null)
  const [editingAnswers, setEditingAnswers] = useState(false)
  const completing = useRef(false)
  useEffect(() => {
    const update = () => setNotice(storageNotice())
    window.addEventListener('stride-storage', update)
    return () => window.removeEventListener('stride-storage', update)
  }, [])
  const persistSession = useCallback((next: RunSession | null) => { setSession(next); saveSession(next) }, [])
  function persistProfile(next: Profile) { setProfile(next); saveProfile(next) }
  function persistPlan(next: PersonalizedWorkout | null) { setPlan(next); savePlan(next) }
  function buildPlan(category: WorkoutId, source: BaselineAnswers) {
    persistPlan(generatePersonalizedWorkout({ category, baseline: derivePersonalBaseline(source) }))
    setView('plan')
  }
  function pickCategory(category: WorkoutId) {
    if (category !== 'test' && missingBaselineFields(answers).length) {
      setPendingCategory(category); setEditingAnswers(false); setView('baseline')
    } else buildPlan(category, answers)
  }
  function finishAnswers(next: BaselineAnswers) {
    setAnswers(next); saveBaseline(next); setEditingAnswers(false)
    if (editingAnswers && !pendingCategory) { setView('category'); return }
    buildPlan(pendingCategory ?? 'easy', next)
  }
  const handleComplete = useCallback((result: RunProgress) => {
    if (completing.current || !session || session.completed) return
    completing.current = true
    persistSession({ ...session, completed: true, paused: true,
      result: { elapsedMs: result.elapsedMs, distanceKm: result.distanceKm } })
    void releaseWakeLock(); stopCue()
    if (!muted) void playCelebration()
    setView('complete')
  }, [session, muted, persistSession])
  function quitRun() {
    completing.current = false; persistSession(null); void releaseWakeLock(); stopCue(); stopCelebration(); setView('category')
  }
  function startPlan() {
    if (!plan || !runnablePlan(plan)) return
    completing.current = false; persistSession(newSession(plan)); setView('run')
  }
  function toggleMute() {
    const next = !muted; setMuted(next); saveMuted(next)
    if (next) { stopCue(); stopCelebration() }
    else prepareRunAudio()
  }
  return { profile, plan, session, answers, muted, notice, view, editingAnswers, setView, persistProfile, persistPlan,
    persistSession, pickCategory, finishAnswers, startPlan, handleComplete, quitRun, toggleMute,
    dismissNotice: () => { clearStorageNotice(); setNotice('') },
    editAnswers: () => { setPendingCategory(null); setEditingAnswers(true); setView('baseline') } }
}
