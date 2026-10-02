import { isPositiveFinite, speedFromPaceSecondsPerKm } from './convert'
import { DEFAULT_EASY_PACE_SECONDS, DEFAULT_WALK_PACE_SECONDS } from './rules'
import type { BaselineAnswers, PersonalBaseline } from './types'
import { danielsSpeeds, vdotFromEasySpeed, vdotFromRace, VDOT_RANGE } from './vdot'

export type BaselineField =
    | 'race'
    | 'weekly'
    | 'days'
    | 'continuity'
    | 'pace'
    | 'walkPace'
    | 'intervals'

/**
 * Which follow-up questions still need asking, so we can skip the rest.
 * Time available is optional, so it is never missing.
 */
export function missingBaselineFields(
    answers: BaselineAnswers,
): BaselineField[] {
    const fields: BaselineField[] = []
    if (answers.raceKnown === undefined || (answers.raceKnown && raceResult(answers) === null)) fields.push('race')
    if (!isPositiveFinite(answers.weeklyKm)) fields.push('weekly')
    if (validDays(answers.daysPerWeek) === null) fields.push('days')
    if (answers.continuity === undefined) fields.push('continuity')
    // A race already sets every pace, so the comfortable-pace question is only needed without one.
    const paceInvalid = answers.paceKnown && paceToSpeed(answers.paceMinutes, answers.paceSeconds) === null
    if (paceInvalid || (answers.paceKnown === undefined && raceResult(answers) === null)) fields.push('pace')
    if (answers.continuity === 'run-walk' && (answers.walkPaceKnown === undefined || (answers.walkPaceKnown && paceToSpeed(answers.walkPaceMinutes, answers.walkPaceSeconds) === null))) {
        fields.push('walkPace')
    }
    if (answers.continuity === 'run-walk' && (!isPositiveFinite(answers.runMinutes ?? 2) || !isPositiveFinite(answers.walkMinutes ?? 1))) fields.push('intervals')
    return fields
}

/** A whole number of running days from 1 to 7, or null. */
function validDays(days: number | undefined): number | null {
    return Number.isInteger(days) && days! >= 1 && days! <= 7 ? days! : null
}

/** A race or time trial that gives a believable VDOT, or null. */
export function raceResult(answers: BaselineAnswers): { distanceKm: number; seconds: number; vdot: number } | null {
    if (!answers.raceKnown || !isPositiveFinite(answers.raceDistanceKm) || !isPositiveFinite(answers.raceSeconds)) return null
    const vdot = vdotFromRace(answers.raceDistanceKm, answers.raceSeconds)
    if (!(vdot >= VDOT_RANGE.min && vdot <= VDOT_RANGE.max)) return null
    return { distanceKm: answers.raceDistanceKm, seconds: answers.raceSeconds, vdot }
}

function paceToSpeed(
    minutes: number | undefined,
    seconds: number | undefined,
): number | null {
    if (!Number.isInteger(minutes ?? 0) || (minutes ?? 0) < 0) return null
    const sec = seconds ?? 0
    if (minutes === undefined && seconds === undefined) return null
    if (!Number.isInteger(sec) || sec < 0 || sec > 59) return null
    const total = (minutes ?? 0) * 60 + sec
    return isPositiveFinite(total) ? speedFromPaceSecondsPerKm(total) : null
}

/**
 * Works out a comfortable running speed: from a race, from the runner's own pace, or
 * -- when they say they do not know it -- from a gentle beginner default.
 */
export function derivePersonalBaseline(
    answers: BaselineAnswers,
): PersonalBaseline {
    const missing: string[] = []

    let speedKmh: number | null = null
    let speedSource: PersonalBaseline['speedSource'] = 'unknown'
    const race = raceResult(answers)
    if (answers.raceKnown && race === null) {
        missing.push('A race distance and finish time that add up to a realistic run')
    }

    if (answers.paceKnown) {
        speedKmh = paceToSpeed(answers.paceMinutes, answers.paceSeconds)
        if (speedKmh) {
            speedSource = 'reported-pace'
        } else if (race === null) {
            missing.push('A comfortable pace with seconds between 00 and 59')
        }
    }

    // No race and no known pace: start from a gentle jog almost any beginner can hold.
    if (speedKmh === null && race === null && answers.paceKnown === false) {
        speedKmh = speedFromPaceSecondsPerKm(DEFAULT_EASY_PACE_SECONDS)
        speedSource = 'default'
    }

    // A race sets the easy range. A reported easy pace inside it is kept; outside it, it is
    // moved to the nearest edge, and with no reported pace the middle of the range is used.
    const reportedSpeedKmh = speedSource === 'reported-pace' ? speedKmh : null
    let vdot: number | null = null
    let vdotSource: PersonalBaseline['vdotSource'] = null
    if (race) {
        vdot = race.vdot
        vdotSource = 'race'
        const zones = danielsSpeeds(race.vdot)
        const inRange = speedKmh !== null && speedKmh >= zones.easySlowKmh && speedKmh <= zones.easyFastKmh
        if (!inRange) {
            speedKmh = speedKmh === null
                ? (zones.easySlowKmh + zones.easyFastKmh) / 2
                : Math.min(zones.easyFastKmh, Math.max(zones.easySlowKmh, speedKmh))
            speedSource = 'race'
        }
    } else if (speedKmh !== null) {
        // Very slow paces sit outside what the equations were fitted to; leave VDOT unknown.
        const estimate = vdotFromEasySpeed(speedKmh)
        if (estimate >= VDOT_RANGE.min && estimate <= VDOT_RANGE.max) {
            vdot = estimate
            vdotSource = 'easy-pace'
        }
    }

    if (speedKmh === null) {
        missing.push('Your comfortable running pace or a recent race')
    }

    const weeklyKm = isPositiveFinite(answers.weeklyKm) ? answers.weeklyKm : null
    if (weeklyKm === null) {
        missing.push('How far you run in a typical week')
    }
    const daysPerWeek = validDays(answers.daysPerWeek)
    if (daysPerWeek === null) {
        missing.push('How many days a week you run, from 1 to 7')
    }

    const continuity = answers.continuity ?? 'continuous'

    let walkSpeedKmh: number | null = null
    let walkSpeedSource: PersonalBaseline['walkSpeedSource'] = null
    if (continuity === 'run-walk') {
        if (answers.walkPaceKnown) {
            walkSpeedKmh = paceToSpeed(answers.walkPaceMinutes, answers.walkPaceSeconds)
            if (walkSpeedKmh === null) missing.push('A walking pace with seconds between 00 and 59')
            else walkSpeedSource = 'reported'
        } else if (answers.walkPaceKnown === false) {
            // Not known: an ordinary walking speed, so walk spells still have a speed and distance.
            walkSpeedKmh = speedFromPaceSecondsPerKm(DEFAULT_WALK_PACE_SECONDS)
            walkSpeedSource = 'default'
        } else {
            missing.push('Your walking pace, or that you do not know it')
        }
    }

    const availableSeconds = isPositiveFinite(answers.availableMinutes)
        ? Math.round(answers.availableMinutes * 60)
        : null

    return {
        speedKmh,
        speedSource,
        reportedSpeedKmh,
        vdot,
        vdotSource,
        race: race ? { distanceKm: race.distanceKm, seconds: race.seconds } : null,
        weeklyKm,
        daysPerWeek,
        continuity,
        walkSpeedKmh,
        walkSpeedSource,
        runSeconds: Math.max(1, Math.round((answers.runMinutes ?? 2) * 60)),
        walkSeconds: Math.max(1, Math.round((answers.walkMinutes ?? 1) * 60)),
        availableSeconds,
        missing,
    }
}
