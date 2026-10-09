import type { RunSession } from '../domain/types'
import { calculateSectionMetrics } from '../plan/metrics'
import type { WorkoutId } from '../workouts'
import type { Zone } from '../plan/vdot'
import { runProgress, type RunSegment } from '../run/engine'
import { activeKcal } from './calories'

const SECONDS_PER_HOUR = 3600
const MS_PER_HOUR = SECONDS_PER_HOUR * 1000

/** A prescribed Daniels zone, or timed recovery between reps. These are plan labels, not measured effort. */
export type ZoneKey = Zone | 'recovery'

/** The zone a plan's main run is prescribed in; warm-ups and cool-downs are always E. */
const MAIN_ZONE: Record<WorkoutId, Zone> = {
    long: 'E', easyRun: 'E', marathon: 'M', threshold: 'T', interval: 'I', repetition: 'R',
}

export interface SectionRow {
    index: number
    label: string
    zone: ZoneKey
    actualSeconds: number
    plannedSeconds: number | null
    /** Distance over time inside the section; null when any of it had no speed. */
    averageKmh: number | null
    distanceKm: number | null
}

/** Run speed segment merged across steps that only split the same stretch, for the speed chart. */
export interface SpeedStep {
    index: number
    zone: ZoneKey
    startSeconds: number
    seconds: number
    speedKmh: number | null
    plannedKmh: number | null
}

export interface ZoneTime {
    zone: ZoneKey
    seconds: number
}

export interface SessionSummary {
    activeSeconds: number
    pausedSeconds: number
    distanceKm: number | null
    paceSecondsPerKm: number | null
    averageKmh: number | null
    kcal: number | null
    sectionsDone: number
    sectionsPlanned: number
    rows: SectionRow[]
    steps: SpeedStep[]
    zoneTimes: ZoneTime[]
}

const zoneOf = (session: RunSession, index: number, phase: RunSegment['phase']): ZoneKey => {
    if (phase === 'walk') return 'recovery'
    const section = session.plan.sections[index]
    return section.type === 'run' ? MAIN_ZONE[session.plan.category] : 'E'
}

/** The order zones are listed in: E, M, T, I, R, then recovery. */
const ZONE_ORDER: readonly ZoneKey[] = ['E', 'M', 'T', 'I', 'R', 'recovery']

/**
 * Everything the completion dashboard shows, replayed from the saved run. Distance and active
 * time are the recorded result; pace is active time over distance, not a mean of section paces.
 * No distance, or a zero distance, gives no pace, no average speed and no calories.
 */
export function summarizeRun(session: RunSession, weightKg: number | null): SessionSummary {
    const activeSeconds = (session.result?.elapsedMs ?? 0) / 1000
    const distanceKm = session.result?.distanceKm ?? null
    const segments: RunSegment[] = []
    const progress = runProgress(session.plan, session.speedChanges, session.result?.elapsedMs ?? 0, segments)

    const steps: SpeedStep[] = []
    for (const segment of segments) {
        const zone = zoneOf(session, segment.index, segment.phase)
        const last = steps.at(-1)
        const step = {
            index: segment.index, zone, startSeconds: segment.startMs / 1000, seconds: segment.durationMs / 1000,
            speedKmh: segment.speedKmh, plannedKmh: segment.plannedKmh,
        }
        if (last && last.index === step.index && last.zone === zone && last.speedKmh === step.speedKmh && last.plannedKmh === step.plannedKmh) last.seconds += step.seconds
        else steps.push(step)
    }

    const rows: SectionRow[] = session.plan.sections.flatMap((section, index) => {
        const own = segments.filter((segment) => segment.index === index)
        if (own.length === 0) return []
        const seconds = own.reduce((sum, segment) => sum + segment.durationMs / 1000, 0)
        const known = own.every((segment) => segment.speedKmh !== null)
        const km = known ? own.reduce((sum, segment) => sum + (segment.speedKmh! * segment.durationMs) / MS_PER_HOUR, 0) : null
        return [{
            index, label: section.label, zone: zoneOf(session, index, 'run'), actualSeconds: seconds,
            plannedSeconds: calculateSectionMetrics(section).durationSeconds,
            averageKmh: km !== null && seconds > 0 ? (km / seconds) * SECONDS_PER_HOUR : null, distanceKm: km,
        }]
    })

    const totals = new Map<ZoneKey, number>()
    for (const step of steps) totals.set(step.zone, (totals.get(step.zone) ?? 0) + step.seconds)
    const zoneTimes = ZONE_ORDER.flatMap((zone) => (totals.has(zone) ? [{ zone, seconds: totals.get(zone)! }] : []))

    const hasDistance = distanceKm !== null && distanceKm > 0 && activeSeconds > 0
    return {
        activeSeconds, pausedSeconds: session.pausedMs / 1000, distanceKm,
        paceSecondsPerKm: hasDistance ? activeSeconds / distanceKm : null,
        averageKmh: hasDistance ? distanceKm / (activeSeconds / SECONDS_PER_HOUR) : null,
        kcal: activeKcal(weightKg, distanceKm),
        sectionsDone: progress.sectionEndsMs.length, sectionsPlanned: session.plan.sections.length,
        rows, steps, zoneTimes,
    }
}
