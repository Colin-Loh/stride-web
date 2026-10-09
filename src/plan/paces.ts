import { SCHEMA_VERSION, type PaceSet, type ZonePace } from '../domain/types'
import { paceSecondsPerKmFromSpeed, roundSpeedUp } from './convert'
import { trainingSpeedsKmh, ZONES, type Zone } from './vdot'
import type { PersonalBaseline } from './types'

const toZonePace = (rawSpeedKmh: number): ZonePace => ({
    paceSecondsPerKm: paceSecondsPerKmFromSpeed(rawSpeedKmh),
    speedKmh: roundSpeedUp(rawSpeedKmh),
})

/**
 * The five VDOT paces for a runner. With a VDOT every zone comes from vdot.ts. With only
 * a reported easy pace (no published mapping to VDOT) E is that pace and the other zones are null.
 */
export function buildPaceSet(baseline: PersonalBaseline, id: string, now: string): PaceSet {
    const speeds = baseline.vdot === null ? null : trainingSpeedsKmh(baseline.vdot)
    const zones = Object.fromEntries((Object.keys(ZONES) as Zone[]).map((zone) => {
        const raw = speeds?.[zone] ?? (zone === 'E' ? baseline.reportedEasySpeedKmh : null)
        return [zone, raw === null ? null : toZonePace(raw)]
    })) as PaceSet['zones']
    return { id, schemaVersion: SCHEMA_VERSION, createdAt: now, updatedAt: now, vdot: baseline.vdot, zones }
}
