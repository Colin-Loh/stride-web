import { describe, expect, it } from 'vitest'
import type { SessionSummary } from '../dashboard/summary'
import { barSegments, buildCardLayout, CARD, cardEyebrow, shareText, zoneLegend, type CardData, type CardItem } from './cardLayout'

const SUMMARY: SessionSummary = {
    activeSeconds: 2412, pausedSeconds: 0, distanceKm: 5.2, paceSecondsPerKm: 2412 / 5.2, averageKmh: 7.76, kcal: 312,
    sectionsDone: 3, sectionsPlanned: 3, steps: [],
    rows: [
        { index: 0, label: 'Warm-up', zone: 'E', actualSeconds: 480, plannedSeconds: 480, averageKmh: 7, distanceKm: 0.93 },
        { index: 1, label: 'Main', zone: 'M', actualSeconds: 1440, plannedSeconds: 1440, averageKmh: 8.7, distanceKm: 3.48 },
        { index: 2, label: 'Cool-down', zone: 'E', actualSeconds: 492, plannedSeconds: 492, averageKmh: 5.8, distanceKm: 0.79 },
    ],
    zoneTimes: [{ zone: 'E', seconds: 972 }, { zone: 'M', seconds: 1440 }],
}
const DATA: CardData = { name: 'Colin', sessionName: 'Steady treadmill', character: 'shiba', summary: SUMMARY, includeCalories: false }
const texts = (items: CardItem[]) => items.flatMap((item) => (item.kind === 'text' ? [item.text] : []))
const content = (items: CardItem[]) => items.filter((item) => !('decor' in item && item.decor))

describe('card layout', () => {
    it('is 1080 x 1350 with every content item inside the 80 px safe area', () => {
        expect([CARD.width, CARD.height]).toEqual([1080, 1350])
        for (const item of content(buildCardLayout(DATA))) {
            if (item.kind === 'text') {
                expect(item.x).toBeGreaterThanOrEqual(CARD.padding)
                expect(item.y).toBeLessThanOrEqual(CARD.height - CARD.padding + 25)
            } else if (item.kind === 'rect' || item.kind === 'character') {
                expect(item.x).toBeGreaterThanOrEqual(CARD.padding)
                expect(item.x + item.width).toBeLessThanOrEqual(CARD.width - CARD.padding)
                expect(item.y + item.height).toBeLessThanOrEqual(CARD.height - CARD.padding)
            }
        }
    })

    it('shows distance, active time and pace with units and the estimate label', () => {
        const all = texts(buildCardLayout(DATA))
        expect(all).toEqual(expect.arrayContaining(['5.20', 'KILOMETRES · ESTIMATED', '40:12', '7:44', 'ACTIVE TIME', 'AVG EST. PACE']))
        expect(all).toContain('Distance from logged speed × time · no GPS')
        expect(all).toContain('COLIN · SESSION COMPLETE')
        const pace = buildCardLayout(DATA).find((item) => item.kind === 'text' && item.text === '7:44')
        expect(pace).toMatchObject({ suffix: { text: ' /km' } })
    })

    it('leaves calories off by default and adds them, with no gap, only when chosen', () => {
        expect(texts(buildCardLayout(DATA)).join(' ')).not.toContain('kcal')
        expect(texts(buildCardLayout({ ...DATA, includeCalories: true }))).toContain('~312 kcal · approximate active energy')
        const unknown = { ...DATA, includeCalories: true, summary: { ...SUMMARY, kcal: null } }
        expect(texts(buildCardLayout(unknown)).join(' ')).not.toContain('kcal')
    })

    it('never puts weight, date, location or VDOT on the card', () => {
        const all = texts(buildCardLayout({ ...DATA, includeCalories: true })).join(' ').toLowerCase()
        for (const word of ['weight', 'vdot', ' kg', 'gps route']) expect(all).not.toContain(word)
        expect(all).not.toMatch(/20\d\d/)
    })

    it('shows dashes, not zeros, when distance and pace are unknown', () => {
        const unknown = { ...DATA, summary: { ...SUMMARY, distanceKm: null, paceSecondsPerKm: null, kcal: null } }
        const items = buildCardLayout(unknown)
        expect(texts(items)).toEqual(expect.arrayContaining(['—', '40:12']))
        expect(texts(items)).not.toContain('0.00')
        expect(items.find((item) => item.kind === 'text' && item.text === '—' && item.x === 530)).not.toHaveProperty('suffix')
    })

    it('places the character box and omits the name and legend gracefully', () => {
        const items = buildCardLayout({ ...DATA, name: '  ', summary: { ...SUMMARY, rows: [], zoneTimes: [] } })
        expect(items.filter((item) => item.kind === 'character')).toHaveLength(1)
        expect(texts(items)).toContain('SESSION COMPLETE')
        expect(items.filter((item) => item.kind === 'rect' && item.y === CARD.barY)).toHaveLength(0)
        expect(texts(items).some((text) => text.includes('·') && text.startsWith('E '))).toBe(false)
    })

    it('names zones in the legend with durations, letters first', () => {
        expect(zoneLegend(SUMMARY)).toBe('E 16:12 · M 24:00')
        expect(zoneLegend({ ...SUMMARY, zoneTimes: [{ zone: 'recovery', seconds: 90 }] })).toBe('Rec 1:30')
    })
})

describe('barSegments', () => {
    it('is proportional to active time and fills the width exactly', () => {
        const segments = barSegments(SUMMARY.rows, 920)
        expect(segments.map((segment) => segment.zone)).toEqual(['E', 'M', 'E'])
        expect(segments[0].x).toBe(0)
        expect(segments.at(-1)!.x + segments.at(-1)!.width).toBe(920)
        segments.slice(1).forEach((segment, index) => expect(segment.x).toBe(segments[index].x + segments[index].width))
        expect(segments[1].width / 920).toBeCloseTo(1440 / 2412, 2)
    })

    it('is empty without time', () => {
        expect(barSegments([], 920)).toEqual([])
        expect(barSegments([{ ...SUMMARY.rows[0], actualSeconds: 0 }], 920)).toEqual([])
    })

    it('rounds only the outer ends of the bar', () => {
        const bars = buildCardLayout(DATA).filter((item) => item.kind === 'rect' && item.y === CARD.barY)
        expect(bars.map((bar) => (bar as { radius: unknown }).radius)).toEqual([[7, 0, 0, 7], [0, 0, 0, 0], [0, 7, 7, 0]])
    })
})

describe('text', () => {
    it('summarises the card for the share sheet, without calories unless included', () => {
        expect(shareText(DATA)).toBe('Stride · Steady treadmill. Estimated 5.20 km; active 40:12; average estimated pace 7:44/km. Distance from logged speed × time · no GPS.')
        expect(shareText({ ...DATA, includeCalories: true })).toContain('Approximate active energy 312 kcal.')
        expect(shareText({ ...DATA, summary: { ...SUMMARY, distanceKm: null, paceSecondsPerKm: null } })).toContain('Distance not recorded.')
    })

    it('words the eyebrow with and without a name', () => {
        expect(cardEyebrow(' Alex ')).toBe('ALEX · SESSION COMPLETE')
        expect(cardEyebrow('')).toBe('SESSION COMPLETE')
    })
})
