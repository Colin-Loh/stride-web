import { toIsoDate } from '../plan/questions'

/**
 * The local calendar date (YYYY-MM-DD) of an instant, read from the device's local date getters.
 * Never derived from toISOString(), which is UTC and gives the wrong day near local midnight.
 */
export function localDateOf(value: number | string): string {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) throw new RangeError(`Not a date: ${value}`)
    return toIsoDate(date)
}
