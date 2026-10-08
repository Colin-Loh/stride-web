import { PlanSectionEditor } from '../components/PlanSectionEditor'
import { RULES_DISCLAIMER } from '../plan/copy'
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
            <p className="muted">{RULES_DISCLAIMER}</p>
            <p className="muted">Treadmill speeds round up to 0.1 km/h. Distance is estimated; time targets stay fixed.</p>

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

            <div className="plan-steps">{workout.sections.map(item => <PlanSectionEditor key={item.id} section={item} onChange={replace}
                fixed={workout.category === 'test'} onValidity={valid => setInvalidInputs(current => ({ ...current, [item.id]: !valid }))} />)}</div>

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
                    {validation.issues.map((issue) => (
                        <p key={issue.message}>{issue.message}</p>
                    ))}
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
                        Correct the plan above before starting. Timed sections can run without a speed.
                    </p>
                ) : null}
                <button type="button" className="link" onClick={onBack}>
                    {backLabel}
                </button>
            </div>
        </section>
    )
}
