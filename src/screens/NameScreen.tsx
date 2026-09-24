import { useState } from 'react'

interface Props {
  initialName?: string
  onContinue: (name: string) => void
}

export function NameScreen({ initialName = '', onContinue }: Props) {
  const [name, setName] = useState(initialName)

  return (
    <section className="card">
      <p className="eyebrow">Stride</p>
      <h1>What should we call you?</h1>
      <p className="lede">
        A few questions, then you pick Easy, Tempo, or Long. The timer follows
        the prescribed pace for each segment.
      </p>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault()
          const trimmed = name.trim()
          if (trimmed) onContinue(trimmed)
        }}
      >
        <label className="field">
          Your name
          <input
            autoComplete="given-name"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Alex"
          />
        </label>
        <button type="submit" className="primary" disabled={!name.trim()}>
          Continue
        </button>
      </form>
    </section>
  )
}
