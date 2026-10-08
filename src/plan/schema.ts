import { intervalCount } from './intervals'
import { calculateSectionMetrics } from './metrics'
import type { PersonalizedWorkout } from './types'

/** Flattened step list for the workout engine, expanding each rep and recovery. */
export function planToSchema(plan: PersonalizedWorkout): {
    type: 'warmup' | 'run' | 'rest' | 'cooldown'
    duration_seconds: number
    target_rpe: number | null
    audio_cue: string
}[] {
    const steps: { type: 'warmup' | 'run' | 'rest' | 'cooldown'; duration_seconds: number; target_rpe: number | null; audio_cue: string }[] = []
    for (const item of plan.sections) {
        const metrics = calculateSectionMetrics(item)
        const seconds = metrics.durationSeconds ?? 0
        const mix = item.runWalk
        if (!mix) {
            steps.push({
                type: item.type === 'run' ? 'run' : item.type,
                duration_seconds: seconds,
                target_rpe: item.targetRpe ?? null,
                audio_cue: item.audioCue ?? item.effort,
            })
            continue
        }
        const reps = intervalCount(seconds, mix.runSeconds, mix.walkSeconds)
        let remaining = seconds
        for (let rep = 1; rep <= reps; rep++) {
            steps.push({
                type: 'run',
                duration_seconds: Math.min(remaining, mix.runSeconds),
                target_rpe: mix.runRpe ?? item.targetRpe ?? null,
                audio_cue: `Rep ${rep} of ${reps}. ${mix.runCue ?? item.effort}`,
            })
            remaining -= Math.min(remaining, mix.runSeconds)
            if (remaining <= 1e-9) break
            steps.push({
                type: 'rest',
                duration_seconds: Math.min(remaining, mix.walkSeconds),
                target_rpe: mix.walkRpe ?? null,
                audio_cue: rep === reps
                    ? 'Last recovery. Keep moving, cool-down next.'
                    : `${mix.walkCue ?? 'Recover.'} ${reps - rep} rep${reps - rep === 1 ? '' : 's'} to go.`,
            })
            remaining -= Math.min(remaining, mix.walkSeconds)
        }
    }
    return steps
}

