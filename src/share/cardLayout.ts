import type { Character } from '../domain/preferences'
import { formatClock, formatKcal, formatKm, formatPace } from '../dashboard/format'
import type { SessionSummary, ZoneKey } from '../dashboard/summary'
import { ZONE_COLORS, zoneLetter } from '../dashboard/zones'

/** The share image's size and spacing, from the dashboard design (section 4). All local design choices. */
export const CARD = {
    width: 1080,
    height: 1350,
    padding: 80,
    background: '#101a24',
    glow: '#19342f',
    text: '#f2f7fb',
    muted: '#b4c2ce',
    accent: '#81e8c2',
    rule: '#34424f',
    barY: 985,
    barHeight: 26,
    barRadius: 7,
    /** Where the still character stands: right of the distance, inside the safe area. */
    character: { x: 620, y: 360, width: 380, height: 300 },
} as const

/** One corner radius, or top-left, top-right, bottom-right, bottom-left. */
export type Radius = number | [number, number, number, number]

export type CardItem =
    | { kind: 'rect'; x: number; y: number; width: number; height: number; fill: string; radius?: Radius; decor?: boolean }
    | { kind: 'circle'; x: number; y: number; radius: number; fill: string; decor: true }
    | { kind: 'text'; x: number; y: number; text: string; size: number; weight: 400 | 700 | 800; fill: string; suffix?: { text: string; size: number; fill: string } }
    | { kind: 'character'; x: number; y: number; width: number; height: number }

/** What goes on the card. Calories appear only when the runner chose to include them. */
export interface CardData {
    name: string
    sessionName: string
    character: Character
    summary: SessionSummary
    includeCalories: boolean
}

export const BRAND = 'stride'
export const ESTIMATE_NOTE = 'Distance from logged speed × time · no GPS'
export const TAGLINE = 'A little stronger. One session at a time.'

/** The display name, in capitals, before "SESSION COMPLETE"; the label alone when there is no name. */
export const cardEyebrow = (name: string): string => (name.trim() ? `${name.trim().toUpperCase()} · SESSION COMPLETE` : 'SESSION COMPLETE')

/** Widths of the section bar, proportional to active time, summing exactly to the bar width. */
export function barSegments(rows: SessionSummary['rows'], width: number): { zone: ZoneKey; x: number; width: number }[] {
    const total = rows.reduce((sum, row) => sum + row.actualSeconds, 0)
    if (total <= 0) return []
    let used = 0
    let elapsed = 0
    return rows.map((row, index) => {
        elapsed += row.actualSeconds
        const end = index === rows.length - 1 ? width : Math.round((elapsed / total) * width)
        const segment = { zone: row.zone, x: used, width: end - used }
        used = end
        return segment
    })
}

/** "E 16:12 · M 24:00": time per prescribed zone, a legend that does not rely on colour. */
export const zoneLegend = (summary: SessionSummary): string =>
    summary.zoneTimes.map((item) => `${zoneLetter(item.zone)} ${formatClock(item.seconds)}`).join(' · ')

/** Plain-text equivalent of the card, for the share sheet and screen readers. */
export function shareText(data: CardData): string {
    const { summary } = data
    const parts = [
        `Stride · ${data.sessionName}.`,
        summary.distanceKm === null ? 'Distance not recorded.' : `Estimated ${formatKm(summary.distanceKm)} km;`,
        `active ${formatClock(summary.activeSeconds)};`,
        summary.paceSecondsPerKm === null ? null : `average estimated pace ${formatPace(summary.paceSecondsPerKm)}/km.`,
        data.includeCalories && summary.kcal !== null ? `Approximate active energy ${Math.round(summary.kcal)} kcal.` : null,
        `${ESTIMATE_NOTE}.`,
    ]
    return parts.filter((part): part is string => part !== null).join(' ')
}

/** Every shape and string of the 1080 x 1350 card, in drawing order. Pure, so it can be tested without a canvas. */
export function buildCardLayout(data: CardData): CardItem[] {
    const { summary } = data
    const left = CARD.padding
    const barWidth = CARD.width - 2 * CARD.padding
    const items: CardItem[] = [
        { kind: 'rect', x: 0, y: 0, width: CARD.width, height: CARD.height, fill: CARD.background, decor: true },
        { kind: 'circle', x: 920, y: 250, radius: 310, fill: CARD.glow, decor: true },
        { kind: 'text', x: left, y: 130, text: BRAND, size: 48, weight: 800, fill: CARD.text, suffix: { text: '.', size: 48, fill: CARD.accent } },
        { kind: 'text', x: left, y: 210, text: cardEyebrow(data.name), size: 27, weight: 400, fill: CARD.muted },
        { kind: 'text', x: left, y: 275, text: data.sessionName, size: 48, weight: 700, fill: CARD.text },
        { kind: 'text', x: left, y: 325, text: 'Treadmill · estimated distance', size: 28, weight: 400, fill: CARD.muted },
        { kind: 'character', ...CARD.character },
        { kind: 'text', x: left, y: 550, text: formatKm(summary.distanceKm), size: 154, weight: 800, fill: CARD.text },
        { kind: 'text', x: left + 8, y: 605, text: 'KILOMETRES · ESTIMATED', size: 34, weight: 400, fill: CARD.accent },
        { kind: 'text', x: left, y: 760, text: formatClock(summary.activeSeconds), size: 70, weight: 700, fill: CARD.text },
        {
            kind: 'text', x: 530, y: 760, text: formatPace(summary.paceSecondsPerKm), size: 70, weight: 700, fill: CARD.text,
            ...(summary.paceSecondsPerKm === null ? {} : { suffix: { text: ' /km', size: 30, fill: CARD.muted } }),
        },
        { kind: 'text', x: left, y: 810, text: 'ACTIVE TIME', size: 29, weight: 400, fill: CARD.muted },
        { kind: 'text', x: 530, y: 810, text: 'AVG EST. PACE', size: 29, weight: 400, fill: CARD.muted },
    ]
    if (data.includeCalories && summary.kcal !== null) {
        items.push({ kind: 'text', x: left, y: 910, text: `${formatKcal(summary.kcal)} kcal · approximate active energy`, size: 32, weight: 400, fill: CARD.text })
    }
    const segments = barSegments(summary.rows, barWidth)
    segments.forEach((segment, index) => {
        const r = CARD.barRadius
        const first = index === 0
        const last = index === segments.length - 1
        items.push({
            kind: 'rect', x: left + segment.x, y: CARD.barY, width: segment.width, height: CARD.barHeight,
            fill: ZONE_COLORS[segment.zone], radius: [first ? r : 0, last ? r : 0, last ? r : 0, first ? r : 0],
        })
    })
    const legend = zoneLegend(summary)
    if (legend) items.push({ kind: 'text', x: left, y: 1065, text: legend, size: 27, weight: 400, fill: CARD.text })
    items.push(
        { kind: 'rect', x: left, y: 1135, width: barWidth, height: 2, fill: CARD.rule },
        { kind: 'text', x: left, y: 1200, text: ESTIMATE_NOTE, size: 28, weight: 400, fill: CARD.muted },
        { kind: 'text', x: left, y: 1255, text: TAGLINE, size: 25, weight: 400, fill: CARD.muted },
    )
    return items
}
