import { PlanSectionEditor } from '../components/PlanSectionEditor'
import { roundSpeedUp } from '../plan/convert'
import { useMemo, useState } from 'react'
import {
    formatPaceSeconds,
    formatSpan,
    isPositiveFinite,
} from '../plan/convert'
import {
    calculateWorkoutTotals,
} from '../plan/metrics'
import { validateWorkout } from '../plan/validation'
import type { PersonalizedWorkout, PlanSection } from '../plan/types'

function compactExplanation(line: string): string {
    if (line.startsWith('Repetition (R):')) return 'Fast, recovered reps near mile pace.'
    const cap = line.match(/fixed distance \(([^)]+)\), which allows (.+)\.$/)
    if (line.startsWith('The VDOT model caps') && cap) return `VDOT cap: ${cap[1]}; ${cap[2]} allowed.`
    return line
}

interface Props {
    workout: PersonalizedWorkout
    onChange: (workout: PersonalizedWorkout) => void
    onStart: () => void
    onBack: () => void
    backLabel: string
}

export function WorkoutScreen({ workout, onChange, onStart, onBack, backLabel }: Props) {
    const [invalidInputs, setInvalidInputs] = useState<Record<string, boolean>>({})
    const totals = useMemo(
        () => calculateWorkoutTotals(workout.sections),
        [workout.sections],
    )
    const validation = useMemo(() => validateWorkout(workout), [workout])

    const replace = (next: PlanSection) =>
        onChange({
            ...workout,
            sections: workout.sections.map((item) =>
                item.id === next.id ? next : item,
            ),
        })


    return (
        <section className="card">
            <p className="eyebrow">{workout.categoryName} · tailored</p>
            <h1>Your workout</h1>

            <ul className="reasons">
                {workout.explanation.map((line) => {
                    const text = compactExplanation(line)
                    return <li key={line}>{text}</li>
                })}
            </ul>

            {workout.adjustments.length > 0 ? (
                <div className="notice">
                    <ul className="warning-list">
                        {workout.adjustments.map((line) => (
                            <li key={line}><span aria-hidden="true">⚠️</span>{line}</li>
                        ))}
                    </ul>
                </div>
            ) : null}

            <div className="plan-steps">{workout.sections.map(item => <PlanSectionEditor key={item.id} section={item} onChange={replace}
                onValidity={valid => setInvalidInputs(current => ({ ...current, [item.id]: !valid }))} />)}</div>

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
                        ? `${roundSpeedUp(totals.averageSpeedKmh).toFixed(1)} km/h`
                        : 'unavailable'}
                </li>
            </ul>

            {!validation.ok ? (
                <div className="notice">
                    <ul className="warning-list">
                        {validation.issues.map((issue) => (
                            <li key={issue.message}><span aria-hidden="true">⚠️</span>{issue.message}</li>
                        ))}
                    </ul>
                </div>
            ) : null}

            <div className="actions">
                <button
                    type="button"
                    className="primary"
                    disabled={!validation.ok || Object.values(invalidInputs).some(Boolean)}
                    onClick={onStart}
                >
                    Start this workout
                </button>
                {!validation.ok ? (
                    <p className="muted">
                        Fix highlighted settings to start. Timed sections may omit speed.
                    </p>
                ) : null}
                <button type="button" className="link" onClick={onBack}>
                    {backLabel}
                </button>
            </div>
        </section>
    )
}
