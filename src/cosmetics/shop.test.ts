import { describe, expect, it, vi } from 'vitest'
import { SCHEMA_VERSION, type Progression } from '../domain/types'
import { COSMETICS, COSMETIC_BY_ID, itemsFor, nothingWorn } from './catalog'
import { canAfford, dropUnknownItems, equip, normalizeEquipped, purchase, unequip } from './shop'
import { LocalStorageProgressionRepository } from '../storage/localStorage'

const STAMP = '2026-10-01T00:00:00.000Z'
const NOW = new Date('2026-10-10T09:00:00.000Z')

const base = (overrides: Partial<Progression> = {}): Progression => ({
    id: 'progression',
    schemaVersion: SCHEMA_VERSION,
    createdAt: STAMP,
    updatedAt: STAMP,
    startDate: '2026-10-01',
    wallets: { shiba: 0, shooshy: 0 },
    lastClaimedDate: { shiba: '2026-10-01', shooshy: '2026-10-01' },
    rewardedRunIds: [], grantsApplied: [],
    inventory: { shiba: [], shooshy: [] },
    equipped: { shiba: nothingWorn(), shooshy: nothingWorn() },
    ...overrides,
})

/** A progression that already owns the given ids, with enough currency in both wallets to buy them. */
const owning = (...ids: string[]): Progression => {
    let p = base({ wallets: { shiba: 99, shooshy: 99 } })
    for (const id of ids) p = purchase(p, id, NOW).progression
    return p
}

describe('catalog', () => {
    it('has one item per slot for Shooshy and two items for Chase (no Chase hotdog yet)', () => {
        expect(itemsFor('shooshy').map((item) => item.slot).sort()).toEqual(['body', 'face', 'head'])
        expect(itemsFor('shiba').map((item) => item.id).sort()).toEqual(['chase-black-sunglasses', 'chase-sushi-hat'])
        expect(COSMETICS).toHaveLength(5)
    })

    it('uses the decided names, slots and prices', () => {
        expect(COSMETIC_BY_ID['chase-black-sunglasses']).toMatchObject({ slot: 'face', price: 2, name: 'Black sunglasses' })
        expect(COSMETIC_BY_ID['chase-sushi-hat']).toMatchObject({ slot: 'head', price: 3, name: 'Sushi hat' })
        expect(COSMETIC_BY_ID['shooshy-black-sunglasses']).toMatchObject({ slot: 'face', price: 2, name: 'Black sunglasses' })
        expect(COSMETIC_BY_ID['shooshy-hotdog']).toMatchObject({ slot: 'body', price: 4, name: 'Hotdog outfit' })
        expect(COSMETIC_BY_ID['shooshy-sushi-hat']).toMatchObject({ slot: 'head', price: 3, name: 'Sushi hat' })
    })

    it('gives every price as an integer from 1 to 5, and art at public/cosmetics/<id>.png', () => {
        for (const item of COSMETICS) {
            expect(Number.isInteger(item.price)).toBe(true)
            expect(item.price).toBeGreaterThanOrEqual(1)
            expect(item.price).toBeLessThanOrEqual(5)
            expect(item.artPath).toBe(`public/cosmetics/${item.id}.png`)
        }
    })
})

describe('purchase', () => {
    it('succeeds at the exact balance and leaves 0', () => {
        const p = base({ wallets: { shiba: 3, shooshy: 0 } })
        const result = purchase(p, 'chase-sushi-hat', NOW)
        expect(result.ok).toBe(true)
        expect(result.progression.wallets).toEqual({ shiba: 0, shooshy: 0 })
        expect(result.progression.inventory.shiba).toEqual(['chase-sushi-hat'])
        expect(result.progression.updatedAt).toBe(NOW.toISOString())
    })

    it('fails 1 short and leaves the input deep-equal', () => {
        const p = base({ wallets: { shiba: 2, shooshy: 0 } })
        const snapshot = structuredClone(p)
        const result = purchase(p, 'chase-sushi-hat', NOW)
        expect(result.ok).toBe(false)
        expect(result.reason).toBe('unaffordable')
        expect(result.progression).toEqual(snapshot)
        expect(p).toEqual(snapshot)
    })

    it('refuses a second purchase of the same item and leaves the wallet unchanged', () => {
        const first = purchase(base({ wallets: { shiba: 10, shooshy: 0 } }), 'chase-sushi-hat', NOW)
        const second = purchase(first.progression, 'chase-sushi-hat', NOW)
        expect(second.ok).toBe(false)
        expect(second.reason).toBe('owned')
        expect(second.progression).toEqual(first.progression)
        expect(second.progression.wallets.shiba).toBe(7)
        expect(second.progression.inventory.shiba).toEqual(['chase-sushi-hat'])
    })

    it('does not let Chase buy a fish item, even with fish in the wallet', () => {
        const chase = purchase(base({ wallets: { shiba: 0, shooshy: 10 } }), 'chase-sushi-hat', NOW)
        expect(chase.ok).toBe(false)
        expect(chase.reason).toBe('unaffordable')
    })

    it('does not let Shooshy buy a bone item, even with bones in the wallet', () => {
        const p = base({ wallets: { shiba: 10, shooshy: 0 } })
        const result = purchase(p, 'shooshy-sushi-hat', NOW)
        expect(result.ok).toBe(false)
        expect(result.reason).toBe('unaffordable')
        expect(result.progression).toEqual(p)
    })

    it('spends only the item character wallet', () => {
        const p = base({ wallets: { shiba: 3, shooshy: 7 } })
        const result = purchase(p, 'shooshy-hotdog', NOW)
        expect(result.progression.wallets).toEqual({ shiba: 3, shooshy: 3 })
        expect(result.progression.inventory).toEqual({ shiba: [], shooshy: ['shooshy-hotdog'] })
    })

    it('rejects an unknown id without changing anything', () => {
        const p = base({ wallets: { shiba: 9, shooshy: 9 } })
        const result = purchase(p, 'not-a-thing', NOW)
        expect(result.ok).toBe(false)
        expect(result.reason).toBe('unknown')
        expect(result.progression).toEqual(p)
    })

    it('never mutates the input progression', () => {
        const p = base({ wallets: { shiba: 5, shooshy: 0 } })
        const snapshot = structuredClone(p)
        purchase(p, 'chase-sushi-hat', NOW)
        expect(p).toEqual(snapshot)
    })
})

describe('canAfford', () => {
    it('checks the item character wallet only', () => {
        const p = base({ wallets: { shiba: 3, shooshy: 0 } })
        expect(canAfford(p, 'chase-sushi-hat')).toBe(true)
        expect(canAfford(p, 'shooshy-hotdog')).toBe(false)
        expect(canAfford(p, 'shooshy-sushi-hat')).toBe(false)
        expect(canAfford(p, 'nope')).toBe(false)
    })
})

describe('equip and unequip', () => {
    it('fails before purchase and succeeds after', () => {
        const p = base({ wallets: { shiba: 3, shooshy: 0 } })
        const before = equip(p, 'chase-sushi-hat')
        expect(before.ok).toBe(false)
        expect(before.reason).toBe('not-owned')
        expect(before.progression).toEqual(p)

        const bought = purchase(p, 'chase-sushi-hat', NOW).progression
        const after = equip(bought, 'chase-sushi-hat')
        expect(after.ok).toBe(true)
        expect(after.progression.equipped.shiba.head).toBe('chase-sushi-hat')
    })

    it('fails for an unknown id', () => {
        const result = equip(base(), 'nope')
        expect(result.ok).toBe(false)
        expect(result.reason).toBe('unknown')
    })

    it('replaces only the item in the same slot', () => {
        let p = owning('chase-sushi-hat', 'chase-black-sunglasses')
        p = equip(p, 'chase-sushi-hat').progression
        p = equip(p, 'chase-black-sunglasses').progression
        expect(p.equipped.shiba).toEqual({ face: 'chase-black-sunglasses', head: 'chase-sushi-hat', body: null })
        expect(p.inventory.shiba).toEqual(['chase-sushi-hat', 'chase-black-sunglasses'])
    })

    it('equipping three items in three slots leaves all three worn', () => {
        let p = owning('shooshy-black-sunglasses', 'shooshy-hotdog', 'shooshy-sushi-hat')
        p = equip(p, 'shooshy-black-sunglasses').progression
        p = equip(p, 'shooshy-hotdog').progression
        p = equip(p, 'shooshy-sushi-hat').progression
        expect(p.equipped.shooshy).toEqual({ face: 'shooshy-black-sunglasses', head: 'shooshy-sushi-hat', body: 'shooshy-hotdog' })
    })

    it('an item in one slot leaves the worn items in other slots alone', () => {
        let p = owning('shooshy-black-sunglasses', 'shooshy-hotdog', 'shooshy-sushi-hat')
        p = equip(p, 'shooshy-black-sunglasses').progression
        p = equip(p, 'shooshy-hotdog').progression
        p = equip(p, 'shooshy-sushi-hat').progression
        const hatAgain = equip(p, 'shooshy-sushi-hat').progression
        expect(hatAgain.equipped.shooshy).toEqual({ face: 'shooshy-black-sunglasses', head: 'shooshy-sushi-hat', body: 'shooshy-hotdog' })
    })

    it('does not touch the other character when equipping', () => {
        let p = owning('chase-sushi-hat', 'shooshy-sushi-hat')
        p = equip(p, 'chase-sushi-hat').progression
        p = equip(p, 'shooshy-sushi-hat').progression
        expect(p.equipped.shiba.head).toBe('chase-sushi-hat')
        expect(p.equipped.shooshy.head).toBe('shooshy-sushi-hat')
    })

    it('a shiba cannot equip a shooshy item, and a shooshy cannot equip a shiba item', () => {
        const shibaWearsFish = equip(base({ inventory: { shiba: ['shooshy-sushi-hat'], shooshy: [] } }), 'shooshy-sushi-hat')
        expect(shibaWearsFish.ok).toBe(false)
        expect(shibaWearsFish.reason).toBe('not-owned')
        const shooshyWearsBone = equip(base({ inventory: { shiba: [], shooshy: ['chase-sushi-hat'] } }), 'chase-sushi-hat')
        expect(shooshyWearsBone.ok).toBe(false)
        expect(shooshyWearsBone.reason).toBe('not-owned')
    })

    it('unequip clears only the named slot and leaves inventory unchanged', () => {
        let p = owning('chase-black-sunglasses', 'chase-sushi-hat')
        p = equip(p, 'chase-black-sunglasses').progression
        p = equip(p, 'chase-sushi-hat').progression
        const inventoryBefore = structuredClone(p.inventory)
        const after = unequip(p, 'shiba', 'face')
        expect(after.equipped.shiba).toEqual({ face: null, head: 'chase-sushi-hat', body: null })
        expect(after.inventory).toEqual(inventoryBefore)
    })

    it('unequip on one character does not touch the other', () => {
        let p = owning('chase-sushi-hat', 'shooshy-sushi-hat')
        p = equip(p, 'chase-sushi-hat').progression
        p = equip(p, 'shooshy-sushi-hat').progression
        const after = unequip(p, 'shiba', 'head')
        expect(after.equipped.shooshy.head).toBe('shooshy-sushi-hat')
    })

    it('equip and unequip cost nothing', () => {
        let p = owning('chase-sushi-hat')
        const walletBefore = { ...p.wallets }
        for (let i = 0; i < 3; i++) {
            p = equip(p, 'chase-sushi-hat').progression
            p = unequip(p, 'shiba', 'head')
        }
        expect(p.wallets).toEqual(walletBefore)
    })
})

describe('normalizeEquipped', () => {
    it('clears a slot whose id is not in the inventory and keeps the other slots', () => {
        const p = base({
            wallets: { shiba: 0, shooshy: 2 },
            inventory: { shiba: ['chase-sushi-hat'], shooshy: ['shooshy-sushi-hat'] },
            equipped: {
                shiba: { face: 'chase-black-sunglasses', head: 'chase-sushi-hat', body: null },
                shooshy: { face: null, head: 'shooshy-sushi-hat', body: null },
            },
        })
        const fixed = normalizeEquipped(p)
        expect(fixed.equipped.shiba).toEqual({ face: null, head: 'chase-sushi-hat', body: null })
        expect(fixed.equipped.shooshy).toEqual({ face: null, head: 'shooshy-sushi-hat', body: null })
        expect(fixed.inventory).toEqual(p.inventory)
        expect(fixed.wallets).toEqual(p.wallets)
    })

    it('returns the same object when nothing is stale', () => {
        const p = base({
            inventory: { shiba: ['chase-sushi-hat'], shooshy: [] },
            equipped: { shiba: { face: null, head: 'chase-sushi-hat', body: null }, shooshy: nothingWorn() },
        })
        expect(normalizeEquipped(p)).toBe(p)
    })

    it('does not mutate the input', () => {
        const p = base({ equipped: { shiba: { face: 'chase-black-sunglasses', head: null, body: null }, shooshy: nothingWorn() } })
        const snapshot = structuredClone(p)
        normalizeEquipped(p)
        expect(p).toEqual(snapshot)
    })
})

describe('dropUnknownItems', () => {
    it('removes inventory ids that are not in the catalog and changes no wallet', () => {
        const p = base({ wallets: { shiba: 1, shooshy: 1 }, inventory: { shiba: ['not-real', 'chase-sushi-hat'], shooshy: [] } })
        const fixed = dropUnknownItems(p)
        expect(fixed.inventory.shiba).toEqual(['chase-sushi-hat'])
        expect(fixed.wallets).toEqual({ shiba: 1, shooshy: 1 })
    })

    it('returns the same object when every id is known', () => {
        const p = base({ inventory: { shiba: ['chase-sushi-hat'], shooshy: [] } })
        expect(dropUnknownItems(p)).toBe(p)
    })
})

describe('load path', () => {
    it('clears a stored equipped slot that is not owned, through the progression repository', async () => {
        const values = new Map<string, string>()
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => values.set(key, value),
            removeItem: (key: string) => values.delete(key),
        })
        try {
            const stored = base({
                wallets: { shiba: 2, shooshy: 0 },
                grantsApplied: ['test-currency-20', 'refund-legacy-accessories-v1'],
                equipped: { shiba: { face: null, head: 'chase-sushi-hat', body: null }, shooshy: nothingWorn() },
            })
            values.set('stride.progression', JSON.stringify(stored))
            const loaded = await new LocalStorageProgressionRepository().load()
            expect(loaded.equipped).toEqual({ shiba: nothingWorn(), shooshy: nothingWorn() })
            expect(loaded.wallets).toEqual({ shiba: 2, shooshy: 0 })
        } finally {
            vi.unstubAllGlobals()
        }
    })
})
