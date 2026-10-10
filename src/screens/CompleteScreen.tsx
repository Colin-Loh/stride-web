import { useMemo, useState } from 'react'
import { playCelebration } from '../audio'
import { DanceSprite } from '../DanceSprite'
import { SectionTable, SpeedChart, ZoneBar } from '../dashboard/Charts'
import { formatClock, formatKcal, formatKm, formatPace, formatSpeed } from '../dashboard/format'
import { summarizeRun } from '../dashboard/summary'
import { CHARACTER_NAMES, type Character } from '../domain/preferences'
import type { RunSession } from '../domain/types'
import { ShareButton } from '../share/ShareButton'

interface Props {
  name: string
  session: RunSession
  character: Character
  /** Body weight in kg, or null when the runner has not given one. */
  weightKg: number | null
  onAgain: () => void
}

export function CompleteScreen({ name, session, character, weightKg, onAgain }: Props) {
  const [audioError, setAudioError] = useState(false)
  const [includeCalories, setIncludeCalories] = useState(false)
  const summary = useMemo(() => summarizeRun(session, weightKg), [session, weightKg])
  const allDone = summary.sectionsDone >= summary.sectionsPlanned
  const noDistance = summary.distanceKm === null || summary.distanceKm <= 0
  return <section className="card complete">
    <div className="complete-head">
      <div>
        <p className="eyebrow">Session complete</p>
        <h1>{allDone ? `You did it, ${name}.` : `Session finished, ${name}.`}</h1>
        <p className="muted">{session.plan.categoryName} · {CHARACTER_NAMES[character]} is cheering you on.</p>
      </div>
      <DanceSprite character={character} />
    </div>

    <div className="hero" aria-live="polite">
      <strong>{formatKm(summary.distanceKm)}</strong><span className="unit">km</span>
      <p className="muted">{noDistance ? 'Distance unknown: a section had no speed set.' : 'Estimated from logged treadmill settings'}</p>
    </div>

    <dl className="stat-tiles">
      <div className="tile"><dt>Active time</dt><dd>{formatClock(summary.activeSeconds)}</dd></div>
      <div className="tile"><dt>Avg pace</dt><dd>{formatPace(summary.paceSecondsPerKm)} <small>min/km</small></dd></div>
      <div className="tile"><dt>Active energy</dt>
        {summary.kcal === null
          ? <dd className="empty">{weightKg === null ? 'Add your weight to see calories' : 'No calories for this run'}</dd>
          : <dd>{formatKcal(summary.kcal)} <small>kcal</small></dd>}
      </div>
      <div className="tile"><dt>Sections finished</dt><dd>{summary.sectionsDone} <small>/ {summary.sectionsPlanned}</small></dd></div>
    </dl>
    <p className="secondary muted">
      <span>Avg set speed {formatSpeed(summary.averageKmh)} km/h</span>
      <span>{summary.pausedSeconds > 0 ? `Paused ${formatClock(summary.pausedSeconds)}` : 'No pauses'}</span>
    </p>
    {summary.kcal === null && weightKg === null ? <p className="muted">Open Change name or weight on the workout list to add it.</p> : null}

    <details>
      <summary>How are these estimated?</summary>
      <p className="muted">
        Distance adds up each set speed over the time it was set, not GPS or measured belt movement. Pace is active time over that distance.
        Calories are about 1 kcal per kg per km for level running, active energy only, so slow running and treadmill calibration add uncertainty.
        Your weight stays on this device and is not on the picture.
      </p>
    </details>

    <h2>Your session rhythm</h2>
    <p className="muted">Set speed (km/h) over active time. Dashed: the plan, where you changed the speed.</p>
    <SpeedChart summary={summary} />

    <h2>Time by prescribed zone</h2>
    <p className="muted">Plan labels, not measured heart-rate zones.</p>
    <ZoneBar summary={summary} />

    <h2>Section recap</h2>
    <SectionTable summary={summary} />

    <ShareButton onIncludeCalories={setIncludeCalories}
      data={{ name, sessionName: session.plan.categoryName, character, summary, includeCalories: includeCalories && summary.kcal !== null }} />

    <button type="button" className="ghost" onClick={async () => setAudioError(!(await playCelebration()))}>Play celebration</button>
    {audioError && <p role="status">Audio could not play. Try Play celebration again.</p>}
    <button type="button" className="primary" onClick={onAgain}>Back to workouts</button>
  </section>
}
