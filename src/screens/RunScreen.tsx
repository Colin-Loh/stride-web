import { useEffect, useMemo, useRef, useState } from 'react'
import { prepareRunAudio, setCueMuted, stopCue, playTransitionChime } from '../audio'
import { formatDuration } from '../format'
import { RunnerSprite } from '../RunnerSprite'
import { elapsedMs, type Character, type RunSession } from '../storage'
import { requestWakeLock, releaseWakeLock } from '../wakeLock'
import type { ResolvedWorkout } from '../workouts'

interface Props {
  workout: ResolvedWorkout
  session: RunSession
  muted: boolean
  character: Character
  onSession: (session: RunSession) => void
  onComplete: () => void
  onQuit: () => void
}

const SPEED_STEP = 0.1
const MIN_SPEED_KMH = 0.5
const MAX_SPEED_KMH = 25

/** A speed the runner held from `at` (ms into the run) until the next mark. */
interface SpeedMark {
  at: number
  kmh: number
}

function clampSpeed(kmh: number): number {
  return Math.min(MAX_SPEED_KMH, Math.max(MIN_SPEED_KMH, Math.round(kmh * 10) / 10))
}

function coveredKmFrom(marks: SpeedMark[], elapsed: number): number {
  let km = 0
  for (let i = 0; i < marks.length; i += 1) {
    const start = marks[i].at
    const end = Math.min(elapsed, marks[i + 1]?.at ?? elapsed)
    if (end > start) {
      km += (marks[i].kmh * (end - start)) / 3_600_000
    }
  }
  return km
}

function progressFor(workout: ResolvedWorkout, coveredKm: number) {
  let start = 0
  let index = 0
  for (let i = 0; i < workout.segments.length; i += 1) {
    index = i
    const end = start + workout.segments[i].distanceKm
    if (coveredKm < end) break
    if (i < workout.segments.length - 1) start = end
  }
  const segment = workout.segments[index]
  const segmentCoveredKm = Math.min(
    Math.max(0, coveredKm - start),
    segment.distanceKm,
  )
  return {
    index,
    segmentRemainingKm: segment.distanceKm - segmentCoveredKm,
    segmentProgress:
      segment.distanceKm > 0 ? segmentCoveredKm / segment.distanceKm : 1,
    overall: Math.min(1, coveredKm / workout.totalDistanceKm),
    done: coveredKm >= workout.totalDistanceKm,
  }
}

export function RunScreen({
  workout,
  session,
  muted,
  character,
  onSession,
  onComplete,
  onQuit,
}: Props) {
  const [now, setNow] = useState(() => Date.now())
  // Treadmill trim: offset in km/h applied on top of the segment's target speed.
  const [speedOffset, setSpeedOffset] = useState(0)
  const elapsed = elapsedMs(session, now)

  const [speedMarks, setSpeedMarks] = useState<SpeedMark[]>(() => [
    { at: 0, kmh: clampSpeed(workout.segments[0].speed.minKmh) },
  ])

  const coveredKm = coveredKmFrom(speedMarks, elapsed)
  const progress = useMemo(
    () => progressFor(workout, coveredKm),
    [workout, coveredKm],
  )
  const current = workout.segments[progress.index]
  const next = workout.segments[progress.index + 1]
  const previousSegment = useRef(progress.index)
  const targetSpeed = clampSpeed(current.speed.minKmh + speedOffset)
  const running =
    Boolean(session.startedAt) && !session.paused && !session.completed

  const live = useRef({ elapsed, speed: targetSpeed })

  useEffect(() => {
    live.current = { elapsed, speed: targetSpeed }
  }, [elapsed, targetSpeed])

  useEffect(() => {
    setSpeedMarks([{ at: 0, kmh: live.current.speed }])
  }, [session.startedAt])

  useEffect(() => {
    setSpeedMarks((marks) => {
      const last = marks[marks.length - 1]
      if (last && last.kmh === targetSpeed) {
        return marks
      }
      return [...marks, { at: live.current.elapsed, kmh: targetSpeed }]
    })
  }, [targetSpeed])

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
    if (!running) {
      void releaseWakeLock()
      stopCue()
      return
    }

    void requestWakeLock()
    prepareRunAudio()

    const onVisibility = () => {
      setNow(Date.now())
      if (document.visibilityState === 'visible') {
        void requestWakeLock()
        prepareRunAudio()
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
  }, [running])

  useEffect(() => {
    setCueMuted(muted)
  }, [muted])

  // Time left is an ETA: whatever distance is left, at the speed set right now.
  const msPerKm = 3_600_000 / targetSpeed
  const remaining = Math.max(0, workout.totalDistanceKm - coveredKm) * msPerKm
  const segmentRemaining = progress.segmentRemainingKm * msPerKm

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
    prepareRunAudio()
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
    prepareRunAudio()
  }

  const notStarted = !session.startedAt

  const segmentTitle = current.label.replace(/-/g, ' ').toUpperCase()

  function adjustSpeed(delta: number) {
    setSpeedOffset((offset) => {
      const clamped = clampSpeed(current.speed.minKmh + offset + delta)
      return Math.round((clamped - current.speed.minKmh) * 10) / 10
    })
  }

  return (
    <section className="card run">
      <p className="eyebrow">{workout.name}</p>
      <h1>
        {targetSpeed.toFixed(1)} km {segmentTitle}
      </h1>
      <div className="stats">
        <div className="stat">
          <span className="stat-label">Distance</span>
          <strong className="stat-value">
            {coveredKm.toFixed(2)}
            <em>/ {workout.totalDistanceKm.toFixed(1)} km</em>
          </strong>
        </div>
        <div className="stat">
          <span className="stat-label">Time left</span>
          <strong className="stat-value">{formatDuration(remaining)}</strong>
        </div>
        <div className="stat">
          <span className="stat-label">Speed</span>
          <strong className="stat-value">
            {targetSpeed.toFixed(1)}
            <em>km/h</em>
          </strong>
        </div>
      </div>
      <div
        className="stat-line"
        role="progressbar"
        aria-label="Run progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress.overall * 100)}
      >
        <span style={{ width: `${Math.min(100, progress.overall * 100)}%` }} />
      </div>

      <RunnerSprite
        character={character}
        state={running ? 'running' : 'idle'}
        speedKmh={targetSpeed}
      />
      <p className="muted">
        {notStarted
          ? `Ready · ${formatDuration(remaining)} at this speed`
          : session.paused
            ? 'Paused'
            : `${formatDuration(elapsed)} elapsed`}
      </p>

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
        <div className="speed-adjust" role="group" aria-label="Treadmill speed">
          <button
            type="button"
            className="step"
            onClick={() => adjustSpeed(-SPEED_STEP)}
            disabled={targetSpeed <= MIN_SPEED_KMH}
            aria-label="Decrease treadmill speed"
          >
            −
          </button>
          <span className="speed-value" aria-live="polite">
            {targetSpeed.toFixed(1)} km
          </span>
          <button
            type="button"
            className="step"
            onClick={() => adjustSpeed(SPEED_STEP)}
            disabled={targetSpeed >= MAX_SPEED_KMH}
            aria-label="Increase treadmill speed"
          >
            +
          </button>
        </div>
        <button type="button" className="link" onClick={onQuit}>
          End run
        </button>
      </div>
    </section>
  )
}
