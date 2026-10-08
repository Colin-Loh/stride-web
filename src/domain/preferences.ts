export type Character = 'shiba' | 'cat'

/** Old saves used 'girl' for the cat. */
export const toCharacter = (value: unknown): Character => (value === 'cat' || value === 'girl' ? 'cat' : 'shiba')

/** Who is running and how the app sounds. Not part of any plan. */
export interface Preferences {
    /** Null until the runner has entered a name. */
    name: string | null
    character: Character
    muted: boolean
}

export const DEFAULT_PREFERENCES: Preferences = { name: null, character: 'shiba', muted: false }
