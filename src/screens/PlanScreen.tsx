import { useState } from 'react'
import type { Session, SessionKind, TrainingPlan } from '../domain/types'
import { formatDurationSeconds, formatPaceSeconds, formatSpan } from '../plan/convert'
import { currentWeekIndex } from '../plan/dates'
import { calculateWorkoutTotals } from '../plan/metrics'
import { RACE_DISTANCES, type Zone } from '../plan/vdot'
import { WORKOUT_NAMES } from '../workouts'

const SESSION_ZONES: Record<SessionKind, Zone> = {
    long: 'E',
    easyRun: 'E',
    threshold: 'T',
    interval: 'I',
    repetition: 'R',
    marathon: 'M',
}

const PACE_DESCRIPTIONS: Record<Zone, string> = {
    E: 'Builds aerobic fitness and supports recovery.',
    M: 'Practise marathon effort at your current fitness.',
    T: 'Improves sustained, comfortably hard running.',
    I: 'Builds aerobic power with hard intervals.',
    R: 'Develops speed and running economy.',
}

interface Props {
    plan: TrainingPlan
    onOpenSession: (sessionId: string) => void
    /** The day to treat as today; defaults to now. */
    today?: Date
}

function sessionSummary(session: Session): string {
    const totals = calculateWorkoutTotals(session.sections)
    if (totals.distanceKm !== null) return `Dist: ${totals.distanceKm.toFixed(1)} km`
    return totals.durationSeconds === null ? 'By effort' : `Duration: ${formatSpan(totals.durationSeconds)}`
}

/** The training plan: the runner's fitness summary, then every week with its sessions and paces. */
export function PlanScreen({ plan, onOpenSession, today = new Date() }: Props) {
    const current = currentWeekIndex(plan.startDate, plan.weeks.length, today)
    const visibleNotes = plan.notes.filter((line) =>
        !/gives a VDOT of|caps the long run|other runs are longer than your long run/i.test(line),
    )
    const race = plan.baseline.race
    const raceLabel = race
        ? RACE_DISTANCES.find((item) => Math.abs(item.km - race.distanceKm) < 1e-9)?.label ?? `${race.distanceKm} km`
        : null
    // Only the current week starts open. Before the plan starts or after it ends, currentWeekIndex
    // clamps to week 1 or the last week, which are the open weeks the plan calls for.
    const [expanded, setExpanded] = useState<Set<number>>(() => new Set([current]))
    const toggle = (index: number) => setExpanded((open) => {
        const next = new Set(open)
        if (next.has(index)) next.delete(index)
        else next.add(index)
        return next
    })
    return (
        <section className="card">
            <p className="eyebrow">Training plan · {plan.weeks.length} weeks</p>
            <h1>Your plan</h1>

            {race && raceLabel ? (
                <p>
                    Based on your <strong>{raceLabel} time of {formatDurationSeconds(race.seconds)}</strong>, here&apos;s your estimated running fitness and recommended training paces.
                </p>
            ) : (
                <p>
                    Based on your reported easy pace, here&apos;s your current running fitness. A race or time trial is needed to estimate VDOT training paces.
                </p>
            )}
            <h3>Your Current Fitness</h3>
            <ul className="fitness-facts">
                {race && raceLabel ? (
                    <>
                        <li><strong>{raceLabel} time:</strong> {formatDurationSeconds(race.seconds)}</li>
                        <li><strong>Average pace:</strong> {formatPaceSeconds(Math.round(race.seconds / race.distanceKm))} min/km</li>
                        <li><strong>Estimated VDOT:</strong> {plan.baseline.vdot?.toFixed(1) ?? 'Unavailable'}</li>
                    </>
                ) : (
                    <>
                        <li><strong>Reported easy pace:</strong> {plan.baseline.reportedEasySpeedKmh === null ? 'Not provided' : `${formatPaceSeconds(Math.round(3600 / plan.baseline.reportedEasySpeedKmh))} min/km`}</li>
                        <li><strong>Estimated VDOT:</strong> Unavailable without a race or time trial</li>
                    </>
                )}
            </ul>

            {visibleNotes.length > 0 ? (
                <div className="notice">
                    <ul className="plan-notes">
                        {visibleNotes.map((line) => (<li key={line}>{line}</li>))}
                    </ul>
                </div>
            ) : null}

            <h2>Week by week</h2>
            <ol className="weeks">
                {plan.weeks.map((week, index) => {
                    const open = expanded.has(index)
                    const state = open ? 'expanded' : 'collapsed'
                    return (
                        <li key={week.id} className={`week${index === current ? ' current' : ''}${open ? '' : ' is-collapsed'}`} aria-current={index === current ? 'date' : undefined}>
                            <h3>
                                <button
                                    type="button"
                                    className="week-toggle"
                                    aria-expanded={open}
                                    aria-controls={`plan-week-${week.number}`}
                                    aria-label={`Week ${week.number}, ${week.targetKm.toFixed(1)} km, ${state}`}
                                    onClick={() => toggle(index)}
                                >
                                    Week {week.number} · {week.targetKm.toFixed(1)} km
                                    {week.taper ? <span className="week-badge taper">Taper</span> : null}
                                    {index === current ? <span className="week-badge">This week</span> : null}
                                </button>
                            </h3>
                            <p className="muted">Starts {week.startDate}</p>
                            <div id={`plan-week-${week.number}`} hidden={!open}>
                                {open ? (
                                    <div className="stack">
                                        {week.sessions.map((session) => {
                                            const zone = SESSION_ZONES[session.kind]
                                            const pace = plan.paces.zones[zone]
                                            return (
                                                <button key={session.id} type="button" className="choice workout" data-zone={zone} onClick={() => onOpenSession(session.id)}>
                                                    <span className="session-workout">
                                                        <strong>{WORKOUT_NAMES[session.kind]}</strong>
                                                        <span className="muted">{sessionSummary(session)}</span>
                                                    </span>
                                                    <span className="session-pace">
                                                        {pace ? (
                                                            <>
                                                                <span className="session-pace-value">Pace: {formatPaceSeconds(pace.paceSecondsPerKm)} min/km</span>
                                                                <span className="session-pace-speed">Treadmill: {pace.speedKmh.toFixed(1)}km/h</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className="session-pace-value">Pace: Run by effort</span>
                                                                <span className="session-pace-speed">Treadmill: unavailable</span>
                                                                <span className="muted">Add a race result to estimate pace.</span>
                                                            </>
                                                        )}
                                                    </span>
                                                    <span className="session-purpose">{PACE_DESCRIPTIONS[zone]}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                ) : null}
                            </div>
                        </li>
                    )
                })}
            </ol>

        </section>
    )
}
