import { formatDurationMs } from '../format'
import { RunnerSprite } from '../RunnerSprite'
import type { Character } from '../domain/preferences'
import type { RunSession } from '../domain/types'
import type { RunProgress } from '../run/engine'
import { intervalCount } from '../plan/intervals'
import { useRunSession } from '../hooks/useRunSession'
import { useRunAudio } from '../hooks/useRunAudio'
import { MAX_SPEED, MIN_SPEED } from '../plan/convert'

interface Props {
  session: RunSession; muted: boolean; character: Character
  onSession: (session: RunSession) => void; onComplete: (result: RunProgress) => void
  onQuit: () => void; onToggleMute: () => void
}
export function RunScreen({ session, muted, character, onSession, onComplete, onQuit, onToggleMute }: Props) {
  const { running, progress, remaining, sectionRemaining, start, pause, resume, adjustSpeed } = useRunSession(session, onSession, onComplete)
  const current = session.plan.sections[progress.index]
  const next = session.plan.sections[progress.index + 1]
  const mix = current.runWalk
  const working = progress.phase === 'run'
  const phaseLabel = mix ? (working ? mix.runLabel ?? 'Run' : mix.walkLabel ?? 'Walk') : ''
  const reps = mix && current.target.basis === 'time'
    ? intervalCount(current.target.durationSeconds, mix.runSeconds, mix.walkSeconds)
    : 0
  const repLabel = reps ? `${phaseLabel} ${Math.min(progress.cycle + 1, reps)} of ${reps}` : ''
  useRunAudio(running, muted, progress.phaseKey, progress.done)
  return <section className="card run">
    <p className="eyebrow">{session.plan.categoryName}</p>
    <h1>{current.label}{phaseLabel ? ` · ${phaseLabel}` : ''}</h1>
    <div className="stats">
      <div className="stat"><span className="stat-label">Estimated km</span><strong className="stat-value">{progress.distanceKm === null ? 'Unknown' : progress.distanceKm.toFixed(2)}</strong></div>
      <div className="stat"><span className="stat-label">Time left</span><strong className="stat-value">{formatDurationMs(remaining)}</strong></div>
      <div className="stat"><span className="stat-label">Speed km/h</span><strong className="stat-value">{progress.speed?.toFixed(1) ?? 'By effort'}</strong></div>
    </div>
    <div className="stat-line" role="progressbar" aria-label="Overall section progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.overall * 100)}><span style={{ width: `${progress.overall * 100}%` }} /></div>
    <RunnerSprite character={character} state={running ? 'running' : 'idle'} speedKmh={progress.speed ?? undefined} health={session.healthAtStart ?? 'healthy'} />
    <p className="muted">{!session.startedAt ? 'Ready' : session.paused ? 'Paused' : `${formatDurationMs(progress.elapsedMs)} active time`}</p>
    {repLabel && <p className="muted">{repLabel}</p>}
    <label className="progress-label">{current.label} · {formatDurationMs(sectionRemaining)} left</label>
    <div className="bar segment" role="progressbar" aria-label={`${current.label} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.segmentProgress * 100)}><span style={{ width: `${progress.segmentProgress * 100}%` }} /></div>
    <ol className="milestones">{session.plan.sections.map((s, i) => <li key={s.id} className={i < progress.index ? 'done' : i === progress.index ? 'current' : 'upcoming'}>{s.label}</li>)}</ol>
    {next && <p className="next">Next section: {next.label}</p>}
    <div className="actions">
      <button type="button" className="primary" onClick={!session.startedAt ? start : session.paused ? resume : pause}>{!session.startedAt ? 'Start run' : session.paused ? 'Resume' : 'Pause'}</button>
      {progress.speed !== null && <>
        <div className="speed-adjust" role="group" aria-label="Treadmill speed">
          <button type="button" className="step" aria-label="Decrease treadmill speed" disabled={progress.speed <= MIN_SPEED} onClick={() => adjustSpeed(-0.1)}>−</button>
          <span className="speed-value" aria-live="polite">{progress.speed.toFixed(1)} km/h</span>
          <button type="button" className="step" aria-label="Increase treadmill speed" disabled={progress.speed >= MAX_SPEED} onClick={() => adjustSpeed(0.1)}>+</button>
        </div>
      </>}
      <button type="button" className="ghost" onClick={onToggleMute}>{muted ? 'Unmute sounds' : 'Mute sounds'}</button>
      <button type="button" className="link" onClick={onQuit}>End run</button>
    </div>
  </section>
}
