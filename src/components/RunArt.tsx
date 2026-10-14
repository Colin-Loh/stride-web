import type { CSSProperties } from 'react'
import { PixelArt, type Palette } from './PixelArt'

/*
 * Original pixel art for the Run forest, drawn in code as character grids (see PixelArt) in the
 * same family as the Shop fitting room and Status room. Each scrolling layer is one seamless tile
 * repeated side by side; CSS moves the layer by exactly one tile per loop (src/retro/run.css).
 * All of it is decorative: aria-hidden, unfocusable, pointer-events none through .run-decor.
 */

const TILE_COLS = 64
/** Enough copies to cover the widest stage (440px card) plus one tile of travel. */
const TILE_COPIES = 4

interface Placed {
    rows: readonly string[]
    x: number
}

/** Draws grids onto one canvas, bottom-aligned, so a tile is described by what stands where. */
function compose(cols: number, placed: readonly Placed[], minRows = 0): string[] {
    const height = Math.max(minRows, ...placed.map((p) => p.rows.length))
    const canvas = Array.from({ length: height }, () => Array<string>(cols).fill('.'))
    for (const { rows, x } of placed) {
        const top = height - rows.length
        rows.forEach((row, y) => {
            for (let i = 0; i < row.length; i++) {
                if (row[i] !== '.' && x + i < cols) canvas[top + y][x + i] = row[i]
            }
        })
    }
    return canvas.map((row) => row.join(''))
}

/**
 * A pine of stacked tiers: l = lit left edge, g = body, d = shaded right edge, t = trunk.
 * Width is 2 * tiers + 3 so the lowest tier fills it.
 */
function pine(tiers: number): string[] {
    const widths: number[] = [1]
    for (let t = 0; t < tiers; t++) widths.push(2 * t + 3, 2 * t + 5)
    const full = widths[widths.length - 1]
    const rows = widths.map((w) => {
        const pad = '.'.repeat((full - w) / 2)
        const body = w === 1 ? 'g' : `l${'g'.repeat(w - 2)}d`
        return `${pad}${body}${pad}`
    })
    const stem = '.'.repeat((full - 3) / 2)
    rows.push(`${stem}ttt${stem}`, `${stem}ttt${stem}`)
    return rows
}

const NEAR_PALETTE: Palette = { l: '#5fb04a', g: '#3f8f3a', d: '#2a6a2c', t: '#6b4226' }
const FAR_PALETTE: Palette = { l: '#3f7f5a', g: '#33694a', d: '#285540', t: '#3d4a3a' }

const NEAR_TREES = compose(TILE_COLS, [
    { rows: pine(8), x: 3 },
    { rows: pine(6), x: 30 },
    { rows: pine(5), x: 50 },
])

const FAR_TREES = compose(TILE_COLS, [
    { rows: pine(9), x: 2 },
    { rows: pine(7), x: 28 },
    { rows: pine(8), x: 44 },
])

const CLOUD = [
    '....wwww......',
    '..wwwwwwww.ww.',
    '.wwwwwwwwwwwww',
    'wwwwwwwwwwwwww',
    '.ssssssssssss.',
]

const SMALL_CLOUD = [
    '..www.....',
    '.wwwwwww..',
    'wwwwwwwwww',
    '.ssssssss.',
]

const CLOUD_PALETTE: Palette = { w: '#fff4e8', s: '#cbdbfc' }

const CLOUDS = compose(TILE_COLS, [
    { rows: CLOUD, x: 4 },
    { rows: SMALL_CLOUD, x: 40 },
], 14)

/** Grass on top, soil beneath with a few pebbles; 16 columns repeat seamlessly. */
const GROUND = [
    'gggGgggggGgggggg',
    'GGGGGGGGGGGGGGGG',
    'ssssssssssssssss',
    'sSsssssspssssSss',
    'ssssPssssssssssp',
    'SssssssSsssPssss',
    'ssssssssssssssss',
    'sssSssssssssSsss',
]

const GROUND_PALETTE: Palette = { g: '#5fb04a', G: '#2a6a2c', s: '#8a5a34', S: '#6b4226', p: '#a8693a', P: '#c98a52' }

interface LayerProps {
    name: 'clouds' | 'far' | 'near' | 'ground'
    rows: readonly string[]
    palette: Palette
    /** CSS pixels per art pixel. */
    px: number
    copies?: number
}

function Layer({ name, rows, palette, px, copies = TILE_COPIES }: LayerProps) {
    const cols = Math.max(...rows.map((row) => row.length))
    const style = { '--cols': cols, '--rows': rows.length, '--px': `${px}px` } as CSSProperties
    return (
        <div className={`run-layer run-layer-${name}`} style={style}>
            {Array.from({ length: copies }, (_, i) => (
                <PixelArt key={i} rows={rows} palette={palette} />
            ))}
        </div>
    )
}

/** The scenery behind the runner. Layers scroll at different rates to read as depth. */
export function RunForest() {
    return (
        <div className="run-decor" aria-hidden="true">
            <Layer name="clouds" rows={CLOUDS} palette={CLOUD_PALETTE} px={4} />
            <Layer name="far" rows={FAR_TREES} palette={FAR_PALETTE} px={3} />
            <Layer name="near" rows={NEAR_TREES} palette={NEAR_PALETTE} px={4} />
            <Layer name="ground" rows={GROUND} palette={GROUND_PALETTE} px={4} copies={TILE_COPIES * 4} />
        </div>
    )
}
