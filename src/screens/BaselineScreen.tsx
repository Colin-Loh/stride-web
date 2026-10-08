import { useState } from 'react'
import { QuestionField } from '../components/QuestionField'
import { answerError, missingQuestions, visibleQuestions, type AnswerValue, type Answers, type QuestionId } from '../plan/questions'

interface Props {
    initial: Answers
    onBack: () => void
    onDone: (answers: Answers) => void
}

/** Asks every question that applies to the answers so far, straight from the question list. */
export function BaselineScreen({ initial, onBack, onDone }: Props) {
    const [answers, setAnswers] = useState<Answers>(initial)
    const today = new Date()
    const patch = (id: QuestionId, value: AnswerValue | undefined) =>
        setAnswers((current) => {
            const { [id]: _previous, ...rest } = current
            return value === undefined ? rest : { ...rest, [id]: value }
        })
    const missing = missingQuestions(answers, today)

    return (
        <section className="card">
            <p className="eyebrow">A few quick details</p>
            <h1>Let&apos;s get you running!</h1>
            <p className="lede">
                Everything here is about what you can do now, not a goal. Your answers set your Jack Daniels training paces and session sizes.
            </p>

            {visibleQuestions(answers).map((question) => (
                <QuestionField key={question.id} question={question} value={answers[question.id as QuestionId]}
                    error={answerError(question, answers, today)}
                    onChange={(value) => patch(question.id as QuestionId, value)} />
            ))}

            <div className="actions">
                <button type="button" className="primary" disabled={missing.length > 0} onClick={() => onDone(answers)}>
                    Build my workout
                </button>
                <button type="button" className="link" onClick={onBack}>
                    Back
                </button>
            </div>
        </section>
    )
}
