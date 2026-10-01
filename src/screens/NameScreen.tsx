import { useState } from 'react'
import { RunnerSprite } from '../RunnerSprite'
import type { Character } from '../storage'

interface Props {
  initialName?: string
  initialCharacter?: Character
  onContinue: (name: string, character: Character) => void
}

const CHARACTERS: { id: Character; label: string }[] = [
  { id: 'shiba', label: 'Shiba' },
  { id: 'cat', label: 'Cat' },
]

export function NameScreen({
  initialName = '',
  initialCharacter = 'shiba',
  onContinue,
}: Props) {
  const [name, setName] = useState(initialName)
  const [character, setCharacter] = useState<Character>(initialCharacter)

  return (
    <section className="card">
      <p className="eyebrow">Stride</p>
      <h1>What should we call you?</h1>
      <p className="lede">
        A few questions, then you pick Easy, Tempo, or Long. Timed sections follow the clock; distance sections follow your entered speed.
      </p>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault()
          const trimmed = name.trim()
          if (trimmed) onContinue(trimmed, character)
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
        <fieldset className="field characters">
          <legend>Your runner</legend>
          <div className="character-options">
            {CHARACTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`character${character === option.id ? ' selected' : ''}`}
                aria-pressed={character === option.id}
                onClick={() => setCharacter(option.id)}
              >
                <RunnerSprite
                  character={option.id}
                  state={character === option.id ? 'running' : 'idle'}
                  scale={0.25}
                  className="small"
                />
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
        <button type="submit" className="primary" disabled={!name.trim()}>
          Continue
        </button>
      </form>
    </section>
  )
}
