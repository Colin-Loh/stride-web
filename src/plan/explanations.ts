import { formatDurationSeconds, formatPaceSeconds, paceSecondsPerKmFromSpeed } from './convert'
import { weeksUntil } from './dates'
import { isExtrapolatedVdot, RACE_DISTANCES, seasonPhase, ZONES, type TrainingSpeeds, type Zone } from './vdot'
import type { PersonalBaseline } from './types'

const pace = (kmh: number) => `${formatPaceSeconds(paceSecondsPerKmFromSpeed(kmh))}/km`

const raceLabel = (distanceKm: number) =>
    RACE_DISTANCES.find((race) => Math.abs(race.km - distanceKm) < 1e-9)?.label ?? `${distanceKm} km`

/** Concise VDOT facts shown as bullets at the top of a plan. */
export function fitnessNote(baseline: PersonalBaseline, speeds: TrainingSpeeds | null): string[] {
    if (baseline.fitnessMethod === 'easy_pace') {
        return [
            `Reported easy pace: ${pace(baseline.reportedEasySpeedKmh ?? 0)}`,
            'VDOT and race-based paces need a race or time-trial result.',
        ]
    }
    if (!speeds || baseline.vdot === null || baseline.race === null) return []
    const paces = (Object.keys(ZONES) as Zone[]).map((zone) => `${ZONES[zone].name.toLowerCase()} ${pace(speeds[zone])}`).join(', ')
    return [
        `Race result: ${raceLabel(baseline.race.distanceKm)} in ${formatDurationSeconds(baseline.race.seconds)}`,
        `VDOT: ${baseline.vdot.toFixed(1)}`,
        `Training paces: ${paces}`,
        ...(baseline.fitnessMethod === 'estimated_race' ? ['Estimate (provisional): confirm with a race or time trial.'] : []),
        ...(isExtrapolatedVdot(baseline.vdot) ? ['VDOT is outside the published range; paces are extrapolated.'] : []),
    ]
}

/** Where the goal race falls in the VDOT model's ideal 24-week season, or null when there is no date or it is out of range. */
export function goalNote(baseline: PersonalBaseline, today: Date): string | null {
    if (!baseline.goalRaceDate) return null
    const weeks = weeksUntil(baseline.goalRaceDate, today)
    const phase = seasonPhase(weeks)
    return phase
        ? `Your goal race is about ${weeks} week${weeks === 1 ? '' : 's'} away. In the VDOT model's ideal 24-week season that is the ${phase.name} phase: ${phase.summary}.`
        : null
}

/** What a zone is for and how hard it feels, from its definition in vdot.ts. */
export function zoneNote(zone: Zone): string {
    const { name, purpose, vo2MaxPercent, hrMaxPercent } = ZONES[zone]
    const ranges = [
        vo2MaxPercent && `${vo2MaxPercent[0]}–${vo2MaxPercent[1]}% of VO₂max`,
        hrMaxPercent && `${hrMaxPercent[0]}–${hrMaxPercent[1]}% of max heart rate`,
    ].filter(Boolean).join(', ')
    return `${name} (${zone}): ${purpose}${ranges ? ` Roughly ${ranges}.` : ''}`
}
