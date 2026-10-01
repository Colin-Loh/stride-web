import { useState } from 'react'
import { formatDuration, parseDuration } from '../plan/convert'
interface Props { label: string; value: number | null; onChange: (seconds: number | null) => void; required?: boolean }
export function DurationInput({ label, value, onChange, required = false }: Props) {
  const [input, setInput] = useState<string | null>(null)
  const draft = input ?? (value === null ? '' : formatDuration(value))
  const invalid = draft.trim() === '' ? required : parseDuration(draft) === null
  return <label className="field">{label}<input type="text" inputMode="text" placeholder="m:ss or h:mm:ss"
    value={draft} aria-invalid={invalid} onFocus={() => setInput(draft)} onBlur={() => { if (!invalid) setInput(null) }}
    onChange={e => {
      const raw = e.target.value; setInput(raw)
      const parsed = parseDuration(raw)
      if (parsed !== null || (!required && raw.trim() === '')) onChange(parsed)
      else if (required) onChange(null)
    }} />{invalid && <span className="field-error">Enter a time as m:ss or h:mm:ss, for example 27:30 or 1:58:00.</span>}</label>
}
