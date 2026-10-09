import { ZONES } from '../plan/vdot'
import type { ZoneKey } from './summary'

/** Zone colours, shared by the dashboard charts and the share card. Letters carry the meaning too. */
export const ZONE_COLORS: Record<ZoneKey, string> = {
    E: '#81e8c2', M: '#9fb6ff', T: '#ffd27a', I: '#ff9f8a', R: '#e69cff', recovery: '#8a9bab',
}

export const zoneLetter = (zone: ZoneKey): string => (zone === 'recovery' ? 'Rec' : zone)

export const zoneName = (zone: ZoneKey): string => (zone === 'recovery' ? 'Recovery' : ZONES[zone].name)
