import { useCallback, useMemo, useRef, useState } from 'react'
import { playCelebration, stopCelebration, stopCue } from './audio'
import { derivePersonalBaseline, missingBaselineFields } from './plan/baseline'
import { generatePersonalizedWorkout } from './plan/generate'
import { toResolvedWorkout } from './plan/runnable'
import type { BaselineAnswers, PersonalizedWorkout } from './plan/types'
import { BaselineScreen } from './screens/BaselineScreen'
import { CategoryScreen } from './screens/CategoryScreen'
import { CompleteScreen } from './screens/CompleteScreen'
import { LevelScreen } from './screens/LevelScreen'
import { NameScreen } from './screens/NameScreen'
import { PlanScreen } from './screens/PlanScreen'
import { RunScreen } from './screens/RunScreen'
import {
  loadBaseline,
  loadMuted,
  loadPlan,
  loadProfile,
  loadSession,
  saveBaseline,
  savePlan,
  saveProfile,
  saveSession,
  toCharacter,
  type Profile,
  type RunSession,
} from './storage'
import { releaseWakeLock } from './wakeLock'
import {
  type RunnerLevel,
  type WorkoutId,
} from './workouts'

type View =
  | 'name'
  | 'level'
  | 'category'
  | 'baseline'
  | 'plan'
  | 'run'
  | 'complete'

function initialView(profile: Partial<Profile>, session: RunSession | null): View {
  if (session && !session.completed) return 'run'
  if (session?.completed) return 'complete'
  if (!profile.name) return 'name'
  if (!profile.level) return 'level'
  return 'category'
}

export default function App() {
  const [profile, setProfile] = useState<Partial<Profile>>(loadProfile)
  const [session, setSession] = useState<RunSession | null>(loadSession)
  const [muted] = useState(loadMuted)
  const [answers, setAnswers] = useState<BaselineAnswers>(loadBaseline)
  const [plan, setPlan] = useState<PersonalizedWorkout | null>(loadPlan)
  const [pendingCategory, setPendingCategory] = useState<WorkoutId | null>(null)
  const [editingAnswers, setEditingAnswers] = useState(false)
  const [view, setView] = useState<View>(() =>
    initialView(loadProfile(), loadSession()),
  )
  const completingRef = useRef(false)

  // The run screen always follows the tailored plan when there is one.
  const workout = useMemo(() => (plan ? toResolvedWorkout(plan) : null), [plan])

  function persistProfile(next: Profile) {
    setProfile(next)
    saveProfile(next)
  }

  function persistSession(next: RunSession | null) {
    setSession(next)
    saveSession(next)
  }

  function persistAnswers(next: BaselineAnswers) {
    setAnswers(next)
    saveBaseline(next)
  }

  function persistPlan(next: PersonalizedWorkout | null) {
    setPlan(next)
    savePlan(next)
  }

  function buildPlan(category: WorkoutId, source: BaselineAnswers) {
    if (!profile.level) return
    persistPlan(
      generatePersonalizedWorkout({
        category,
        level: profile.level,
        baseline: derivePersonalBaseline(source),
      }),
    )
    setView('plan')
  }

  const handleComplete = useCallback(() => {
    if (completingRef.current || !session || session.completed) return
    completingRef.current = true
    persistSession({ ...session, completed: true, paused: true })
    void releaseWakeLock()
    stopCue()
    void playCelebration()
    setView('complete')
  }, [session])

  function quitRun() {
    completingRef.current = false
    persistSession(null)
    void releaseWakeLock()
    stopCue()
    stopCelebration()
    setView('category')
  }

  return (
    <main className="shell">
      {view === 'name' ? (
        <NameScreen
          initialName={profile.name ?? ''}
          initialCharacter={toCharacter(profile.character)}
          onContinue={(name, character) => {
            persistProfile({
              name,
              level: profile.level ?? 'intermediate',
              character,
            })
            setView('level')
          }}
        />
      ) : null}

      {view === 'level' && profile.name ? (
        <LevelScreen
          name={profile.name}
          selected={profile.level}
          onBack={() => setView('name')}
          onSelect={(level: RunnerLevel) => {
            persistProfile({
              name: profile.name!,
              level,
              character: toCharacter(profile.character),
            })
            setView('category')
          }}
        />
      ) : null}

      {view === 'category' && profile.name && profile.level ? (
        <CategoryScreen
          name={profile.name}
          level={profile.level}
          selected={plan?.category}
          onChangeLevel={() => setView('level')}
          onEditAnswers={() => {
            setPendingCategory(null)
            setEditingAnswers(true)
            setView('baseline')
          }}
          onPick={(id: WorkoutId) => {
            if (missingBaselineFields(answers).length > 0) {
              setPendingCategory(id)
              setEditingAnswers(false)
              setView('baseline')
              return
            }
            buildPlan(id, answers)
          }}
        />
      ) : null}

      {view === 'baseline' ? (
        <BaselineScreen
          initial={answers}
          editAll={editingAnswers}
          onBack={() => setView('category')}
          onDone={(next) => {
            persistAnswers(next)
            if (editingAnswers && !pendingCategory && !plan) {
              setEditingAnswers(false)
              setView('category')
              return
            }
            setEditingAnswers(false)
            buildPlan(pendingCategory ?? plan?.category ?? 'easy', next)
          }}
        />
      ) : null}

      {view === 'plan' && plan ? (
        <PlanScreen
          workout={plan}
          onChange={persistPlan}
          onBack={() => setView('category')}
          onStart={() => {
            persistSession({
              workoutId: plan.category,
              startedAt: 0,
              pausedMs: 0,
              paused: false,
              completed: false,
            })
            setView('run')
          }}
        />
      ) : null}

      {view === 'run' && workout && session && profile.level ? (
        <RunScreen
          workout={workout}
          session={session}
          muted={muted}
          character={toCharacter(profile.character)}
          onSession={persistSession}
          onComplete={handleComplete}
          onQuit={quitRun}
        />
      ) : null}

      {view === 'complete' && workout && profile.name ? (
        <CompleteScreen
          name={profile.name}
          workout={workout}
          onAgain={() => {
            completingRef.current = false
            persistSession(null)
            stopCelebration()
            setView('category')
          }}
        />
      ) : null}
    </main>
  )
}
