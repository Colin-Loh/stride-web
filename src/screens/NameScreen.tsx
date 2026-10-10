import { useState } from 'react'
import { RunnerSprite } from '../RunnerSprite'
import { CHARACTER_NAMES, parseWeightKg, WEIGHT_KG_LIMITS, type Character } from '../domain/preferences'
import { nameSubmission } from './nameSubmission'

interface Props {
  initialName?: string
  /** Onboarding only: the character pre-selected before the runner picks one. */
  initialCharacter?: Character
  initialWeightKg?: number | null
  /**
   * Set once a character is saved. Its presence makes this the edit screen: no character
   * buttons, the locked character is shown as text, and submit keeps this value.
   */
  storedCharacter?: Character
  onContinue: (name: string, character: Character, weightKg: number | null) => void
}

const WEIGHT_ERROR = `Enter a weight from ${WEIGHT_KG_LIMITS.min} to ${WEIGHT_KG_LIMITS.max} kg, or leave it empty.`

const CHARACTERS = Object.keys(CHARACTER_NAMES) as Character[]

export function NameScreen({
  initialName = '',
  initialCharacter = 'shiba',
  initialWeightKg = null,
  storedCharacter,
  onContinue,
}: Props) {
  const [name, setName] = useState(initialName)
  const [character, setCharacter] = useState<Character>(initialCharacter)
  const [weightText, setWeightText] = useState(initialWeightKg === null ? '' : String(initialWeightKg))
  const weight = parseWeightKg(weightText)

  return (
    <section className="card">
      <p className="eyebrow">Stride</p>
      <h1>What should we call you?</h1>
      <p className="lede">
        A few questions, then you see your training plan or pick a single session. Timed sections follow the clock; distance sections follow your entered speed.
      </p>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault()
          const submitted = nameSubmission(name, weightText, character, storedCharacter)
          if (submitted) onContinue(submitted.name, submitted.character, submitted.weightKg)
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
        <label className="field">
          Body weight in kg (optional)
          <input
            inputMode="decimal"
            autoComplete="off"
            value={weightText}
            onChange={(event) => setWeightText(event.target.value)}
            placeholder="60"
            aria-invalid={!weight.ok}
            aria-describedby="weight-help"
          />
          <span id="weight-help" className="muted">
            Used only on this device for an approximate calorie estimate after a run.
          </span>
          {!weight.ok && <span className="field-error" role="alert">{WEIGHT_ERROR}</span>}
        </label>
        {storedCharacter !== undefined ? (
          <p className="muted">
            Runner: {CHARACTER_NAMES[storedCharacter]}. The character is chosen at first use and cannot be changed here.
          </p>
        ) : (
          <fieldset className="field characters">
            <legend>Your runner</legend>
            <div className="character-options">
              {CHARACTERS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`character${character === id ? ' selected' : ''}`}
                  aria-pressed={character === id}
                  onClick={() => setCharacter(id)}
                >
                  <RunnerSprite
                    character={id}
                    state={character === id ? 'running' : 'idle'}
                    scale={0.25}
                    className="small"
                  />
                  {CHARACTER_NAMES[id]}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <button type="submit" className="primary" disabled={!name.trim() || !weight.ok}>
          Continue
        </button>
      </form>
    </section>
  )
}
