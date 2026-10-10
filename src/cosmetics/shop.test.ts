import { describe, expect, it, vi } from 'vitest'
import { SCHEMA_VERSION, type Progression } from '../domain/types'
import { COSMETICS, COSMETIC_BY_ID, itemsFor } from './catalog'
import { canAfford, equip, normalizeEquipped, purchase, unequip } from './shop'
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
    equipped: { shiba: null, shooshy: null },
    ...overrides,
})

describe('catalog', () => {
    it('has three items per character and each item belongs to one character', () => {
        expect(itemsFor('shiba').map((item) => item.id)).toEqual(['chase-bandana', 'chase-sunglasses', 'chase-medal'])
        expect(itemsFor('shooshy').map((item) => item.id)).toEqual(['shooshy-ribbon', 'shooshy-scarf', 'shooshy-headband'])
        expect(COSMETICS).toHaveLength(6)
    })

    it('uses the decided prices, with bones for Chase and fish for Shooshy', () => {
        expect(COSMETIC_BY_ID['chase-bandana'].price).toBe(1)
        expect(COSMETIC_BY_ID['chase-sunglasses'].price).toBe(3)
        expect(COSMETIC_BY_ID['chase-medal'].price).toBe(5)
        expect(COSMETIC_BY_ID['shooshy-ribbon'].price).toBe(1)
        expect(COSMETIC_BY_ID['shooshy-scarf'].price).toBe(3)
        expect(COSMETIC_BY_ID['shooshy-headband'].price).toBe(5)
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
        const p = base({ wallets: { shiba: 5, shooshy: 0 } })
        const result = purchase(p, 'chase-medal', NOW)
        expect(result.ok).toBe(true)
        expect(result.progression.wallets).toEqual({ shiba: 0, shooshy: 0 })
        expect(result.progression.inventory.shiba).toEqual(['chase-medal'])
        expect(result.progression.updatedAt).toBe(NOW.toISOString())
    })

    it('fails 1 short and leaves the input deep-equal', () => {
        const p = base({ wallets: { shiba: 4, shooshy: 0 } })
        const snapshot = structuredClone(p)
        const result = purchase(p, 'chase-medal', NOW)
        expect(result.ok).toBe(false)
        expect(result.reason).toBe('unaffordable')
        expect(result.progression).toEqual(snapshot)
        expect(p).toEqual(snapshot)
    })

    it('refuses a second purchase of the same item and leaves the wallet unchanged', () => {
        const first = purchase(base({ wallets: { shiba: 10, shooshy: 0 } }), 'chase-bandana', NOW)
        const second = purchase(first.progression, 'chase-bandana', NOW)
        expect(second.ok).toBe(false)
        expect(second.reason).toBe('owned')
        expect(second.progression).toEqual(first.progression)
        expect(second.progression.wallets.shiba).toBe(9)
        expect(second.progression.inventory.shiba).toEqual(['chase-bandana'])
    })

    it('does not let Chase buy a fish item, even with fish in the wallet', () => {
        const p = base({ wallets: { shiba: 0, shooshy: 10 } })
        expect(purchase(p, 'shooshy-scarf', NOW).ok).toBe(true)
        const chase = purchase(base({ wallets: { shiba: 0, shooshy: 10 } }), 'chase-bandana', NOW)
        expect(chase.ok).toBe(false)
        expect(chase.reason).toBe('unaffordable')
    })

    it('does not let Shooshy buy a bone item, even with bones in the wallet', () => {
        const p = base({ wallets: { shiba: 10, shooshy: 0 } })
        const result = purchase(p, 'shooshy-ribbon', NOW)
        expect(result.ok).toBe(false)
        expect(result.reason).toBe('unaffordable')
        expect(result.progression).toEqual(p)
    })

    it('spends only the item character wallet', () => {
        const p = base({ wallets: { shiba: 3, shooshy: 7 } })
        const result = purchase(p, 'shooshy-headband', NOW)
        expect(result.progression.wallets).toEqual({ shiba: 3, shooshy: 2 })
        expect(result.progression.inventory).toEqual({ shiba: [], shooshy: ['shooshy-headband'] })
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
        purchase(p, 'chase-medal', NOW)
        expect(p).toEqual(snapshot)
    })
})

describe('canAfford', () => {
    it('checks the item character wallet only', () => {
        const p = base({ wallets: { shiba: 3, shooshy: 0 } })
        expect(canAfford(p, 'chase-sunglasses')).toBe(true)
        expect(canAfford(p, 'chase-medal')).toBe(false)
        expect(canAfford(p, 'shooshy-ribbon')).toBe(false)
        expect(canAfford(p, 'nope')).toBe(false)
    })
})

describe('equip and unequip', () => {
    it('fails before purchase and succeeds after', () => {
        const p = base({ wallets: { shiba: 1, shooshy: 0 } })
        const before = equip(p, 'chase-bandana')
        expect(before.ok).toBe(false)
        expect(before.reason).toBe('not-owned')
        expect(before.progression).toEqual(p)

        const bought = purchase(p, 'chase-bandana', NOW).progression
        const after = equip(bought, 'chase-bandana')
        expect(after.ok).toBe(true)
        expect(after.progression.equipped.shiba).toBe('chase-bandana')
    })

    it('fails for an unknown id', () => {
        const p = base()
        const result = equip(p, 'nope')
        expect(result.ok).toBe(false)
        expect(result.reason).toBe('unknown')
    })

    it('replaces the first item when a second item of the same character is equipped', () => {
        let p = base({ wallets: { shiba: 9, shooshy: 0 } })
        p = purchase(p, 'chase-bandana', NOW).progression
        p = purchase(p, 'chase-sunglasses', NOW).progression
        p = equip(p, 'chase-bandana').progression
        p = equip(p, 'chase-sunglasses').progression
        expect(p.equipped.shiba).toBe('chase-sunglasses')
        expect(p.inventory.shiba).toEqual(['chase-bandana', 'chase-sunglasses'])
    })

    it('does not touch the other character when equipping', () => {
        let p = base({ wallets: { shiba: 1, shooshy: 1 } })
        p = purchase(p, 'chase-bandana', NOW).progression
        p = purchase(p, 'shooshy-ribbon', NOW).progression
        p = equip(p, 'chase-bandana').progression
        p = equip(p, 'shooshy-ribbon').progression
        expect(p.equipped).toEqual({ shiba: 'chase-bandana', shooshy: 'shooshy-ribbon' })
    })

    it('unequip sets the character to null and leaves inventory unchanged', () => {
        let p = base({ wallets: { shiba: 1, shooshy: 0 } })
        p = purchase(p, 'chase-bandana', NOW).progression
        p = equip(p, 'chase-bandana').progression
        const inventoryBefore = structuredClone(p.inventory)
        const after = unequip(p, 'shiba')
        expect(after.equipped.shiba).toBeNull()
        expect(after.inventory).toEqual(inventoryBefore)
    })

    it('equip and unequip cost nothing', () => {
        let p = base({ wallets: { shiba: 1, shooshy: 0 } })
        p = purchase(p, 'chase-bandana', NOW).progression
        const walletBefore = { ...p.wallets }
        for (let i = 0; i < 3; i++) {
            p = equip(p, 'chase-bandana').progression
            p = unequip(p, 'shiba')
        }
        expect(p.wallets).toEqual(walletBefore)
    })
})

describe('normalizeEquipped', () => {
    it('clears an equipped id that is not in the inventory and keeps the rest', () => {
        const p = base({
            wallets: { shiba: 0, shooshy: 2 },
            inventory: { shiba: [], shooshy: ['shooshy-ribbon'] },
            equipped: { shiba: 'chase-medal', shooshy: 'shooshy-ribbon' },
        })
        const fixed = normalizeEquipped(p)
        expect(fixed.equipped).toEqual({ shiba: null, shooshy: 'shooshy-ribbon' })
        expect(fixed.inventory).toEqual(p.inventory)
        expect(fixed.wallets).toEqual(p.wallets)
    })

    it('returns the same object when nothing is stale', () => {
        const p = base({ inventory: { shiba: ['chase-bandana'], shooshy: [] }, equipped: { shiba: 'chase-bandana', shooshy: null } })
        expect(normalizeEquipped(p)).toBe(p)
    })

    it('does not mutate the input', () => {
        const p = base({ equipped: { shiba: 'chase-medal', shooshy: null } })
        const snapshot = structuredClone(p)
        normalizeEquipped(p)
        expect(p).toEqual(snapshot)
    })
})

describe('load path', () => {
    it('clears a stored equipped id that is not owned, through the progression repository', async () => {
        const values = new Map<string, string>()
        const stub = {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => values.set(key, value),
            removeItem: (key: string) => values.delete(key),
        }
        vi.stubGlobal('localStorage', stub)
        try {
            const stored = base({ wallets: { shiba: 2, shooshy: 0 }, equipped: { shiba: 'chase-medal', shooshy: null } })
            values.set('stride.progression', JSON.stringify(stored))
            const loaded = await new LocalStorageProgressionRepository().load()
            expect(loaded.equipped).toEqual({ shiba: null, shooshy: null })
            expect(loaded.wallets).toEqual({ shiba: 22, shooshy: 20 })
        } finally {
            vi.unstubAllGlobals()
        }
    })
})
