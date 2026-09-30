import { useState } from 'react'
import { missingBaselineFields } from '../plan/baseline'
import type { BaselineAnswers } from '../plan/types'

interface Props {
    initial: BaselineAnswers
    /** Reopened to revise answers, so show every question rather than only the gaps. */
    editAll?: boolean
    onBack: () => void
    onDone: (answers: BaselineAnswers) => void
}

function parse(value: string): number | undefined {
    if (value.trim() === '') return undefined
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
}

function Num({
    label,
    value,
    onChange,
    step = 1,
}: {
    label: string
    value: number | undefined
    onChange: (value: number | undefined) => void
    step?: number
}) {
    return (
        <label className="field">
            {label}
            <input
                type="number"
                inputMode="decimal"
                min={0}
                step={step}
                value={value ?? ''}
                onChange={(event) => onChange(parse(event.target.value))}
            />
        </label>
    )
}

export function BaselineScreen({ initial, editAll = false, onBack, onDone }: Props) {
    const [answers, setAnswers] = useState<BaselineAnswers>(initial)
    const patch = (next: Partial<BaselineAnswers>) =>
        setAnswers((current) => ({ ...current, ...next }))

    // Only ask for what we are still missing.
    const [needed] = useState(() => missingBaselineFields(initial))
    const ask = (field: string) => editAll || needed.includes(field as never)
    const outstanding = missingBaselineFields(answers)

    return (
        <section className="card">
            <p className="eyebrow">A few quick details</p>
            <h1>Let&apos;s get you running!</h1>
            <p className="lede">
                {editAll
                    ? 'Change anything below and we will rebuild your workout around it.'
                    : 'We only ask for what we do not already know. Everything here is about what you can do now, not a goal.'}
            </p>

            {ask('capacity') ? (
                <>
                    <h2>What can you run comfortably?</h2>
                    <div className="stack">
                        <button
                            type="button"
                            className={`choice${answers.capacityBasis === 'distance' ? ' selected' : ''}`}
                            onClick={() => patch({ capacityBasis: 'distance' })}
                        >
                            <strong>A distance</strong>
                        </button>
                        <button
                            type="button"
                            className={`choice${answers.capacityBasis === 'time' ? ' selected' : ''}`}
                            onClick={() => patch({ capacityBasis: 'time' })}
                        >
                            <strong>A duration</strong>
                        </button>
                    </div>
                    {answers.capacityBasis === 'distance' ? (
                        <>
                            <Num
                                label="Comfortable distance (km)"
                                value={answers.capacityDistanceKm}
                                onChange={(capacityDistanceKm) => patch({ capacityDistanceKm })}
                                step={0.1}
                            />
                            <Num
                                label="How long that takes you (minutes, optional)"
                                value={answers.capacityTimeMinutes}
                                onChange={(capacityTimeMinutes) => patch({ capacityTimeMinutes })}
                            />
                            <p className="muted">
                                A distance on its own does not tell us your speed. Add the time
                                and we can work it out.
                            </p>
                        </>
                    ) : null}
                    {answers.capacityBasis === 'time' ? (
                        <Num
                            label="Comfortable duration (minutes)"
                            value={answers.capacityMinutes}
                            onChange={(capacityMinutes) => patch({ capacityMinutes })}
                        />
                    ) : null}
                </>
            ) : null}

            {ask('continuity') ? (
                <>
                    <h2>Is that continuous?</h2>
                    <div className="stack">
                        <button
                            type="button"
                            className={`choice${answers.continuity === 'continuous' ? ' selected' : ''}`}
                            onClick={() => patch({ continuity: 'continuous' })}
                        >
                            <strong>Continuous running</strong>
                        </button>
                        <button
                            type="button"
                            className={`choice${answers.continuity === 'run-walk' ? ' selected' : ''}`}
                            onClick={() => patch({ continuity: 'run-walk' })}
                        >
                            <strong>A mix of running and walking</strong>
                        </button>
                    </div>
                </>
            ) : null}

            {ask('pace') ? (
                <>
                    <h2>Your comfortable pace?</h2>
                    <div className="stack">
                        <button
                            type="button"
                            className={`choice${answers.paceKnown === true ? ' selected' : ''}`}
                            onClick={() => patch({ paceKnown: true })}
                        >
                            <strong>I know it</strong>
                        </button>
                        <button
                            type="button"
                            className={`choice${answers.paceKnown === false ? ' selected' : ''}`}
                            onClick={() => patch({ paceKnown: false })}
                        >
                            <strong>I don&apos;t know</strong>
                            <span className="muted">
                                We will build a time-based workout and leave speed, pace and
                                distance blank rather than guessing.
                            </span>
                        </button>
                    </div>
                    {answers.paceKnown ? (
                        <div className="pace-row">
                            <Num
                                label="Minutes per km"
                                value={answers.paceMinutes}
                                onChange={(paceMinutes) => patch({ paceMinutes })}
                            />
                            <Num
                                label="Seconds"
                                value={answers.paceSeconds}
                                onChange={(paceSeconds) => patch({ paceSeconds })}
                            />
                        </div>
                    ) : null}
                </>
            ) : null}

            {ask('walkPace') && answers.continuity === 'run-walk' ? (
                <>
                    <h2>Your walking pace</h2>
                    <div className="stack">
                        <button
                            type="button"
                            className={`choice${answers.walkPaceKnown === true ? ' selected' : ''}`}
                            onClick={() => patch({ walkPaceKnown: true })}
                        >
                            <strong>I know it</strong>
                        </button>
                        <button
                            type="button"
                            className={`choice${answers.walkPaceKnown === false ? ' selected' : ''}`}
                            onClick={() => patch({ walkPaceKnown: false })}
                        >
                            <strong>I don&apos;t know</strong>
                        </button>
                    </div>
                    {answers.walkPaceKnown ? (
                        <div className="pace-row">
                            <Num
                                label="Minutes per km"
                                value={answers.walkPaceMinutes}
                                onChange={(walkPaceMinutes) => patch({ walkPaceMinutes })}
                            />
                            <Num
                                label="Seconds"
                                value={answers.walkPaceSeconds}
                                onChange={(walkPaceSeconds) => patch({ walkPaceSeconds })}
                            />
                        </div>
                    ) : null}
                </>
            ) : null}

            {ask('available') ? (
                <>
                    <h2>Time for this workout</h2>
                    <Num
                        label="Total minutes available"
                        value={answers.availableMinutes}
                        onChange={(availableMinutes) => patch({ availableMinutes })}
                    />
                    <p className="muted">
                        Warm-up and cool-down are counted inside this.
                    </p>
                </>
            ) : null}

            <div className="actions">
                <button
                    type="button"
                    className="primary"
                    disabled={outstanding.includes('capacity') || outstanding.includes('available')}
                    onClick={() => onDone(answers)}
                >
                    Build my workout
                </button>
                <button type="button" className="link" onClick={onBack}>
                    Back
                </button>
            </div>
        </section>
    )
}
