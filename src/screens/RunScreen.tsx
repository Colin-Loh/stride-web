import { useEffect, useMemo, useRef, useState } from 'react'
import { startCue, setCueMuted, stopCue, playTransitionChime } from '../audio'
import { formatDuration, formatKm, formatPaceRange, formatSpeedRange } from '../format'
import { elapsedMs, type RunSession } from '../storage'
import { requestWakeLock, releaseWakeLock } from '../wakeLock'
import type { ResolvedWorkout } from '../workouts'

interface Props {
  workout: ResolvedWorkout
  session: RunSession
  muted: boolean
  onSession: (session: RunSession) => void
  onComplete: () => void
  onQuit: () => void
  onToggleMute: () => void
}

function progressFor(workout: ResolvedWorkout, elapsed: number) {
  let remaining = elapsed
  let index = 0
  for (const segment of workout.segments) {
    if (remaining < segment.durationMs) {
      return {
        index,
        segmentElapsed: remaining,
        segmentProgress: remaining / segment.durationMs,
        overall: elapsed / workout.totalDurationMs,
        done: false,
      }
    }
    remaining -= segment.durationMs
    index += 1
  }
  return {
    index: workout.segments.length - 1,
    segmentElapsed: workout.segments.at(-1)?.durationMs ?? 0,
    segmentProgress: 1,
    overall: 1,
    done: true,
  }
}

export function RunScreen({
  workout,
  session,
  muted,
  onSession,
  onComplete,
  onQuit,
  onToggleMute,
}: Props) {
  const [now, setNow] = useState(() => Date.now())
  const elapsed = elapsedMs(session, now)
  const progress = useMemo(
    () => progressFor(workout, elapsed),
    [workout, elapsed],
  )
  const current = workout.segments[progress.index]
  const next = workout.segments[progress.index + 1]
  const previousSegment = useRef(progress.index)

  useEffect(() => {
    const changed = progress.index > previousSegment.current
    previousSegment.current = progress.index
    if (changed && !progress.done && session.startedAt && !session.paused && !session.completed) {
      playTransitionChime(muted)
    }
  }, [progress.index, progress.done, session.startedAt, session.paused, session.completed, muted])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (progress.done && !session.paused && session.startedAt) {
      onComplete()
    }
  }, [progress.done, session.paused, session.startedAt, onComplete])

  useEffect(() => {
    const running = Boolean(session.startedAt) && !session.paused && !session.completed
    if (!running) {
      void releaseWakeLock()
      stopCue()
      return
    }

    void requestWakeLock()
    void startCue(muted)

    const onVisibility = () => {
      setNow(Date.now())
      if (document.visibilityState === 'visible') {
        void requestWakeLock()
        void startCue(muted)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onLeave)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', onLeave)
    }
  }, [session.startedAt, session.paused, session.completed, muted])

  useEffect(() => {
    setCueMuted(muted)
  }, [muted])

  const remaining = Math.max(0, workout.totalDurationMs - elapsed)
  const segmentRemaining = Math.max(0, current.durationMs - progress.segmentElapsed)

  function start() {
    const started: RunSession = {
      workoutId: workout.id,
      startedAt: Date.now(),
      pausedMs: 0,
      paused: false,
      completed: false,
    }
    onSession(started)
    void requestWakeLock()
    void startCue(muted)
  }

  function pause() {
    onSession({
      ...session,
      paused: true,
      pauseStartedAt: Date.now(),
    })
    void releaseWakeLock()
    stopCue()
  }

  function resume() {
    const extra = session.pauseStartedAt
      ? Date.now() - session.pauseStartedAt
      : 0
    onSession({
      ...session,
      paused: false,
      pausedMs: session.pausedMs + extra,
      pauseStartedAt: undefined,
    })
    void requestWakeLock()
    void startCue(muted)
  }

  const notStarted = !session.startedAt

  return (
    <section className="card run">
      <p className="eyebrow">{workout.name}</p>
      <h1>{current.label}</h1>
      <p className="lede">
        {formatKm(current.distanceKm)} ·{' '}
        {formatSpeedRange(current.speed.minKmh, current.speed.maxKmh)} ·{' '}
        {formatPaceRange(current.speed.minKmh, current.speed.maxKmh)} min/km
      </p>

      <div className="timer">{formatDuration(elapsed)}</div>
      <p className="muted">
        {notStarted
          ? `Ready · ${formatDuration(workout.totalDurationMs)} total`
          : session.paused
            ? 'Paused'
            : `${formatDuration(remaining)} remaining`}
      </p>

      <label className="progress-label">Overall</label>
      <div
        className="bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress.overall * 100)}
      >
        <span style={{ width: `${Math.min(100, progress.overall * 100)}%` }} />
      </div>

      <label className="progress-label">
        {current.label} · {formatDuration(segmentRemaining)} left
      </label>
      <div
        className="bar segment"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress.segmentProgress * 100)}
      >
        <span
          style={{ width: `${Math.min(100, progress.segmentProgress * 100)}%` }}
        />
      </div>

      <ol className="milestones">
        {workout.segments.map((segment, index) => {
          const state =
            index < progress.index || progress.done
              ? 'done'
              : index === progress.index
                ? 'current'
                : 'upcoming'
          return (
            <li key={segment.kind} className={state}>
              {segment.label}
            </li>
          )
        })}
      </ol>

      {next && !progress.done ? (
        <p className="next">Next: {next.label}</p>
      ) : null}

      <div className="actions">
        {notStarted ? (
          <button type="button" className="primary" onClick={start}>
            Start run
          </button>
        ) : session.paused ? (
          <button type="button" className="primary" onClick={resume}>
            Resume
          </button>
        ) : (
          <button type="button" className="primary" onClick={pause}>
            Pause
          </button>
        )}
        <button type="button" className="ghost" onClick={onToggleMute}>
          {muted ? 'Unmute cue' : 'Mute cue'}
        </button>
        <button type="button" className="link" onClick={onQuit}>
          End run
        </button>
      </div>
    </section>
  )
}
