import { NumberField } from './NumberField'
import { PaceInput } from './PaceInput'
import { calculateSectionMetrics } from '../plan/metrics'
import { setSectionPace, setSectionSpeed, setSectionTargetValue } from '../plan/edit'
import { formatSpan, roundSpeedUp } from '../plan/convert'
import type { PlanSection } from '../plan/types'

interface Props { section: PlanSection; onChange: (section: PlanSection) => void; onValidity: (valid: boolean) => void }
export function PlanSectionEditor({ section, onChange, onValidity }: Props) {
  const metrics = calculateSectionMetrics(section)
  return <div className="plan-step">
    <div className="plan-step-head"><strong>{section.label}</strong><span className="muted">{section.target.basis === 'time' ? 'Time target' : 'Distance target'}</span></div>
    <div className="pace-row">
      <NumberField label={section.target.basis === 'time' ? 'Duration (min)' : 'Distance (km)'} step={0.1}
        value={section.target.basis === 'time' ? Number((section.target.durationSeconds / 60).toFixed(3)) : section.target.distanceKm}
        onChange={v => onChange(setSectionTargetValue(section, (v ?? 0) * (section.target.basis === 'time' ? 60 : 1)))} />
      <NumberField label="Speed (km/h)" step={0.1} min={0.5} max={25} value={section.speedKmh ?? undefined}
        onChange={v => onChange(setSectionSpeed(section, v ?? null))} />
    </div>
    <PaceInput label="Running pace (min/km)" value={section.speedKmh === null ? null : Math.round(3600 / section.speedKmh)}
      onChange={v => onChange(setSectionPace(section, v))} onValidity={onValidity} />
    {section.runWalk && <>
      <div className="pace-row">
        <NumberField label="Work minutes" step={0.1} min={0.1} value={Number((section.runWalk.runSeconds / 60).toFixed(2))}
          onChange={v => onChange({ ...section, runWalk: { ...section.runWalk!, runSeconds: (v ?? 0) * 60 } })} />
        <NumberField label="Recovery minutes" step={0.1} min={0.1} value={Number((section.runWalk.walkSeconds / 60).toFixed(2))}
          onChange={v => onChange({ ...section, runWalk: { ...section.runWalk!, walkSeconds: (v ?? 0) * 60 } })} />
      </div>
      <NumberField label="Recovery speed (km/h)" step={0.1} min={0.5} max={25} value={section.runWalk.walkSpeedKmh ?? undefined}
        onChange={v => onChange({ ...section, runWalk: { ...section.runWalk!, walkSpeedKmh: v === undefined ? null : roundSpeedUp(v) } })} />
    </>}
    <p className="muted">{metrics.durationSeconds === null ? 'Duration unknown' : formatSpan(metrics.durationSeconds)} · {metrics.distanceKm === null ? 'Distance unknown' : `${metrics.distanceKm.toFixed(2)} km estimated`}</p>
    <p className="muted">{section.effort}</p>
  </div>
}
