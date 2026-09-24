let cue: HTMLAudioElement | null = null
let celebrationBuffer: Promise<AudioBuffer> | null = null
let celebrationSource: AudioBufferSourceNode | null = null
let celebrationRequest = 0
let chimeContext: AudioContext | null = null
let chimeGain: GainNode | null = null

function prepareChime(): void {
  try {
    chimeContext ??= new AudioContext()
    if (chimeContext.state === 'suspended') {
      void chimeContext.resume().catch(() => {})
    }
  } catch {
    // Keep the timer usable if Web Audio is unavailable.
  }
}

export function playTransitionChime(muted: boolean): void {
  if (muted || !chimeContext || chimeContext.state !== 'running') return
  chimeGain?.disconnect()
  const context = chimeContext
  const output = context.createGain()
  output.gain.value = 0.3
  output.connect(context.destination)
  chimeGain = output

  // Two gently fading notes make the section change distinct from the loop.
  ;[659.25, 880].forEach((frequency, index) => {
    const oscillator = context.createOscillator()
    const envelope = context.createGain()
    const start = context.currentTime + index * 0.2
    oscillator.frequency.value = frequency
    envelope.gain.setValueAtTime(0, start)
    envelope.gain.linearRampToValueAtTime(0.7, start + 0.015)
    envelope.gain.exponentialRampToValueAtTime(0.001, start + 0.7)
    oscillator.connect(envelope)
    envelope.connect(output)
    oscillator.start(start)
    oscillator.stop(start + 0.75)
    oscillator.onended = () => {
      oscillator.disconnect()
      envelope.disconnect()
    }
  })
}

function ensureCue(): HTMLAudioElement {
  if (!cue) {
    cue = new Audio(`${import.meta.env.BASE_URL}cue.wav`)
    cue.loop = true
    cue.volume = 0.06
  }
  return cue
}

function loadCelebration(): Promise<AudioBuffer> {
  const context = chimeContext
  if (!context) return Promise.reject(new Error('Audio unavailable'))
  celebrationBuffer ??= fetch(`${import.meta.env.BASE_URL}celebration.wav`)
    .then((response) => {
      if (!response.ok) throw new Error('Celebration audio could not load')
      return response.arrayBuffer()
    })
    .then((data) => context.decodeAudioData(data))
    .catch((error) => {
      celebrationBuffer = null
      throw error
    })
  return celebrationBuffer
}

export async function startCue(muted: boolean): Promise<void> {
  // Called by Start/Resume gestures so later transitions can play audio.
  prepareChime()
  void loadCelebration().catch(() => {})
  const audio = ensureCue()
  audio.muted = muted
  try {
    await audio.play()
  } catch {
    // Autoplay can fail until a later gesture.
  }
}

export function setCueMuted(muted: boolean): void {
  if (cue) cue.muted = muted
  if (muted) chimeGain?.disconnect()
}

export function stopCue(): void {
  chimeGain?.disconnect()
  if (!cue) return
  cue.pause()
  cue.currentTime = 0
}

export async function playCelebration(): Promise<boolean> {
  stopCue()
  stopCelebration()
  const request = celebrationRequest
  prepareChime()
  try {
    const buffer = await loadCelebration()
    const context = chimeContext
    if (request !== celebrationRequest || !context || context.state !== 'running') return false
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    celebrationSource = source
    source.onended = () => {
      source.disconnect()
      if (celebrationSource === source) celebrationSource = null
    }
    source.start()
    return true
  } catch {
    return false
  }
}

export function stopCelebration(): void {
  celebrationRequest += 1
  celebrationSource?.stop()
  celebrationSource?.disconnect()
  celebrationSource = null
}
