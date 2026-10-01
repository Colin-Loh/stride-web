import { useState } from 'react'
import { formatPaceSeconds, parsePace } from '../plan/convert'
interface Props { label: string; value: number | null; onChange: (seconds: number | null) => void; onValidity?: (valid: boolean) => void; required?: boolean }
export function PaceInput({ label, value, onChange, onValidity, required = false }: Props) {
  const [input, setInput] = useState<string | null>(null)
  const draft = input ?? (value === null ? '' : formatPaceSeconds(value))
  const invalid = draft.trim() === '' ? required : parsePace(draft) === null
  return <label className="field">{label}<input type="text" inputMode="text" placeholder="m:ss"
    value={draft} aria-invalid={invalid} onFocus={() => setInput(draft)} onBlur={() => { if (!invalid) setInput(null) }}
    onChange={e => {
      const raw = e.target.value; setInput(raw)
      const parsed = parsePace(raw)
      const valid = parsed !== null || (!required && raw.trim() === '')
      onValidity?.(valid)
      if (valid) onChange(parsed)
      else if (required) onChange(null)
    }} />{invalid && <span className="field-error">Enter a positive pace as m:ss, with seconds from 00 to 59.</span>}</label>
}
