import { useId } from 'react'
import type { SessionSummary, SpeedStep } from './summary'
import { formatClock, formatKm, formatSpeed, MISSING } from './format'
import { ZONE_COLORS, zoneLetter, zoneName } from './zones'

/** Chart geometry in SVG units. */
const PLOT = { width: 340, height: 150, left: 32, right: 330, top: 25, bottom: 115 } as const
const MIN_LABEL_SHARE = 0.06
const SPEED_HEADROOM = 1

const speedLabel = (step: SpeedStep) => `${zoneName(step.zone)} ${formatClock(step.seconds)} at ${formatSpeed(step.speedKmh)} km/h`

/** The step path of a speed series: flat across each step, vertical where the speed changes. */
function stepPath(steps: SpeedStep[], pick: (step: SpeedStep) => number | null, x: (seconds: number) => number, y: (speed: number) => number): string {
    let path = ''
    let previous: number | null = null
    for (const step of steps) {
        const speed = pick(step)
        if (speed === null) { previous = null; continue }
        const start = x(step.startSeconds)
        path += previous === null ? `M${start} ${y(speed)}` : `V${y(speed)}`
        path += `H${x(step.startSeconds + step.seconds)}`
        previous = speed
    }
    return path
}

/** Set speed against active time. Width is actual time; the dashed line is the plan where it differs. */
export function SpeedChart({ summary }: { summary: SessionSummary }) {
    const id = useId()
    const { steps, activeSeconds } = summary
    const speeds = steps.flatMap((step) => [step.speedKmh, step.plannedKmh]).filter((speed): speed is number => speed !== null)
    if (speeds.length === 0 || activeSeconds <= 0) return <p className="muted">No speeds were set for this run, so there is no speed chart.</p>

    const top = Math.ceil(Math.max(...speeds)) + SPEED_HEADROOM
    const x = (seconds: number) => PLOT.left + (seconds / activeSeconds) * (PLOT.right - PLOT.left)
    const y = (speed: number) => PLOT.bottom - (speed / top) * (PLOT.bottom - PLOT.top)
    const differs = steps.some((step) => step.plannedKmh !== step.speedKmh)
    const description = `${steps.map(speedLabel).join('; ')}. The section table below gives the same data.`

    return (
        <svg viewBox={`0 0 ${PLOT.width} ${PLOT.height}`} role="img" aria-labelledby={`${id}-title ${id}-desc`} className="chart">
            <title id={`${id}-title`}>Set treadmill speed over active time</title>
            <desc id={`${id}-desc`}>{description}</desc>
            <g stroke="var(--rule)">
                {[0, top / 2, top].map((tick) => <path key={tick} d={`M${PLOT.left} ${y(tick)}H${PLOT.right}`} />)}
            </g>
            <g fill="var(--muted)" fontSize="11">
                {[0, top / 2, top].map((tick) => <text key={tick} x={PLOT.left - 4} y={y(tick) + 4} textAnchor="end">{Number(tick.toFixed(1))}</text>)}
                <text x={PLOT.left} y={PLOT.height - 4}>0</text>
                <text x={PLOT.right} y={PLOT.height - 4} textAnchor="end">{formatClock(activeSeconds)}</text>
            </g>
            {steps.map((step) => step.speedKmh === null ? null : (
                <path key={`${step.index}-${step.startSeconds}`} fill={ZONE_COLORS[step.zone]} opacity={0.22}
                    d={`M${x(step.startSeconds)} ${PLOT.bottom}V${y(step.speedKmh)}H${x(step.startSeconds + step.seconds)}V${PLOT.bottom}Z`} />
            ))}
            {differs ? <path d={stepPath(steps, (step) => step.plannedKmh, x, y)} fill="none" stroke="var(--muted)" strokeWidth={2} strokeDasharray="5 4" /> : null}
            <path d={stepPath(steps, (step) => step.speedKmh, x, y)} fill="none" stroke="var(--text-h)" strokeWidth={3} />
            <g fill="var(--text-h)" fontSize="13" fontWeight="700">
                {steps.filter((step) => step.speedKmh !== null && step.seconds / activeSeconds >= MIN_LABEL_SHARE).map((step) => (
                    <text key={`l-${step.index}-${step.startSeconds}`} x={x(step.startSeconds + step.seconds / 2)} y={y(step.speedKmh!) - 6} textAnchor="middle">{zoneLetter(step.zone)}</text>
                ))}
            </g>
        </svg>
    )
}

/** Time per prescribed zone as one stacked bar, with a text legend. Plan labels, not measured effort. */
export function ZoneBar({ summary }: { summary: SessionSummary }) {
    const total = summary.zoneTimes.reduce((sum, item) => sum + item.seconds, 0)
    if (total <= 0) return <p className="muted">No timed running to split by zone.</p>
    return (
        <>
            <div className="zone-bar" aria-hidden="true">
                {summary.zoneTimes.map((item) => <span key={item.zone} style={{ flexGrow: item.seconds, background: ZONE_COLORS[item.zone] }} />)}
            </div>
            <ul className="zone-legend">
                {summary.zoneTimes.map((item) => (
                    <li key={item.zone}>
                        <span className="zone-swatch" style={{ background: ZONE_COLORS[item.zone] }} aria-hidden="true" />
                        <b>{zoneLetter(item.zone)}</b> {zoneName(item.zone)} {formatClock(item.seconds)}
                    </li>
                ))}
            </ul>
        </>
    )
}

/** The text equivalent of both charts: every section's time, speed and estimated distance. */
export function SectionTable({ summary }: { summary: SessionSummary }) {
    if (summary.rows.length === 0) return null
    return (
        <table className="section-table">
            <caption className="muted">Planned time against actual time</caption>
            <thead>
                <tr><th scope="col">Section</th><th scope="col">Actual</th><th scope="col">Planned</th><th scope="col">Set km/h</th><th scope="col">Est. km</th></tr>
            </thead>
            <tbody>
                {summary.rows.map((row) => (
                    <tr key={row.index}>
                        <th scope="row">{zoneLetter(row.zone)} · {row.label}</th>
                        <td>{formatClock(row.actualSeconds)}</td>
                        <td>{row.plannedSeconds === null ? MISSING : formatClock(row.plannedSeconds)}</td>
                        <td>{formatSpeed(row.averageKmh)}</td>
                        <td>{formatKm(row.distanceKm)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    )
}
