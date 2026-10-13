/**
 * Pixel art drawn as SVG rectangles from character grids. Each character in a row names a
 * colour in the palette, "." is transparent, and horizontal runs of one colour merge into a
 * single rect. The result is vector (no bitmap, no scaling blur) and stays crisp at any size.
 * Everything here is decorative: the SVG is aria-hidden and unfocusable.
 */
export type Palette = Record<string, string>

interface PixelArtProps {
    rows: readonly string[]
    palette: Palette
    className?: string
    /** SVG preserveAspectRatio; "xMidYMin slice" crops a wide strip to its container. */
    fit?: string
}

/** The rects for one grid: [x, y, width, colour] with horizontal runs merged. */
function pixelRuns(rows: readonly string[], palette: Palette): Array<[number, number, number, string]> {
    const runs: Array<[number, number, number, string]> = []
    rows.forEach((row, y) => {
        let x = 0
        while (x < row.length) {
            const key = row[x]
            let end = x
            while (end + 1 < row.length && row[end + 1] === key) end += 1
            const colour = palette[key]
            if (key !== '.' && colour) runs.push([x, y, end - x + 1, colour])
            x = end + 1
        }
    })
    return runs
}

export function PixelArt({ rows, palette, className, fit }: PixelArtProps) {
    const width = Math.max(0, ...rows.map((row) => row.length))
    return (
        <svg
            className={className}
            viewBox={`0 0 ${width} ${rows.length}`}
            aria-hidden="true"
            focusable="false"
            shapeRendering="crispEdges"
            preserveAspectRatio={fit}
        >
            {pixelRuns(rows, palette).map(([x, y, w, fill]) => (
                <rect key={`${x}-${y}`} x={x} y={y} width={w} height={1} fill={fill} />
            ))}
        </svg>
    )
}
