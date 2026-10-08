import { WORKOUTS, type PickableWorkoutId, type WorkoutId } from '../workouts'

interface Props {
    name: string
    selected?: WorkoutId
    onPick: (id: PickableWorkoutId) => void
    onChangeName: () => void
    onEditAnswers: () => void
}

const INTENSITY_LABELS: Record<PickableWorkoutId, string> = {
    test: '90-second timer and sound check',
    long: 'At your Daniels easy pace',
    threshold: 'At your Daniels threshold pace',
    interval: 'At your Daniels interval pace',
    repetition: 'At your Daniels repetition pace',
}

export function CategoryScreen({
    name,
    selected,
    onPick,
    onChangeName,
    onEditAnswers,
}: Props) {
    return (
        <section className="card">
            <p className="eyebrow">
                {name}
            </p>
            <h1>Which session today?</h1>
            <p className="lede">
                Each one is built around your own running, using Jack Daniels' training paces.
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
                        <span className="muted">{INTENSITY_LABELS[workout.id]}</span>
                        <span>{workout.blurb}</span>
                    </button>
                ))}
            </div>
            <button type="button" className="link" onClick={onChangeName}>
                Change name or character
            </button>
            <button type="button" className="link" onClick={onEditAnswers}>
                Change my running answers
            </button>
        </section>
    )
}
