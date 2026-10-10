export type Character = 'shiba' | 'shooshy'

/** What the runner sees for each character. */
export const CHARACTER_NAMES: Record<Character, string> = { shiba: 'Chase', shooshy: 'Shooshy' }

/** Saves from before the rename stored the second character as 'cat', and older ones as 'girl'. */
export const toCharacter = (value: unknown): Character => (value === 'shooshy' || value === 'cat' || value === 'girl' ? 'shooshy' : 'shiba')

/** Heaviest and lightest body weight accepted, in kg. Only a typo guard, not a health range. */
export const WEIGHT_KG_LIMITS = { min: 20, max: 300 } as const

/** A body weight in kg inside the limits, or null for anything else (including a non-number). */
export function toWeightKg(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value >= WEIGHT_KG_LIMITS.min && value <= WEIGHT_KG_LIMITS.max ? value : null
}

/** Typed weight: empty text is a valid "no weight"; otherwise a number (comma or point) inside the limits. */
export function parseWeightKg(text: string): { ok: boolean; kg: number | null } {
    const trimmed = text.trim()
    if (trimmed === '') return { ok: true, kg: null }
    const kg = toWeightKg(Number(trimmed.replace(',', '.')))
    return { ok: kg !== null, kg }
}

/** Who is running and how the app sounds. Not part of any plan. */
export interface Preferences {
    /** Null until the runner has entered a name. */
    name: string | null
    character: Character
    muted: boolean
    /** Optional body weight in kg, used only for the calorie estimate. Null when not given. */
    weightKg: number | null
}

export const DEFAULT_PREFERENCES: Preferences = { name: null, character: 'shiba', muted: false, weightKg: null }
