import { formatSpan } from './convert'
import { REPEAT_COPY } from './copy'
import { SESSION_STRUCTURE } from './daniels'
import { section } from './builderHelpers'
import type { PersonalBaseline, PersonalizedWorkout } from './types'

interface RepeatInput {
    category: 'cruise' | 'interval'
    categoryName: string
    baseline: PersonalBaseline
    reps: number
    repSeconds: number
    recoverySeconds: number
    /** Zone speed for the reps, or null when the runner has no VDOT. */
    repSpeedKmh: number | null
    /** Easy speed for the warm-up, cool-down and recovery jog. */
    easySpeedKmh: number | null
}

/** Easy warm-up, repeated hard reps with a jog between, easy cool-down. */
export function buildRepeatWorkout(input: RepeatInput): PersonalizedWorkout {
    const { category, baseline, reps, repSeconds, recoverySeconds, repSpeedKmh, easySpeedKmh } = input
    const copy = REPEAT_COPY[category]

    const warmup = section('warmup', 'warmup', 'Warm-up',
        { basis: 'time', durationSeconds: SESSION_STRUCTURE.warmupSeconds }, easySpeedKmh)
    warmup.effort = copy.effort.warmup
    warmup.targetRpe = copy.rpe.warmup
    warmup.audioCue = copy.cue.warmup

    const main = section('main', 'run', copy.title,
        { basis: 'time', durationSeconds: reps * (repSeconds + recoverySeconds) }, repSpeedKmh)
    main.effort = copy.effort.rep
    main.targetRpe = copy.rpe.rep
    main.audioCue = `${copy.title}. ${reps} of ${formatSpan(repSeconds)}. ${copy.cue.rep}`
    main.runWalk = {
        runSeconds: repSeconds,
        walkSeconds: recoverySeconds,
        walkSpeedKmh: easySpeedKmh,
        runLabel: copy.repLabel,
        walkLabel: copy.recoveryLabel,
        runCue: copy.cue.rep,
        walkCue: copy.cue.recovery,
        runRpe: copy.rpe.rep,
        walkRpe: copy.rpe.recovery,
    }

    const cooldown = section('cooldown', 'cooldown', 'Cool-down',
        { basis: 'time', durationSeconds: SESSION_STRUCTURE.cooldownSeconds }, easySpeedKmh)
    cooldown.effort = copy.effort.cooldown
    cooldown.targetRpe = copy.rpe.cooldown
    cooldown.audioCue = copy.cue.cooldown

    const explanation = [
        `${reps} reps of ${formatSpan(repSeconds)} with a ${formatSpan(recoverySeconds)} easy jog between each.`,
        repSpeedKmh === null
            ? `No race result, so no target pace: run the reps by effort (RPE ${copy.rpe.rep}).`
            : `Rep pace is your Daniels ${category === 'cruise' ? 'threshold' : 'interval'} pace.`,
    ]
    return { category, categoryName: input.categoryName, baseline, sections: [warmup, main, cooldown], explanation, adjustments: [] }
}
