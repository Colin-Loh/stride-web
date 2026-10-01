import { useState } from 'react'
import { playCelebration } from '../audio'
import { formatDuration } from '../format'
import type { RunSession } from '../storage'
interface Props { name: string; session: RunSession; onAgain: () => void }
export function CompleteScreen({ name, session, onAgain }: Props) {
  const [audioError, setAudioError] = useState(false)
  return <section className="card complete">
    <p className="eyebrow">Session complete</p><h1>You did it, {name}.</h1>
    <p className="lede">{session.plan.categoryName} · {formatDuration(session.result?.elapsedMs ?? 0)} active time · {session.result?.distanceKm == null ? 'Distance unknown' : `${session.result.distanceKm.toFixed(2)} km estimated`}</p>
    <p className="celebrate">Warm-up, running, and cool-down — all in.</p>
    <button type="button" className="ghost" onClick={async () => setAudioError(!(await playCelebration()))}>Play celebration</button>
    {audioError && <p role="status">Audio could not play. Try Play celebration again.</p>}
    <button type="button" className="primary" onClick={onAgain}>Back to workouts</button>
  </section>
}
