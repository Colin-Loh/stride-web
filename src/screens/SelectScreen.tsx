import {
  formatDuration,
  formatKm,
  formatPaceRange,
  formatSpeedRange,
} from '../format'
import { LEVELS, WORKOUTS, resolveWorkout, type RunnerLevel, type WorkoutId } from '../workouts'

interface Props {
  name: string
  level: RunnerLevel
  quick: boolean
  onPick: (id: WorkoutId) => void
  onChangeLevel: () => void
}

export function SelectScreen({
  name,
  level,
  quick,
  onPick,
  onChangeLevel,
}: Props) {
  return (
    <section className="card">
      <p className="eyebrow">
        Hi {name} · {LEVELS[level].label}
      </p>
      <h1>Pick today&apos;s run</h1>
      <p className="lede">
        Warm-up, a steady section, then cool-down. Paces are shown as km/h and
        min/km.
      </p>
      <div className="stack">
        {WORKOUTS.map((workout) => {
          const resolved = resolveWorkout(workout.id, level, quick)
          return (
            <button
              key={workout.id}
              type="button"
              className="choice workout"
              onClick={() => onPick(workout.id)}
            >
              <strong>{workout.name}</strong>
              <span className="muted">
                {formatKm(resolved.totalDistanceKm)} · about{' '}
                {formatDuration(resolved.totalDurationMs)}
              </span>
              <span>{workout.blurb}</span>
              <ul className="preview">
                {resolved.segments.map((segment) => (
                  <li key={segment.kind}>
                    <em>{segment.label}</em>{' '}
                    {segment.fixedDurationMs !== undefined
                      ? `${segment.durationMs / 1000} seconds`
                      : formatKm(segment.distanceKm)} ·{' '}
                    {formatSpeedRange(segment.speed.minKmh, segment.speed.maxKmh)}{' '}
                    · {formatPaceRange(segment.speed.minKmh, segment.speed.maxKmh)}{' '}
                    min/km
                  </li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>
      <button type="button" className="link" onClick={onChangeLevel}>
        Change experience level
      </button>
    </section>
  )
}
