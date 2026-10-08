export type WorkoutId = 'easy' | 'tempo' | 'cruise' | 'long' | 'interval' | 'test'

export const WORKOUTS: { id: WorkoutId; name: string; blurb: string }[] = [
  { id: 'test', name: 'Test run', blurb: 'Warm-up, steady, and cool-down: 30 seconds each, 90 seconds total.' },
  { id: 'easy', name: 'Easy run', blurb: 'Relaxed aerobic work at your Daniels easy pace.' },
  { id: 'tempo', name: 'Tempo run', blurb: 'A steady block at threshold pace, comfortably hard.' },
  { id: 'cruise', name: 'Cruise intervals', blurb: 'Repeated 5-minute reps at threshold pace with a short easy jog, for sustained threshold effort.' },
  { id: 'interval', name: 'Interval run', blurb: 'Hard 3-minute reps at interval pace with a jog recovery, to build aerobic power.' },
  { id: 'long', name: 'Long run', blurb: 'Your longest easy run of the week, sized by your weekly distance.' },
]
