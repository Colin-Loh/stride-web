import { formatDuration, formatKm } from '../format'
import type { ResolvedWorkout } from '../workouts'

interface Props {
  name: string
  workout: ResolvedWorkout
  onAgain: () => void
}

export function CompleteScreen({ name, workout, onAgain }: Props) {
  const [audioError, setAudioError] = useState(false)
  return (
    <section className="card complete">
      <p className="eyebrow">Session complete</p>
      <h1>You did it, {name}.</h1>
      <p className="lede">
        {workout.name} · {formatKm(workout.totalDistanceKm)} ·{' '}
        {formatDuration(workout.totalDurationMs)} at prescribed pace.
      </p>
      <p className="celebrate">Warm-up, steady, and cool-down — all in.</p>
      <button type="button" className="ghost" onClick={async () => {
        setAudioError(!(await playCelebration()))
      }}>
        Play celebration
      </button>
      {audioError && <p role="status">Audio could not play. Try Play celebration again.</p>}
      <button type="button" className="primary" onClick={onAgain}>
        Back to workouts
      </button>
    </section>
  )
}
import { useState } from 'react'
import { playCelebration } from '../audio'
