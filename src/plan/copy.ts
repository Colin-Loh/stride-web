import type { SectionType } from './types'

/** Words the runner reads and hears. Numbers that shape training live in daniels.ts, not here. */

export const EFFORT_LABELS: Record<SectionType, string> = {
    warmup: 'Easy, conversational — you should be able to talk in sentences',
    run: 'Steady and controlled at your target effort',
    cooldown: 'Very easy, letting your breathing settle',
}

/** Rate of perceived exertion (1-10), the fallback target when a session has no pace. */
export const EASY_RPE = 3
export const TEMPO_RPE = 7

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
export const REPEAT_COPY: Record<'cruise' | 'interval', RepeatCopy> = {
    cruise: {
        title: 'Cruise reps',
        repLabel: 'Rep',
        recoveryLabel: 'Easy jog',
        rpe: { warmup: 3, rep: 7, recovery: 3, cooldown: 2 },
        effort: {
            warmup: 'Easy and conversational, building towards threshold effort in the last minute.',
            rep: 'Comfortably hard and controlled. A few words at a time, not gasping.',
            recovery: 'Easy jog, not a full stop. Let your legs shake out while you keep moving.',
            cooldown: COOLDOWN_EFFORT,
        },
        cue: {
            warmup: 'Warm-up. Easy pace, building towards threshold effort by the end.',
            rep: 'Go. Settle into a strong, controlled rhythm.',
            recovery: 'Ease into an easy jog. Keep moving, do not stop.',
            cooldown: COOLDOWN_CUE,
        },
    },
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
}

export const RULES_DISCLAIMER =
    'Paces and session sizes come from Jack Daniels\' VDOT formulas (see src/plan/daniels.ts). Warm-up lengths and other items marked TODO(verify) in that file are product defaults, not validated training advice.'
