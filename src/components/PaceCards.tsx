import type { PaceSet } from '../domain/types'
import { formatPaceSeconds } from '../plan/convert'
import { ZONES, type Zone } from '../plan/daniels'

const ZONE_ORDER = Object.keys(ZONES) as Zone[]

/** The five Daniels paces. Without a race result only E is known, and the rest say why they are missing. */
export function PaceCards({ paces }: { paces: PaceSet }) {
    const known = ZONE_ORDER.filter((zone) => paces.zones[zone] !== null)
    const missingSome = known.length < ZONE_ORDER.length
    return (
        <div>
            <div className="pace-cards">
                {known.map((zone) => {
                    const pace = paces.zones[zone]!
                    return (
                        <article key={zone} className="pace-card" data-zone={zone}>
                            <p className="pace-zone"><span className="zone-letter">{zone}</span> <strong>{ZONES[zone].name}</strong></p>
                            <p className="pace-value">{formatPaceSeconds(pace.paceSecondsPerKm)} min/km</p>
                            <p className="pace-speed">{pace.speedKmh.toFixed(1)} km/h</p>
                            <p className="muted">{ZONES[zone].purpose}</p>
                        </article>
                    )
                })}
            </div>
            {missingSome ? (
                <p className="muted">The other paces (M, T, I and R) need a race result. Add one under "Change my running answers".</p>
            ) : null}
        </div>
    )
}
