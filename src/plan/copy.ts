import type { SectionType } from './types'

/** Words the runner reads and hears. Numbers that shape training live in daniels.ts, not here. */

export const EFFORT_LABELS: Record<SectionType, string> = {
    warmup: 'Easy, conversational — you should be able to talk in sentences',
    run: 'Steady and controlled at your target effort',
    cooldown: 'Very easy, letting your breathing settle',
}

/** Rate of perceived exertion (1-10), the fallback target when a session has no pace. */
export const EASY_RPE = 3
export const THRESHOLD_RPE = 7

export interface RepeatCopy {
    title: string
    repLabel: string
    recoveryLabel: string
    rpe: { warmup: number; rep: number; recovery: number; cooldown: number }
    effort: { warmup: string; rep: string; recovery: string; cooldown: string }
    cue: { warmup: string; rep: string; recovery: string; cooldown: string }
}

const COOLDOWN_EFFORT = 'Gentle running or walking until your heart rate is back near baseline.'
const COOLDOWN_CUE = 'Cool-down. Well done. Gentle running or walking now, let the heart rate come down.'

/** Wording for the two repeated-rep sessions. */
export const REPEAT_COPY: Record<'interval' | 'repetition', RepeatCopy> = {
    interval: {
        title: 'Interval reps',
        repLabel: 'Rep',
        recoveryLabel: 'Jog',
        rpe: { warmup: 3, rep: 8, recovery: 2, cooldown: 2 },
        effort: {
            warmup: 'Easy and conversational, building towards the first hard rep.',
            rep: 'Hard but not all-out, about a 10-12 minute race effort. A few words at most.',
            recovery: 'Easy jog. Let your breathing settle before the next rep.',
            cooldown: COOLDOWN_EFFORT,
        },
        cue: {
            warmup: 'Warm-up. Easy pace, building towards the first hard rep.',
            rep: 'Go. Strong and smooth, hard but not a sprint.',
            recovery: 'Ease down to an easy jog and let your breathing settle.',
            cooldown: COOLDOWN_CUE,
        },
    },
    repetition: {
        title: 'Repetition reps',
        repLabel: 'Rep',
        recoveryLabel: 'Recovery',
        rpe: { warmup: 3, rep: 9, recovery: 1, cooldown: 2 },
        effort: {
            warmup: 'Easy and conversational, finishing with a few relaxed strides.',
            rep: 'Fast and relaxed, about mile-race effort. Stop while you are still in control.',
            recovery: 'Walk or jog until you are fully recovered. Do not rush the next rep.',
            cooldown: COOLDOWN_EFFORT,
        },
        cue: {
            warmup: 'Warm-up. Easy pace, with a few relaxed strides at the end.',
            rep: 'Go. Quick, light and relaxed.',
            recovery: 'Walk or jog until you feel fully recovered.',
            cooldown: COOLDOWN_CUE,
        },
    },
}

export const RULES_DISCLAIMER =
    'Paces and session sizes follow Jack Daniels\' VDOT system. Some details, such as warm-up and cool-down lengths, are sensible defaults rather than Daniels\' exact prescriptions, so adjust them to how you feel.'

/** Label for the answers screen's submit button, by what happens next. */
export const ANSWERS_SUBMIT_LABELS = {
    plan: 'Build my plan',
    workout: 'Build my workout',
    edit: 'Save my answers',
} as const

export type AnswersSubmitAction = keyof typeof ANSWERS_SUBMIT_LABELS

export const REDUCED_QUALITY_NOTE =
    'Your training effort asks for more speed days than your running days leave room for. Each week keeps a long run and at least one E run, so some speed days were left out.'

export const CONFLICT_NOTE =
    'Daniels caps the long run at a share of the week and at a maximum time, so with this many runs a week some of your E runs are longer than your long run. Adding a running day spreads the distance out.'
