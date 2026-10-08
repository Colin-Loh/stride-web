import { isPositiveFinite, formatPaceSeconds, paceSecondsPerKmFromSpeed, formatDurationSeconds } from './convert'
import { DEFAULT_EASY_PACE_SECONDS } from './rules'
import { raceLabel, type DanielsSpeeds } from './vdot'
import type { PersonalBaseline } from './types'

/** Where the paces came from, shown at the top of every plan that has them. */
export function danielsNote(baseline: PersonalBaseline, zones: DanielsSpeeds | null): string | null {
    if (!zones || !isPositiveFinite(baseline.vdot)) return null
    const pace = (kmh: number) => formatPaceSeconds(paceSecondsPerKmFromSpeed(kmh))
    const paces = `easy ${pace(zones.easyFastKmh)}–${pace(zones.easySlowKmh)}/km, threshold ${pace(zones.thresholdKmh)}/km, repetition ${pace(zones.repetitionKmh)}/km`
    const vdot = baseline.vdot.toFixed(1)
    if (baseline.vdotSource === 'race' && baseline.race) {
        return `Your ${raceLabel(baseline.race.distanceKm).toLowerCase()} in ${formatDurationSeconds(baseline.race.seconds)} gives a VDOT of ${vdot}. Jack Daniels' training paces for that: ${paces}.`
    }
    if (baseline.speedSource === 'default') {
        return `You did not know your pace, so we started you at ${formatPaceSeconds(DEFAULT_EASY_PACE_SECONDS)}/km, a gentle jog most beginners can hold. Daniels' formulas turn that into a VDOT of ${vdot}: ${paces}. Change the speed during the run if it feels too easy or too hard.`
    }
    return `From your comfortable pace we estimate a VDOT of ${vdot}: ${paces}. Add a recent race result for paces that fit you better.`
}

