import { useEffect, useRef } from 'react'
import { playTransitionChime, prepareRunAudio, setCueMuted, stopCue } from '../audio'
import { releaseWakeLock, requestWakeLock } from '../wakeLock'

export function useRunAudio(running: boolean, muted: boolean, phaseKey: string, done: boolean) {
  const previous = useRef(phaseKey)
  useEffect(() => {
    const changed = previous.current !== phaseKey
    previous.current = phaseKey
    if (changed && running && !done) playTransitionChime(muted)
  }, [phaseKey, running, done, muted])
  useEffect(() => { setCueMuted(muted) }, [muted])
  useEffect(() => {
    if (!running) { stopCue(); void releaseWakeLock(); return }
    const prepare = () => { if (document.visibilityState === 'visible') { prepareRunAudio(); void requestWakeLock() } }
    const onLeave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    prepare()
    document.addEventListener('visibilitychange', prepare)
    window.addEventListener('beforeunload', onLeave)
    return () => {
      document.removeEventListener('visibilitychange', prepare)
      window.removeEventListener('beforeunload', onLeave)
      stopCue(); void releaseWakeLock()
    }
  }, [running])
}
