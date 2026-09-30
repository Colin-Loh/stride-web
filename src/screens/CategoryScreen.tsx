import { WORKOUTS, LEVELS, type RunnerLevel, type WorkoutId } from '../workouts'
import { CATEGORY_INTENSITY } from '../plan/rules'

interface Props {
    name: string
    level: RunnerLevel
    selected?: WorkoutId
    onPick: (id: WorkoutId) => void
    onChangeLevel: () => void
    onEditAnswers: () => void
}

function intensityLabel(id: WorkoutId): string {
    const ratio = CATEGORY_INTENSITY[id].run
    if (ratio > 1.05) return `About ${Math.round((ratio - 1) * 100)}% faster than your easy pace`
    if (ratio < 0.95) return `About ${Math.round((1 - ratio) * 100)}% slower than your easy pace`
    return 'At your comfortable easy pace'
}

export function CategoryScreen({
    name,
    level,
    selected,
    onPick,
    onChangeLevel,
    onEditAnswers,
}: Props) {
    return (
        <section className="card">
            <p className="eyebrow">
                {name} · {LEVELS[level].label}
            </p>
            <h1>Which session today?</h1>
            <p className="lede">
                Each one is built around your own comfortable pace, not a fixed speed.
            </p>
            <div className="stack">
                {WORKOUTS.map((workout) => (
                    <button
                        key={workout.id}
                        type="button"
                        className={`choice workout${selected === workout.id ? ' selected' : ''}`}
                        onClick={() => onPick(workout.id)}
                    >
                        <strong>{workout.name}</strong>
                        <span className="muted">{intensityLabel(workout.id)}</span>
                        <span>{workout.blurb}</span>
                    </button>
                ))}
            </div>
            <button type="button" className="link" onClick={onChangeLevel}>
                Change experience level
            </button>
            <button type="button" className="link" onClick={onEditAnswers}>
                Change my running answers
            </button>
        </section>
    )
}
