import { LEVELS, type RunnerLevel } from '../workouts'

interface Props {
  name: string
  selected?: RunnerLevel
  onBack: () => void
  onSelect: (level: RunnerLevel) => void
}

export function LevelScreen({ name, selected, onBack, onSelect }: Props) {
  return (
    <section className="card">
      <p className="eyebrow">Nice to meet you, {name}</p>
      <h1>How often do you run?</h1>
      <p className="lede">
        This sets how much of your comfortable distance the main run asks for.
        Your pace always comes from your own running, never from this answer.
      </p>
      <div className="stack">
        {(Object.keys(LEVELS) as RunnerLevel[]).map((level) => {
          const meta = LEVELS[level]
          return (
            <button
              key={level}
              type="button"
              className={`choice ${selected === level ? 'selected' : ''}`}
              onClick={() => onSelect(level)}
            >
              <strong>{meta.label}</strong>
              <span>{meta.criteria}</span>
            </button>
          )
        })}
      </div>
      <button type="button" className="link" onClick={onBack}>
        Change name
      </button>
    </section>
  )
}
