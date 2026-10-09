import { useState } from 'react'
import { RACE_DISTANCES } from '../plan/vdot'
import type { AnswerValue, DistanceTime, Option, Question } from '../plan/questions'
import { DurationInput } from './DurationInput'
import { NumberField } from './NumberField'
import { PaceInput } from './PaceInput'

interface Props {
    question: Question
    value: AnswerValue | undefined
    /** Why the current answer is not acceptable, or null. */
    error: string | null
    onChange: (value: AnswerValue | undefined) => void
}

const DEFAULT_DISTANCE_KM = 5

/** `null` shows a placeholder, so the select never displays a distance that is not stored as the answer. */
function DistanceSelect({ label, value, onChange }: { label: string; value: number | null; onChange: (km: number) => void }) {
    return <label className="field">{label}
        <select value={value ?? ''} onChange={(e) => { if (e.target.value !== '') onChange(Number(e.target.value)) }}>
            {value === null && <option value="" disabled>Choose a distance</option>}
            {RACE_DISTANCES.map((race) => <option key={race.label} value={race.km}>{race.label}</option>)}
        </select>
    </label>
}

function Choices({ options, selected, onToggle }: { options: readonly Option[]; selected: readonly string[]; onToggle: (value: string) => void }) {
    return <div className="stack">
        {options.map((option) => <button key={option.value} type="button" aria-pressed={selected.includes(option.value)}
            className={`choice${selected.includes(option.value) ? ' selected' : ''}`} onClick={() => onToggle(option.value)}>
            <strong>{option.label}</strong>
        </button>)}
    </div>
}

function DistanceTimeField({ value, onChange }: { value: DistanceTime | undefined; onChange: (value: DistanceTime | undefined) => void }) {
    const [distanceKm, setDistanceKm] = useState(value?.distanceKm ?? DEFAULT_DISTANCE_KM)
    const [seconds, setSeconds] = useState<number | null>(value?.seconds ?? null)
    const commit = (km: number, time: number | null) => onChange(time === null ? undefined : { distanceKm: km, seconds: time })
    return <>
        <DistanceSelect label="Distance" value={distanceKm} onChange={(km) => { setDistanceKm(km); commit(km, seconds) }} />
        <DurationInput label="Finish time" required value={seconds} onChange={(time) => { setSeconds(time); commit(distanceKm, time) }} />
    </>
}

/** Renders any question from its definition. The input type decides the control; nothing is per-question. */
export function QuestionField({ question, value, error, onChange }: Props) {
    const { input, units } = question
    const unitLabel = units ?? 'Answer'
    let control
    switch (input.type) {
        case 'choice':
            control = <Choices options={input.options} selected={typeof value === 'string' ? [value] : []} onToggle={onChange} />
            break
        case 'distance':
            control = <DistanceSelect label="Distance" value={typeof value === 'number' ? value : null} onChange={onChange} />
            break
        case 'duration':
            control = <DurationInput label={unitLabel} required={question.required} value={typeof value === 'number' ? value : null}
                onChange={(seconds) => onChange(seconds ?? undefined)} />
            break
        case 'pace':
            control = <PaceInput label={unitLabel} required={question.required} value={typeof value === 'number' ? value : null}
                onChange={(seconds) => onChange(seconds ?? undefined)} />
            break
        case 'date':
            control = <label className="field">Date
                <input type="date" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value || undefined)} />
            </label>
            break
        case 'number':
            control = <NumberField label={unitLabel} min={input.min} max={input.max} step={input.step}
                value={typeof value === 'number' ? value : undefined} onChange={onChange} />
            break
        case 'distanceTime':
            control = <DistanceTimeField value={isDistanceTime(value) ? value : undefined} onChange={onChange} />
            break
    }
    // Duration and pace inputs explain their own format errors.
    const showError = error !== null && input.type !== 'duration' && input.type !== 'pace' && value !== undefined
    return <div className="question" data-question={question.id}>
        <h2>{question.label}{question.required ? '' : ' (optional)'}</h2>
        {question.hint && <p className="muted">{question.hint}</p>}
        {control}
        {showError && <p className="field-error">{error}</p>}
    </div>
}

function isDistanceTime(value: AnswerValue | undefined): value is DistanceTime {
    return typeof value === 'object'
}
