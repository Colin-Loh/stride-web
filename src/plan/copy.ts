import type { SectionType } from './types'

/** Words the runner reads and hears. Numbers that shape training live in vdot.ts, not here. */

export const EFFORT_LABELS: Record<SectionType, string> = {
    warmup: 'Easy, conversational — you should be able to talk in sentences',
    run: 'Steady and controlled at your target effort',
    cooldown: 'Very easy, letting your breathing settle',
}

/** Rate of perceived exertion (1-10), the fallback target when a session has no pace. */
export const EASY_RPE = 3
export const MARATHON_RPE = 5
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
    'Paces and session sizes follow the VDOT model. Some details, such as warm-up and cool-down lengths, are sensible defaults rather than exact model prescriptions, so adjust them to how you feel.'

/** Label for the answers screen's submit button, by what happens next. */
export const ANSWERS_SUBMIT_LABELS = {
    plan: 'Build my plan',
    workout: 'Build my workout',
    edit: 'Save my answers',
} as const

export type AnswersSubmitAction = keyof typeof ANSWERS_SUBMIT_LABELS

export const REDUCED_QUALITY_NOTE =
    'Your training effort asks for more speed days than a week allows: hard days (speed and steady runs) are capped and never back to back, and each week keeps easy runs. Some speed days were left out.'

export const CONFLICT_NOTE =
    'The VDOT model caps the Easy run by weekly volume and maximum duration, so another run may be longer. Adding a running day spreads the distance out.'

export const TAPER_NOTE = 'The weeks marked Taper before your goal race run less distance with the same familiar paces, and the last one has at most one hard day. Easy days stay easy.'
