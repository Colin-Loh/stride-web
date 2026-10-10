import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { COSMETICS } from './catalog'
import { LEGACY_ITEMS } from './legacy'

/** Repository root, so the checks read the real files under public/. */
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const publicFile = (relative: string) => `${ROOT}public/${relative}`

describe('cosmetic art on disk', () => {
    it('has an overlay file and a shop icon for every catalog item', () => {
        const missing: string[] = []
        for (const item of COSMETICS) {
            if (!existsSync(publicFile(`cosmetics/${item.id}.png`))) missing.push(`overlay public/cosmetics/${item.id}.png`)
            if (!existsSync(publicFile(`cosmetics/icons/${item.id}.png`))) missing.push(`icon public/cosmetics/icons/${item.id}.png`)
        }
        expect(missing).toEqual([])
    })

    it('points each catalog item at an artPath that exists', () => {
        for (const item of COSMETICS) {
            expect(existsSync(`${ROOT}${item.artPath}`)).toBe(true)
        }
    })

    it('keeps every legacy id out of the catalog and out of any catalog art path', () => {
        const legacyIds = new Set(LEGACY_ITEMS.map((item) => item.id))
        for (const item of COSMETICS) {
            expect(legacyIds.has(item.id)).toBe(false)
            for (const legacy of legacyIds) {
                expect(item.artPath).not.toContain(legacy)
            }
        }
    })

    it('does not name any catalog id in the legacy module source', () => {
        const legacySource = readFileSync(`${ROOT}src/cosmetics/legacy.ts`, 'utf8')
        for (const item of COSMETICS) {
            expect(legacySource).not.toContain(item.id)
        }
    })
})
