import type { RunnerLevel, WorkoutId } from './workouts'

const PROFILE_KEY = 'stride.profile'
const SESSION_KEY = 'stride.session'
const MUTED_KEY = 'stride.muted'

export interface Profile {
  name: string
  level: RunnerLevel
}

export interface RunSession {
  workoutId: WorkoutId
  startedAt: number
  pausedMs: number
  paused: boolean
  pauseStartedAt?: number
  completed: boolean
}

export function loadProfile(): Partial<Profile> {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? (JSON.parse(raw) as Partial<Profile>) : {}
  } catch {
    return {}
  }
}

export function saveProfile(profile: Profile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

export function loadSession(): RunSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as RunSession) : null
  } catch {
    return null
  }
}

export function saveSession(session: RunSession | null): void {
  if (!session) {
    localStorage.removeItem(SESSION_KEY)
    return
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function loadMuted(): boolean {
  return localStorage.getItem(MUTED_KEY) === '1'
}

export function saveMuted(muted: boolean): void {
  localStorage.setItem(MUTED_KEY, muted ? '1' : '0')
}

export function elapsedMs(session: RunSession, now = Date.now()): number {
  if (!session.startedAt) return 0
  const currentPause =
    session.paused && session.pauseStartedAt
      ? now - session.pauseStartedAt
      : 0
  return Math.max(0, now - session.startedAt - session.pausedMs - currentPause)
}
