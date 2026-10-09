import { formatPaceSeconds } from '../plan/convert'
import { formatDurationSeconds } from '../format'

/** Shown where a value is not known; never zero. */
export const MISSING = '—'

export const formatKm = (km: number | null): string => (km === null ? MISSING : km.toFixed(2))

export const formatPace = (secondsPerKm: number | null): string => (secondsPerKm === null ? MISSING : formatPaceSeconds(Math.round(secondsPerKm)))

export const formatClock = (seconds: number): string => formatDurationSeconds(seconds)

export const formatSpeed = (kmh: number | null): string => (kmh === null ? MISSING : kmh.toFixed(2))

export const formatKcal = (kcal: number | null): string => (kcal === null ? MISSING : `~${Math.round(kcal)}`)
