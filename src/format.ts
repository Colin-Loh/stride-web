const pad = (value: number) => String(value).padStart(2, '0')

/** A whole-second clock display shared by both unit-specific wrappers. */
function clockText(total: number): string {
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}
export function formatDurationMs(ms: number): string {
  return clockText(Math.max(0, Math.floor(ms / 1000)))
}
export function formatDurationSeconds(seconds: number): string {
  return clockText(Math.max(0, Math.round(seconds)))
}
