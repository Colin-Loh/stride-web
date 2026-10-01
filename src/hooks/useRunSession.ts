import { useEffect, useRef, useState } from 'react'
import { elapsedMs, type RunSession } from '../storage'
import { runProgress, type RunProgress } from '../run/engine'
import { clampSpeed } from '../plan/convert'
import { prepareRunAudio } from '../audio'

export function useRunSession(session: RunSession, onSession: (s: RunSession) => void, onComplete: (result: RunProgress) => void) {
  const [now, setNow] = useState(Date.now)
  const running = Boolean(session.startedAt) && !session.paused && !session.completed
  useEffect(() => {
    const refresh = () => setNow(Date.now())
    const id = running ? window.setInterval(refresh, 200) : undefined
    document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', refresh) }
  }, [running])
  const elapsed = elapsedMs(session, now)
  const progress = runProgress(session.plan, session.speedChanges, elapsed)
  const finish = runProgress(session.plan, session.speedChanges, Infinity)
  // Reported once on the completing tick; the object identity changes every render.
  const latest = useRef(progress)
  useEffect(() => { latest.current = progress })
  useEffect(() => { if (running && latest.current.done) onComplete(latest.current) }, [running, progress.done, onComplete])
  function start() {
    prepareRunAudio(); const time = Date.now(); setNow(time)
    onSession({ ...session, startedAt: time, pausedMs: 0, paused: false, completed: false })
  }
  function pause() { const time = Date.now(); setNow(time); onSession({ ...session, paused: true, pauseStartedAt: time }) }
  function resume() {
    prepareRunAudio(); const time = Date.now(); setNow(time)
    onSession({ ...session, paused: false, pausedMs: session.pausedMs + time - (session.pauseStartedAt ?? time), pauseStartedAt: undefined })
  }
  function adjustSpeed(delta: number) {
    const atMs = elapsedMs(session)
    const current = runProgress(session.plan, session.speedChanges, atMs)
    if (current.done || current.speed === null) return
    const previous = session.speedChanges.at(-1)?.offset ?? 0
    const offset = Math.round((previous + clampSpeed(current.speed + delta) - current.speed) * 10) / 10
    onSession({ ...session, speedChanges: [...session.speedChanges, { atMs, offset }] })
  }
  return { running, progress, remaining: Math.max(0, finish.elapsedMs - progress.elapsedMs), start, pause, resume, adjustSpeed }
}
