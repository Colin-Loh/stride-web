import type { Character } from '../domain/preferences'

/** Every cosmetic id. Each item belongs to exactly one character. */
export const COSMETIC_IDS = [
    'chase-bandana',
    'chase-sunglasses',
    'chase-medal',
    'shooshy-ribbon',
    'shooshy-scarf',
    'shooshy-headband',
] as const

export type CosmeticId = (typeof COSMETIC_IDS)[number]

export interface Cosmetic {
    id: CosmeticId
    character: Character
    name: string
    /** Whole units of the owning character's wallet. */
    price: number
    /** Still-frame overlay art, created by the art ticket. */
    artPath: string
}

export const COSMETICS: readonly Cosmetic[] = [
    { id: 'chase-bandana', character: 'shiba', name: 'Bandana', price: 1, artPath: 'public/cosmetics/chase-bandana.png' },
    { id: 'chase-sunglasses', character: 'shiba', name: 'Aviator sunglasses', price: 3, artPath: 'public/cosmetics/chase-sunglasses.png' },
    { id: 'chase-medal', character: 'shiba', name: "Runner's medal", price: 5, artPath: 'public/cosmetics/chase-medal.png' },
    { id: 'shooshy-ribbon', character: 'shooshy', name: 'Ribbon bow', price: 1, artPath: 'public/cosmetics/shooshy-ribbon.png' },
    { id: 'shooshy-scarf', character: 'shooshy', name: 'Knit scarf', price: 3, artPath: 'public/cosmetics/shooshy-scarf.png' },
    { id: 'shooshy-headband', character: 'shooshy', name: 'Sports headband', price: 5, artPath: 'public/cosmetics/shooshy-headband.png' },
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
