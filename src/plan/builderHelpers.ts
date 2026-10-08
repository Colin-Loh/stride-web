import { EFFORT_LABELS } from './copy'
import type { PlanSection, SectionTarget } from './types'

export function section(
    id: string,
    type: PlanSection['type'],
    label: string,
    target: SectionTarget,
    speedKmh: number | null,
): PlanSection {
    return { id, type, label, target, speedKmh, effort: EFFORT_LABELS[type] }
}
