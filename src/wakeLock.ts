type WakeLockSentinelLike = {
  released: boolean
  release: () => Promise<void>
  addEventListener: (type: 'release', listener: () => void) => void
}

let sentinel: WakeLockSentinelLike | null = null

export async function requestWakeLock(): Promise<boolean> {
  const nav = navigator as Navigator & {
    wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> }
  }
  if (!nav.wakeLock) return false
  try {
    sentinel = await nav.wakeLock.request('screen')
    sentinel.addEventListener('release', () => {
      sentinel = null
    })
    return true
  } catch {
    return false
  }
}

export async function releaseWakeLock(): Promise<void> {
  try {
    await sentinel?.release()
  } catch {
    // ignore
  }
  sentinel = null
}
