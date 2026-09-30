import { useMemo } from 'react'
import {
    formatPaceSeconds,
    formatSpan,
    isPositiveFinite,
} from '../plan/convert'
import {
    calculateSectionMetrics,
    calculateWorkoutTotals,
    setSectionPace,
    setSectionSpeed,
    setSectionTargetValue,
    validateWorkout,
} from '../plan/generate'
import { toResolvedWorkout } from '../plan/runnable'
import type { PersonalizedWorkout, PlanSection } from '../plan/types'

interface Props {
    workout: PersonalizedWorkout
    onChange: (workout: PersonalizedWorkout) => void
    onStart: () => void
    onBack: () => void
}

export function PlanScreen({ workout, onChange, onStart, onBack }: Props) {
    const totals = useMemo(
        () => calculateWorkoutTotals(workout.sections),
        [workout.sections],
    )
    const validation = useMemo(() => validateWorkout(workout), [workout])
    const runnable = useMemo(() => toResolvedWorkout(workout), [workout])

    const replace = (next: PlanSection) =>
        onChange({
            ...workout,
            sections: workout.sections.map((item) =>
                item.id === next.id ? next : item,
            ),
        })

    const renderSection = (item: PlanSection) => {
        const metrics = calculateSectionMetrics(item)
        const pace = metrics.paceSecondsPerKm
        return (
            <div className="plan-step" key={item.id}>
                <div className="plan-step-head">
                    <strong>{item.label}</strong>
                    <span className="muted">
                        {item.target.basis === 'time' ? 'Time target' : 'Distance target'}
                    </span>
                </div>

                <div className="pace-row">
                    <label className="field">
                        {item.target.basis === 'time' ? 'Duration (min)' : 'Distance (km)'}
                        <input
                            type="number"
                            min={0}
                            step={item.target.basis === 'time' ? 0.5 : 0.1}
                            value={
                                item.target.basis === 'time'
                                    ? Number((item.target.durationSeconds / 60).toFixed(2))
                                    : Number(item.target.distanceKm.toFixed(3))
                            }
                            onChange={(event) => {
                                const value = Number(event.target.value)
                                replace(
                                    setSectionTargetValue(
                                        item,
                                        item.target.basis === 'time' ? value * 60 : value,
                                    ),
                                )
                            }}
                        />
                    </label>
                    <label className="field">
                        Speed (km/h)
                        <input
                            type="number"
                            min={0}
                            step={0.1}
                            placeholder="unknown"
                            value={item.speedKmh === null ? '' : Number(item.speedKmh.toFixed(2))}
                            onChange={(event) => {
                                const raw = event.target.value
                                replace(
                                    setSectionSpeed(
                                        item,
                                        raw.trim() === '' ? null : Number(raw),
                                    ),
                                )
                            }}
                        />
                    </label>
                </div>

                <div className="pace-row">
                    <label className="field">
                        Pace (min/km)
                        <input
                            type="text"
                            placeholder="unknown"
                            value={pace === null ? '' : formatPaceSeconds(pace)}
                            onChange={(event) => {
                                const [minutes, seconds] = event.target.value.split(':')
                                const total =
                                    (Number(minutes) || 0) * 60 + (Number(seconds) || 0)
                                replace(setSectionPace(item, total > 0 ? total : null))
                            }}
                        />
                    </label>
                    <div className="field">
                        Derived
                        <p className="muted">
                            {metrics.durationSeconds === null
                                ? 'Duration unknown'
                                : `${formatSpan(metrics.durationSeconds)}${metrics.durationEstimated ? ' (est.)' : ''}`}
                            {' · '}
                            {metrics.distanceKm === null
                                ? 'Distance unknown'
                                : `${metrics.distanceKm.toFixed(2)} km${metrics.distanceEstimated ? ' (est.)' : ''}`}
                        </p>
                    </div>
                </div>

                <p className="muted">{item.effort}</p>
            </div>
        )
    }

    return (
        <section className="card">
            <p className="eyebrow">{workout.categoryName} · tailored</p>
            <h1>Your workout</h1>

            <ul className="reasons">
                {workout.explanation.map((line) => (
                    <li key={line}>{line}</li>
                ))}
            </ul>

            {workout.adjustments.length > 0 ? (
                <div className="notice">
                    {workout.adjustments.map((line) => (
                        <p key={line}>{line}</p>
                    ))}
                </div>
            ) : null}

            <div className="plan-steps">{workout.sections.map(renderSection)}</div>

            <h2>Totals</h2>
            <ul className="reasons">
                <li>
                    Total time:{' '}
                    {totals.durationSeconds === null
                        ? 'incomplete — a section has no speed'
                        : formatSpan(totals.durationSeconds)}
                </li>
                <li>
                    Total distance:{' '}
                    {totals.distanceComplete && totals.distanceKm !== null
                        ? `${totals.distanceKm.toFixed(2)} km (estimated from target speeds)`
                        : 'incomplete — a section has no speed'}
                </li>
                <li>
                    Overall pace:{' '}
                    {totals.paceSecondsPerKm === null
                        ? 'unavailable'
                        : `${formatPaceSeconds(totals.paceSecondsPerKm)} min/km`}
                </li>
                <li>
                    Average speed:{' '}
                    {isPositiveFinite(totals.averageSpeedKmh)
                        ? `${totals.averageSpeedKmh.toFixed(2)} km/h`
                        : 'unavailable'}
                </li>
                {workout.baseline.availableSeconds ? (
                    <li className="muted">
                        You said you have {formatSpan(workout.baseline.availableSeconds)}.
                    </li>
                ) : null}
            </ul>

            {!validation.ok ? (
                <div className="notice">
                    {validation.issues.map((issue) => (
                        <p key={issue.message}>{issue.message}</p>
                    ))}
                </div>
            ) : null}

            <div className="actions">
                <button
                    type="button"
                    className="primary"
                    disabled={!runnable || !validation.ok}
                    onClick={onStart}
                >
                    Start this workout
                </button>
                {!runnable ? (
                    <p className="muted">
                        Add a speed to every section to run it with live tracking. The plan
                        above is still yours to follow by effort and time.
                    </p>
                ) : null}
                <button type="button" className="link" onClick={onBack}>
                    Pick a different session
                </button>
            </div>
        </section>
    )
}
