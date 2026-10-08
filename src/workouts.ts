/** Every kind of workout the app builds. 'filler' is E running inside a training plan week; it has no card. */
export type WorkoutId = 'test' | 'long' | 'threshold' | 'interval' | 'repetition' | 'filler'

/** The workouts offered as cards on the session picker. */
export type PickableWorkoutId = Exclude<WorkoutId, 'filler'>

export const WORKOUT_NAMES: Record<WorkoutId, string> = {
    test: 'Test run',
    long: 'Long run',
    threshold: 'Threshold run',
    interval: 'Interval run',
    repetition: 'Repetition run',
    filler: 'E running',
}

export const WORKOUTS: { id: PickableWorkoutId; name: string; blurb: string }[] = [
    { id: 'test', name: WORKOUT_NAMES.test, blurb: 'Warm-up, steady, and cool-down: 30 seconds each, 90 seconds total.' },
    { id: 'threshold', name: WORKOUT_NAMES.threshold, blurb: 'A steady block at threshold (T) pace, comfortably hard, between easy warm-up and cool-down.' },
    { id: 'interval', name: WORKOUT_NAMES.interval, blurb: 'Hard 3-minute reps at interval (I) pace with a jog recovery, to build aerobic power.' },
    { id: 'repetition', name: WORKOUT_NAMES.repetition, blurb: 'Short, fast reps at repetition (R) pace with full recovery, for speed and economy.' },
    { id: 'long', name: WORKOUT_NAMES.long, blurb: 'Your longest easy run of the week, sized by your weekly distance.' },
]
