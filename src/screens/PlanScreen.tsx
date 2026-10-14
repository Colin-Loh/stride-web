import { useState } from 'react'
import type { SessionKind, TrainingPlan } from '../domain/types'
import { formatDurationSeconds, formatPaceSeconds, formatSpan } from '../plan/convert'
import { currentWeekIndex } from '../plan/dates'
import { calculateWorkoutTotals } from '../plan/metrics'
import { RACE_DISTANCES, type Zone } from '../plan/vdot'
import { WORKOUT_NAMES } from '../workouts'
import durationIcon from '../assets/duration.png'
import paceIcon from '../assets/pace.png'
import treadmillIcon from '../assets/treadmill.png'

const SESSION_ZONES: Record<SessionKind, Zone> = {
    long: 'E',
    easyRun: 'E',
    threshold: 'T',
    interval: 'I',
    repetition: 'R',
    marathon: 'M',
}

type MetricIconKind = 'duration' | 'pace' | 'treadmill'

const METRIC_ICONS: Record<MetricIconKind, string> = {
    duration: durationIcon,
    pace: paceIcon,
    treadmill: treadmillIcon,
}

function PixelMetricIcon({ kind }: { kind: MetricIconKind }) {
    return <img className="session-pixel-icon" src={METRIC_ICONS[kind]} alt="" aria-hidden="true" />
}

interface Props {
    plan: TrainingPlan
    onOpenSession: (sessionId: string) => void
    /** The day to treat as today; defaults to now. */
    today?: Date
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
    const otherWeeksExpanded = plan.weeks.every((_, index) => index === current || expanded.has(index))
    const toggle = (index: number) => setExpanded((open) => {
        const next = new Set(open)
        if (next.has(index)) next.delete(index)
        else next.add(index)
        return next
    })
    const toggleOtherWeeks = () => setExpanded((open) => {
        const expand = plan.weeks.some((_, index) => index !== current && !open.has(index))
        const next = new Set(open).add(current)
        plan.weeks.forEach((_, index) => {
            if (index === current) return
            if (expand) next.add(index)
            else next.delete(index)
        })
        return next
    })
    return (
        <section className="card">
            <p className="eyebrow">Training plan · {plan.weeks.length} weeks</p>
            <h1 className="plan-screen-title">YOUR PLAN</h1>

            <ul className="fitness-facts">
                {race && raceLabel ? (
                    <>
                        <li><strong>{raceLabel} time:</strong> <span className="fitness-value">{formatDurationSeconds(race.seconds)}</span></li>
                        <li><strong>Average pace:</strong> <span className="fitness-value">{formatPaceSeconds(Math.round(race.seconds / race.distanceKm))} min/km</span></li>
                        <li><strong>Estimated VDOT:</strong> <span className="fitness-value">{plan.baseline.vdot?.toFixed(1) ?? 'Unavailable'}</span></li>
                    </>
                ) : (
                    <>
                        <li><strong>Reported easy pace:</strong> <span className="fitness-value">{plan.baseline.reportedEasySpeedKmh === null ? 'Not provided' : `${formatPaceSeconds(Math.round(3600 / plan.baseline.reportedEasySpeedKmh))} min/km`}</span></li>
                        <li><strong>Estimated VDOT:</strong> <span className="fitness-value">Unavailable without a race or time trial</span></li>
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

            <button
                type="button"
                className="ghost week-toggle-all"
                aria-label={`${otherWeeksExpanded ? 'Collapse' : 'Expand'} all weeks except this week`}
                onClick={toggleOtherWeeks}
            >
                {otherWeeksExpanded ? 'Collapse all other weeks' : 'Expand all other weeks'}
            </button>
            <ol className="weeks">
                {plan.weeks.map((week, index) => {
                    const open = expanded.has(index)
                    const state = open ? 'expanded' : 'collapsed'
                    return (
                        <li key={week.id} className={`week${index === current ? ' current' : ''}${open ? '' : ' is-collapsed'}`} aria-current={index === current ? 'date' : undefined}>
                            <h3 className="week-heading-row" data-expanded={open}>
                                <button
                                    type="button"
                                    className="week-toggle"
                                    aria-expanded={open}
                                    aria-controls={`plan-week-${week.number}`}
                                    aria-label={`Week ${week.number}, ${state}`}
                                    onClick={() => toggle(index)}
                                >
                                    Week {week.number}
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
                                            const totals = calculateWorkoutTotals(session.sections)
                                            return (
                                                <button key={session.id} type="button" className="choice workout" data-zone={zone} onClick={() => onOpenSession(session.id)}>
                                                    <span className="session-workout">
                                                        <strong>{WORKOUT_NAMES[session.kind]}</strong>
                                                        {totals.distanceKm === null ? null : <strong className="session-distance">{totals.distanceKm.toFixed(1)} km</strong>}
                                                    </span>
                                                    <span className="session-metrics">
                                                        <span className="session-metric">
                                                            <PixelMetricIcon kind="duration" />
                                                            <span className="session-metric-label">Duration</span>
                                                            <strong className="session-metric-value">
                                                                {totals.durationSeconds === null ? '—' : formatSpan(totals.durationSeconds)}
                                                            </strong>
                                                        </span>
                                                        <span className="session-metric">
                                                            <PixelMetricIcon kind="pace" />
                                                            <span className="session-metric-label">Pace</span>
                                                            <strong className="session-metric-value">
                                                                {pace ? `${formatPaceSeconds(pace.paceSecondsPerKm)} min/km` : 'Run by effort'}
                                                            </strong>
                                                        </span>
                                                        <span className="session-metric">
                                                            <PixelMetricIcon kind="treadmill" />
                                                            <span className="session-metric-label">Treadmill</span>
                                                            <strong
                                                                className="session-metric-value"
                                                                aria-label={pace ? `Treadmill speed ${pace.speedKmh.toFixed(1)} kilometers per hour` : 'Treadmill speed unavailable'}
                                                            >
                                                                {pace ? `${pace.speedKmh.toFixed(1)} km/h` : 'N/A'}
                                                            </strong>
                                                        </span>
                                                    </span>
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
