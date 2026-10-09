import { PaceCards } from '../components/PaceCards'
import type { Session, TrainingPlan } from '../domain/types'
import { formatSpan } from '../plan/convert'
import { currentWeekIndex } from '../plan/dates'
import { calculateWorkoutTotals } from '../plan/metrics'

interface Props {
    plan: TrainingPlan
    onOpenSession: (sessionId: string) => void
    onBack: () => void
    /** The day to treat as today; defaults to now. */
    today?: Date
}

function sessionSummary(session: Session): string {
    const totals = calculateWorkoutTotals(session.sections)
    if (totals.distanceKm !== null) return `${totals.distanceKm.toFixed(1)} km`
    return totals.durationSeconds === null ? 'by effort' : formatSpan(totals.durationSeconds)
}

/** The training plan: the runner's VDOT paces, then every week with its sessions. */
export function PlanScreen({ plan, onOpenSession, onBack, today = new Date() }: Props) {
    const current = currentWeekIndex(plan.startDate, plan.weeks.length, today)
    return (
        <section className="card">
            <p className="eyebrow">Training plan · {plan.weeks.length} weeks</p>
            <h1>Your plan</h1>

            <h2>Your paces</h2>
            <PaceCards paces={plan.paces} />
            <p className="muted">Treadmill speeds round up to 0.1 km/h.</p>

            {plan.notes.length > 0 ? (
                <div className="notice">
                    {plan.notes.map((line) => (<p key={line}>{line}</p>))}
                </div>
            ) : null}

            <h2>Week by week</h2>
            <ol className="weeks">
                {plan.weeks.map((week, index) => (
                    <li key={week.id} className={`week${index === current ? ' current' : ''}`} aria-current={index === current ? 'date' : undefined}>
                        <h3>
                            Week {week.number} · {week.targetKm.toFixed(1)} km
                            {index === current ? <span className="week-badge">This week</span> : null}
                        </h3>
                        <p className="muted">Starts {week.startDate}</p>
                        <div className="stack">
                            {week.sessions.map((session) => (
                                <button key={session.id} type="button" className="choice workout" onClick={() => onOpenSession(session.id)}>
                                    <strong>{session.name}</strong>
                                    <span className="muted">{sessionSummary(session)}</span>
                                </button>
                            ))}
                        </div>
                    </li>
                ))}
            </ol>

            <div className="actions">
                <button type="button" className="link" onClick={onBack}>Pick a single session</button>
            </div>
        </section>
    )
}
