import { useCallback, useMemo, useRef, useState } from 'react'
import { playCelebration, stopCelebration, stopCue } from './audio'
import { CompleteScreen } from './screens/CompleteScreen'
import { LevelScreen } from './screens/LevelScreen'
import { NameScreen } from './screens/NameScreen'
import { RunScreen } from './screens/RunScreen'
import { SelectScreen } from './screens/SelectScreen'
import {
  loadMuted,
  loadProfile,
  loadSession,
  saveMuted,
  saveProfile,
  saveSession,
  type Profile,
  type RunSession,
} from './storage'
import { releaseWakeLock } from './wakeLock'
import {
  resolveWorkout,
  type RunnerLevel,
  type WorkoutId,
} from './workouts'

type View = 'name' | 'level' | 'select' | 'run' | 'complete'

function initialView(profile: Partial<Profile>, session: RunSession | null): View {
  if (session && !session.completed) return 'run'
  if (session?.completed) return 'complete'
  if (!profile.name) return 'name'
  if (!profile.level) return 'level'
  return 'select'
}

export default function App() {
  const quick = new URLSearchParams(window.location.search).has('quick')
  const [profile, setProfile] = useState<Partial<Profile>>(loadProfile)
  const [session, setSession] = useState<RunSession | null>(loadSession)
  const [muted, setMuted] = useState(loadMuted)
  const [view, setView] = useState<View>(() =>
    initialView(loadProfile(), loadSession()),
  )
  const completingRef = useRef(false)

  const workoutId = session?.workoutId
  const workout = useMemo(() => {
    if (!workoutId || !profile.level) return null
    return resolveWorkout(workoutId, profile.level, quick)
  }, [workoutId, profile.level, quick])

  function persistProfile(next: Profile) {
    setProfile(next)
    saveProfile(next)
  }

  function persistSession(next: RunSession | null) {
    setSession(next)
    saveSession(next)
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
    setView('select')
  }

  return (
    <main className="shell">
      {view === 'name' ? (
        <NameScreen
          initialName={profile.name ?? ''}
          onContinue={(name) => {
            persistProfile({
              name,
              level: profile.level ?? 'intermediate',
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
            persistProfile({ name: profile.name!, level })
            setView('select')
          }}
        />
      ) : null}

      {view === 'select' && profile.name && profile.level ? (
        <SelectScreen
          name={profile.name}
          level={profile.level}
          quick={quick}
          onChangeLevel={() => setView('level')}
          onPick={(id: WorkoutId) => {
            persistSession({
              workoutId: id,
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
          onSession={persistSession}
          onComplete={handleComplete}
          onQuit={quitRun}
          onToggleMute={() => {
            const next = !muted
            setMuted(next)
            saveMuted(next)
          }}
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
            setView('select')
          }}
        />
      ) : null}
    </main>
  )
}
