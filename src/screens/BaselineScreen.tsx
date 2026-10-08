import { RaceQuestions, VolumeQuestions, RunningQuestions, AvailabilityQuestion } from '../components/BaselineQuestions'
import { useState } from 'react'
import { missingBaselineFields, raceResult } from '../plan/baseline'
import { formatPaceSeconds, paceSecondsPerKmFromSpeed } from '../plan/convert'
import type { BaselineAnswers } from '../plan/types'
import { danielsSpeeds } from '../plan/vdot'

const pace = (kmh: number) => formatPaceSeconds(paceSecondsPerKmFromSpeed(kmh))

/** Live feedback once a race result adds up, so the runner sees what it means. */
function racePreview(answers: BaselineAnswers): string | null {
    const race = raceResult(answers)
    if (!race) return null
    const zones = danielsSpeeds(race.vdot)
    return `That is a VDOT of ${race.vdot.toFixed(1)}: easy ${pace(zones.easyFastKmh)}–${pace(zones.easySlowKmh)}/km, threshold ${pace(zones.thresholdKmh)}/km, repetition ${pace(zones.repetitionKmh)}/km.`
}

interface Props {
    initial: BaselineAnswers
    /** Reopened to revise answers, so show every question rather than only the gaps. */
    editAll?: boolean
    onBack: () => void
    onDone: (answers: BaselineAnswers) => void
}

export function BaselineScreen({ initial, editAll = false, onBack, onDone }: Props) {
    const [answers, setAnswers] = useState<BaselineAnswers>(initial)
    const patch = (next: Partial<BaselineAnswers>) =>
        setAnswers((current) => ({ ...current, ...next }))

    // Only ask for what we are still missing.
    const [needed] = useState(() => missingBaselineFields(initial))
    const ask = (field: typeof needed[number]) => editAll || needed.includes(field)
    const outstanding = missingBaselineFields(answers)
    const preview = racePreview(answers)
    const raceDoesNotAddUp = answers.raceKnown && Number.isFinite(answers.raceDistanceKm) && Number.isFinite(answers.raceSeconds) && preview === null

    const questionProps = { answers, patch, ask, outstanding, preview, raceDoesNotAddUp }

    return (
        <section className="card">
            <p className="eyebrow">A few quick details</p>
            <h1>Let&apos;s get you running!</h1>
            <p className="lede">
                {editAll
                    ? 'Change anything below and we will rebuild your workout around it.'
                    : 'We only ask for what we do not already know. Everything here is about what you can do now, not a goal.'}
            </p>

            <RaceQuestions {...questionProps} />
            <VolumeQuestions {...questionProps} />
            <RunningQuestions {...questionProps} />
            <AvailabilityQuestion {...questionProps} />

            <div className="actions">
                <button
                    type="button"
                    className="primary"
                    disabled={outstanding.length > 0}
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
