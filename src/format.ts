export function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`
  }
  return `${minutes}:${pad(seconds)}`
}

export function kmhToPaceMin(kmh: number): number {
  return 60 / kmh
}

export function formatPace(minPerKm: number): string {
  const rounded = Math.round(minPerKm * 60)
  const minutes = Math.floor(rounded / 60)
  const seconds = rounded % 60
  return `${minutes}:${pad(seconds)}`
}

export function formatPaceRange(minKmh: number, maxKmh: number): string {
  const slow = formatPace(kmhToPaceMin(minKmh))
  const fast = formatPace(kmhToPaceMin(maxKmh))
  return `${fast} – ${slow}`
}

export function formatSpeedRange(minKmh: number, maxKmh: number): string {
  return `${minKmh.toFixed(1)} – ${maxKmh.toFixed(1)} km/h`
}

export function formatKm(km: number): string {
  return `${km.toFixed(1)} km`
}
