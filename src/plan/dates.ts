import { MS_PER_DAY, MS_PER_WEEK } from './daniels'
import { toIsoDate } from './questions'

const utcMs = (isoDate: string) => Date.parse(`${isoDate}T00:00:00Z`)

/** Whole weeks, rounded up, from the local calendar day of `today` to an ISO date. */
export function weeksUntil(isoDate: string, today: Date): number {
    return Math.ceil((utcMs(isoDate) - utcMs(toIsoDate(today))) / MS_PER_WEEK)
}

/** The ISO date `days` after another ISO date. */
export function addDays(isoDate: string, days: number): string {
    return new Date(utcMs(isoDate) + days * MS_PER_DAY).toISOString().slice(0, 10)
}

/** Index (0-based) of the week containing `today`, clamped to the plan's weeks. */
export function currentWeekIndex(startDate: string, weekCount: number, today: Date): number {
    const weeks = Math.floor((utcMs(toIsoDate(today)) - utcMs(startDate)) / MS_PER_WEEK)
    return Math.min(Math.max(0, weeks), Math.max(0, weekCount - 1))
}
