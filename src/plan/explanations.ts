import { formatDurationSeconds, formatPaceSeconds, paceSecondsPerKmFromSpeed } from './convert'
import { weeksUntil } from './dates'
import { isExtrapolatedVdot, RACE_DISTANCES, seasonPhase, ZONES, type TrainingSpeeds, type Zone } from './daniels'
import type { PersonalBaseline } from './types'

const pace = (kmh: number) => `${formatPaceSeconds(paceSecondsPerKmFromSpeed(kmh))}/km`

const raceLabel = (distanceKm: number) =>
    RACE_DISTANCES.find((race) => Math.abs(race.km - distanceKm) < 1e-9)?.label ?? `${distanceKm} km`

/** Where the paces came from, shown at the top of every plan. Null when nothing is known yet. */
export function fitnessNote(baseline: PersonalBaseline, speeds: TrainingSpeeds | null): string | null {
    if (baseline.fitnessMethod === 'easy_pace') {
        return 'No VDOT can be worked out from an easy pace alone, so easy running uses the pace you reported and speed sessions have no target pace. Add a race or time trial for training paces.'
    }
    if (!speeds || baseline.vdot === null || baseline.race === null) return null
    const paces = (Object.keys(ZONES) as Zone[]).map((zone) => `${ZONES[zone].name.toLowerCase()} ${pace(speeds[zone])}`).join(', ')
    const result = `Your ${raceLabel(baseline.race.distanceKm).toLowerCase()} in ${formatDurationSeconds(baseline.race.seconds)} gives a VDOT of ${baseline.vdot.toFixed(1)}. Daniels paces: ${paces}.`
    const provisional = baseline.fitnessMethod === 'estimated_race'
        ? ' This comes from your own estimate, so treat it as provisional until you run a race or time trial.'
        : ''
    const extrapolated = isExtrapolatedVdot(baseline.vdot)
        ? ' This VDOT is outside the range of the published tables, so the paces are extrapolated.'
        : ''
    return result + provisional + extrapolated
}

/** Where the goal race falls in Daniels' ideal 24-week season, or null when there is no date or it is out of range. */
export function goalNote(baseline: PersonalBaseline, today: Date): string | null {
    if (!baseline.goalRaceDate) return null
    const weeks = weeksUntil(baseline.goalRaceDate, today)
    const phase = seasonPhase(weeks)
    return phase
        ? `Your goal race is about ${weeks} week${weeks === 1 ? '' : 's'} away. In Daniels' ideal 24-week season that is the ${phase.name} phase: ${phase.summary}.`
        : null
}

/** What a zone is for and how hard it feels, from its definition in daniels.ts. */
export function zoneNote(zone: Zone): string {
    const { name, purpose, vo2MaxPercent, hrMaxPercent } = ZONES[zone]
    const ranges = [
        vo2MaxPercent && `${vo2MaxPercent[0]}–${vo2MaxPercent[1]}% of VO₂max`,
        hrMaxPercent && `${hrMaxPercent[0]}–${hrMaxPercent[1]}% of max heart rate`,
    ].filter(Boolean).join(', ')
    return `${name} (${zone}): ${purpose}${ranges ? ` Roughly ${ranges}.` : ''}`
}
