let sentinel: WakeLockSentinel | null = null
let generation = 0
let pending = false
export async function requestWakeLock(): Promise<boolean> {
  if (sentinel && !sentinel.released) return true
  if (pending || !navigator.wakeLock) return false
  const requested = generation
  pending = true
  try {
    const lock = await navigator.wakeLock.request('screen')
    if (requested !== generation) { await lock.release(); return false }
    sentinel = lock
    lock.addEventListener('release', () => { if (sentinel === lock) sentinel = null })
    return true
  } catch { return false } finally { pending = false }
}
export async function releaseWakeLock(): Promise<void> {
  generation++
  const lock = sentinel; sentinel = null
  try { await lock?.release() } catch { /* Browser may already have released it. */ }
}
