import type { Character } from '../domain/preferences'

/** Where an item is worn. Each slot holds at most one item per character. */
export type Slot = 'face' | 'head' | 'body'

export const SLOTS: readonly Slot[] = ['face', 'head', 'body']

export const CHARACTERS: readonly Character[] = ['shiba', 'shooshy']

/** One value per slot, with null for an empty slot. */
export type WornSlots = Record<Slot, string | null>

/** Nothing worn in any slot. */
export const nothingWorn = (): WornSlots => ({ face: null, head: null, body: null })

/** Every cosmetic id. Each item belongs to exactly one character and one slot. */
export const COSMETIC_IDS = [
    'chase-black-sunglasses',
    'chase-sushi-hat',
] as const

export type CosmeticId = (typeof COSMETIC_IDS)[number]

export interface Cosmetic {
    id: CosmeticId
    character: Character
    slot: Slot
    name: string
    /** Whole units of the owning character's wallet. */
    price: number
    /** Still-frame overlay art at public/cosmetics/<id>.png. */
    artPath: string
}

export const COSMETICS: readonly Cosmetic[] = [
    { id: 'chase-black-sunglasses', character: 'shiba', slot: 'face', name: 'Black sunglasses', price: 2, artPath: 'public/cosmetics/chase-black-sunglasses.png' },
    { id: 'chase-sushi-hat', character: 'shiba', slot: 'head', name: 'Sushi hat', price: 3, artPath: 'public/cosmetics/chase-sushi-hat.png' },
]

export const COSMETIC_BY_ID: Readonly<Record<CosmeticId, Cosmetic>> = Object.freeze(
    Object.fromEntries(COSMETICS.map((item) => [item.id, item])) as Record<CosmeticId, Cosmetic>,
)

/** Every cosmetic that belongs to one character, in catalog order. */
export function itemsFor(character: Character): Cosmetic[] {
    return COSMETICS.filter((item) => item.character === character)
}

/** True when the value is a known cosmetic id. */
export function isCosmeticId(value: unknown): value is CosmeticId {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(COSMETIC_BY_ID, value)
}
