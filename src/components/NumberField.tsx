interface Props {
  label: string; value: number | undefined; onChange: (value: number | undefined) => void
  step?: number; min?: number; max?: number; disabled?: boolean
}
export function NumberField({ label, value, onChange, step = 1, min = 0, max, disabled }: Props) {
  return <label className="field">{label}<input type="number" inputMode="decimal" min={min} max={max}
    step={step} disabled={disabled} value={value ?? ''} onChange={e => {
      const parsed = e.target.value.trim() === '' ? undefined : Number(e.target.value)
      onChange(parsed === undefined || Number.isFinite(parsed) ? parsed : undefined)
    }} /></label>
}
