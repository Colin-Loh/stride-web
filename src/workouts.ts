export type RunnerLevel = 'beginner' | 'intermediate' | 'advanced'
export type WorkoutId = 'easy' | 'tempo' | 'long' | 'test'
export type SegmentKind = 'warmup' | 'steady' | 'cooldown'

export interface SpeedRange {
  minKmh: number
  maxKmh: number
}

export interface SegmentTemplate {
  kind: SegmentKind
  label: string
  distanceKm: number
  fixedDurationMs?: number
  speed: SpeedRange
}

export interface WorkoutTemplate {
  id: WorkoutId
  name: string
  blurb: string
  segments: SegmentTemplate[]
}

export interface ResolvedSegment extends SegmentTemplate {
  speed: SpeedRange
  midKmh: number
  durationMs: number
}

export interface ResolvedWorkout {
  id: WorkoutId
  name: string
  blurb: string
  segments: ResolvedSegment[]
  totalDistanceKm: number
  totalDurationMs: number
}

export const LEVELS: Record<
  RunnerLevel,
  { label: string; criteria: string; speedFactor: number }
> = {
  beginner: {
    label: 'Beginner',
    criteria: 'Runs once or twice a week',
    speedFactor: 0.92,
  },
  intermediate: {
    label: 'Intermediate',
    criteria: 'Runs three or more times a week',
    speedFactor: 1,
  },
  advanced: {
    label: 'Advanced',
    criteria: 'Runs five or more times a week',
    speedFactor: 1.08,
  },
}

export const WORKOUTS: WorkoutTemplate[] = [
  {
    id: 'test',
    name: 'Test run',
    blurb: 'Try the timer and audio cue: 30 seconds per section, 90 seconds total.',
    segments: [
      { kind: 'warmup', label: 'Warm-up', distanceKm: 0, fixedDurationMs: 10_000, speed: { minKmh: 7.5, maxKmh: 8 } },
      { kind: 'steady', label: 'Steady section', distanceKm: 0, fixedDurationMs: 10_000, speed: { minKmh: 8.2, maxKmh: 8.8 } },
      { kind: 'cooldown', label: 'Cool-down', distanceKm: 0, fixedDurationMs: 10_000, speed: { minKmh: 7, maxKmh: 7.5 } },
    ],
  },
  {
    id: 'easy',
    name: 'Easy run',
    blurb: 'Relaxed aerobic work with a short steady section.',
    segments: [
      {
        kind: 'warmup',
        label: 'Warm-up',
        distanceKm: 1,
        speed: { minKmh: 7.5, maxKmh: 8.0 },
      },
      {
        kind: 'steady',
        label: 'Steady section',
        distanceKm: 4,
        speed: { minKmh: 8.2, maxKmh: 8.8 },
      },
      {
        kind: 'cooldown',
        label: 'Cool-down',
        distanceKm: 1,
        speed: { minKmh: 7.0, maxKmh: 7.5 },
      },
    ],
  },
  {
    id: 'tempo',
    name: 'Tempo run',
    blurb: 'Faster controlled effort between easy and race pace.',
    segments: [
      {
        kind: 'warmup',
        label: 'Warm-up',
        distanceKm: 1.5,
        speed: { minKmh: 8.0, maxKmh: 8.5 },
      },
      {
        kind: 'steady',
        label: 'Steady section',
        distanceKm: 4,
        speed: { minKmh: 10.3, maxKmh: 10.7 },
      },
      {
        kind: 'cooldown',
        label: 'Cool-down',
        distanceKm: 1.5,
        speed: { minKmh: 7.5, maxKmh: 8.0 },
      },
    ],
  },
  {
    id: 'long',
    name: 'Long run',
    blurb: 'Time on feet with a longer steady middle.',
    segments: [
      {
        kind: 'warmup',
        label: 'Warm-up',
        distanceKm: 2,
        speed: { minKmh: 7.8, maxKmh: 8.2 },
      },
      {
        kind: 'steady',
        label: 'Steady section',
        distanceKm: 8.5,
        speed: { minKmh: 8.3, maxKmh: 8.7 },
      },
      {
        kind: 'cooldown',
        label: 'Cool-down',
        distanceKm: 1.5,
        speed: { minKmh: 7.5, maxKmh: 7.8 },
      },
    ],
  },
]

export function midKmh(range: SpeedRange): number {
  return (range.minKmh + range.maxKmh) / 2
}

export function durationMsFor(distanceKm: number, speedKmh: number): number {
  return (distanceKm / speedKmh) * 3600 * 1000
}

export function scaleRange(range: SpeedRange, factor: number): SpeedRange {
  return {
    minKmh: range.minKmh * factor,
    maxKmh: range.maxKmh * factor,
  }
}

export function resolveWorkout(
  id: WorkoutId,
  level: RunnerLevel,
  quick = false,
): ResolvedWorkout {
  const template = WORKOUTS.find((workout) => workout.id === id)
  if (!template) {
    throw new Error(`Unknown workout: ${id}`)
  }

  const factor = LEVELS[level].speedFactor
  const segments = template.segments.map((segment) => {
    const speed = scaleRange(segment.speed, factor)
    const mid = midKmh(speed)
    let durationMs = segment.fixedDurationMs ?? durationMsFor(segment.distanceKm, mid)
    if (quick && segment.fixedDurationMs === undefined) {
      durationMs = Math.max(5000, durationMs * 0.008)
    }
    const distanceKm = segment.fixedDurationMs === undefined
      ? segment.distanceKm
      : mid * durationMs / 3_600_000
    return { ...segment, distanceKm, speed, midKmh: mid, durationMs }
  })

  return {
    id: template.id,
    name: template.name,
    blurb: template.blurb,
    segments,
    totalDistanceKm: segments.reduce((sum, segment) => sum + segment.distanceKm, 0),
    totalDurationMs: segments.reduce((sum, segment) => sum + segment.durationMs, 0),
  }
}
