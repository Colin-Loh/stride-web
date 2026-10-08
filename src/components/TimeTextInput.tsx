import { useState } from 'react'
export interface TimeInputProps {
  label: string
  value: number | null
  onChange: (seconds: number | null) => void
  onValidity?: (valid: boolean) => void
  required?: boolean
}
interface Props extends TimeInputProps {
  parse: (text: string) => number | null
  format: (seconds: number) => string
  placeholder: string
  error: string
}
export function TimeTextInput({ label, value, onChange, onValidity, required = false, parse, format, placeholder, error }: Props) {
  const [input, setInput] = useState<string | null>(null)
  const draft = input ?? (value === null ? '' : format(value))
  const invalid = draft.trim() === '' ? required : parse(draft) === null
  return <label className="field">{label}<input type="text" inputMode="text" placeholder={placeholder}
    value={draft} aria-invalid={invalid} onFocus={() => setInput(draft)} onBlur={() => { if (!invalid) setInput(null) }}
    onChange={e => {
      const raw = e.target.value; setInput(raw)
      const parsed = parse(raw)
      const valid = parsed !== null || (!required && raw.trim() === '')
      onValidity?.(valid)
      if (valid) onChange(parsed)
      else if (required) onChange(null)
    }} />{invalid && <span className="field-error">{error}</span>}</label>
}
