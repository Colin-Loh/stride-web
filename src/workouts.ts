export type WorkoutId = 'easy' | 'tempo' | 'cruise' | 'long' | 'interval' | 'test'

export const WORKOUTS: { id: WorkoutId; name: string; blurb: string }[] = [
  { id: 'test', name: 'Test run', blurb: 'Warm-up, steady, and cool-down: 30 seconds each, 90 seconds total.' },
  { id: 'easy', name: 'Easy run', blurb: 'Relaxed aerobic work at your comfortable pace.' },
  { id: 'tempo', name: 'Tempo run', blurb: 'A shorter session at a faster target pace.' },
  { id: 'cruise', name: 'Cruise intervals', blurb: 'Repeated reps at tempo pace with an easy jog recovery, for sustained threshold effort.' },
  { id: 'interval', name: 'Interval run', blurb: 'Short fast reps with full recovery, for cadence and top-end speed.' },
  { id: 'long', name: 'Long run', blurb: 'A longer steady session shaped by your capacity.' },
]
