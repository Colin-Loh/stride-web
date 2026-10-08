import { DurationInput } from './DurationInput'
import { NumberField as Num } from './NumberField'
import { PaceInput } from './PaceInput'
import { formatPaceSeconds } from '../plan/convert'
import { DEFAULT_EASY_PACE_SECONDS, DEFAULT_WALK_PACE_SECONDS } from '../plan/rules'
import { RACE_DISTANCES } from '../plan/vdot'
import type { BaselineAnswers } from '../plan/types'
import type { BaselineField } from '../plan/baseline'
interface QuestionProps {
  answers: BaselineAnswers
  patch: (next: Partial<BaselineAnswers>) => void
  ask: (field: BaselineField) => boolean
  outstanding: BaselineField[]
  preview: string | null
  raceDoesNotAddUp: boolean | undefined
}
export function RaceQuestions({ answers, patch, ask, preview, raceDoesNotAddUp }: QuestionProps) {
 return <>
            {ask('race') ? (
                <>
                    <h2>A recent race or all-out run?</h2>
                    <p className="muted">
                        This is the best guide to your training paces. Use your most recent all-out
                        effort from the last six weeks, ideally a 5 km or 10 km.
                    </p>
                    <div className="stack">
                        <button
                            type="button"
                            className={`choice${answers.raceKnown === true ? ' selected' : ''}`}
                            onClick={() => patch({ raceKnown: true, raceDistanceKm: answers.raceDistanceKm ?? 5 })}
                        >
                            <strong>Yes, I have one</strong>
                        </button>
                        <button
                            type="button"
                            className={`choice${answers.raceKnown === false ? ' selected' : ''}`}
                            onClick={() => patch({ raceKnown: false })}
                        >
                            <strong>No recent run / race</strong>
                            <span className="muted">We will estimate your paces from your comfortable pace instead.</span>
                        </button>
                    </div>
                    {answers.raceKnown ? (
                        <>
                            <label className="field">
                                Distance
                                <select
                                    value={answers.raceDistanceKm ?? 5}
                                    onChange={(e) => patch({ raceDistanceKm: Number(e.target.value) })}
                                >
                                    {RACE_DISTANCES.map((race) => (
                                        <option key={race.label} value={race.km}>{race.label}</option>
                                    ))}
                                </select>
                            </label>
                            <DurationInput
                                label="Finish time"
                                required
                                value={answers.raceSeconds ?? null}
                                onChange={(seconds) => patch({ raceSeconds: seconds ?? undefined })}
                            />
                            {preview ? <p className="muted">{preview}</p> : null}
                            {raceDoesNotAddUp ? (
                                <p className="field-error">That distance and time do not add up to a realistic run. Check both.</p>
                            ) : null}
                        </>
                    ) : null}
                </>
            ) : null}

 </>
}

export function VolumeQuestions({ answers, patch, ask, outstanding }: QuestionProps) {
 return <>
            {ask('weekly') ? (
                <>
                    <h2>How far do you run in a typical week?</h2>
                    <Num
                        label="Kilometres per week"
                        value={answers.weeklyKm}
                        onChange={(weeklyKm) => patch({ weeklyKm })}
                        step={1}
                    />
                    <p className="muted">
                        Jack Daniels sizes every session as a share of your week: your easy and
                        long runs, and how much tempo running you do.
                    </p>
                </>
            ) : null}

            {ask('days') ? (
                <>
                    <h2>How many days a week do you run?</h2>
                    <Num
                        label="Running days (1 to 7)"
                        value={answers.daysPerWeek}
                        onChange={(daysPerWeek) => patch({ daysPerWeek })}
                        min={1}
                        max={7}
                        step={1}
                    />
                    {answers.daysPerWeek !== undefined && outstanding.includes('days') ? (
                        <p className="field-error">Enter a whole number of days from 1 to 7.</p>
                    ) : (
                        <p className="muted">Your easy runs are your weekly distance shared across these days.</p>
                    )}
                </>
            ) : null}

 </>
}

export function RunningQuestions({ answers, patch, ask }: QuestionProps) {
 return <>
            {/* One section for how you run: continuity, running pace, and for run/walk the walking side. */}
            {ask('continuity') || (ask('pace') && answers.raceKnown !== true) || answers.continuity === 'run-walk' ? (
                <>
                    <h2>Your running</h2>
                    {ask('continuity') ? (
                        <>
                            <h3>Do you run without stopping?</h3>
                            <div className="stack">
                                <button
                                    type="button"
                                    className={`choice${answers.continuity === 'continuous' ? ' selected' : ''}`}
                                    onClick={() => patch({ continuity: 'continuous' })}
                                >
                                    <strong>Yes, I run continuously</strong>
                                </button>
                                <button
                                    type="button"
                                    className={`choice${answers.continuity === 'run-walk' ? ' selected' : ''}`}
                                    onClick={() => patch({ continuity: 'run-walk' })}
                                >
                                    <strong>I mix running and walking</strong>
                                    <span className="muted">
                                        Your easy, long and tempo runs alternate short running and walking spells.
                                    </span>
                                </button>
                            </div>
                        </>
                    ) : null}

                    {ask('pace') && answers.raceKnown !== true ? (
                        <>
                            <h3>Comfortable running pace</h3>
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
                                        We will start you at {formatPaceSeconds(DEFAULT_EASY_PACE_SECONDS)}/km, a gentle
                                        jog most beginners can hold. You can change the speed during the run.
                                    </span>
                                </button>
                            </div>
                            {answers.paceKnown ? (
                                <PaceInput label="Running pace (min/km)" required
                                    value={answers.paceMinutes === undefined && answers.paceSeconds === undefined ? null : (answers.paceMinutes ?? 0) * 60 + (answers.paceSeconds ?? 0)}
                                    onChange={seconds => patch({ paceMinutes: seconds === null ? undefined : Math.floor(seconds / 60), paceSeconds: seconds === null ? undefined : seconds % 60 })} />
                            ) : null}
                        </>
                    ) : null}

                    {answers.continuity === 'run-walk' ? (
                        <>
                            <h3>Walking pace</h3>
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
                                    <span className="muted">
                                        We will use {formatPaceSeconds(DEFAULT_WALK_PACE_SECONDS)}/km (5 km/h), an
                                        ordinary walking speed. You can change it on the plan.
                                    </span>
                                </button>
                            </div>
                            {answers.walkPaceKnown ? (
                                <PaceInput label="Walking pace (min/km)" required
                                    value={answers.walkPaceMinutes === undefined && answers.walkPaceSeconds === undefined ? null : (answers.walkPaceMinutes ?? 0) * 60 + (answers.walkPaceSeconds ?? 0)}
                                    onChange={seconds => patch({ walkPaceMinutes: seconds === null ? undefined : Math.floor(seconds / 60), walkPaceSeconds: seconds === null ? undefined : seconds % 60 })} />
                            ) : null}

                            <h3>Run / walk minutes</h3>
                            <p className="muted">Start with two minutes running and one minute walking, or edit both.</p>
                            <div className="pace-row">
                                <Num label="Run minutes" min={0.1} step={0.1} value={answers.runMinutes ?? 2} onChange={runMinutes => patch({ runMinutes: runMinutes ?? 0 })} />
                                <Num label="Walk minutes" min={0.1} step={0.1} value={answers.walkMinutes ?? 1} onChange={walkMinutes => patch({ walkMinutes: walkMinutes ?? 0 })} />
                            </div>
                        </>
                    ) : null}
                </>
            ) : null}

 </>
}

export function AvailabilityQuestion({ answers, patch }: QuestionProps) {
 return <>
            {/* Optional, and about today's session rather than the runner, so always offered. */}
            <h2>Time for this workout</h2>
            <Num
                label="Total minutes available (optional)"
                value={answers.availableMinutes}
                onChange={(availableMinutes) => patch({ availableMinutes })}
            />
            <p className="muted">
                Warm-up and cool-down are counted inside this. Leave it blank and we follow
                Daniels&apos; limits instead: 20 minutes of tempo, long runs no longer than
                150 minutes, and a 10-minute warm-up before hard sessions.
            </p>

 </>
}
