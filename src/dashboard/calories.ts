/**
 * Approximate active (net) energy of level running, from the ACSM running equation
 * VO2 = 0.2 v + 3.5 (ml O2 per kg per minute, v in metres per minute) [dashboard-design, section 2].
 * Subtracting the 3.5 resting term and integrating over distance leaves
 *
 *   net kcal = 0.2 ml O2 / kg / m x metres x kg x 5 kcal / L O2 / 1000 ml per L = about 1 kcal / kg / km.
 *
 * These are not Daniels' VDOT constants, so they live here and not in plan/vdot.ts.
 * TODO(verify): the equation is a steady-state, level-ground running model meant for speeds above
 * about 8 km/h; slow jogging, walking recovery and treadmill calibration make it rougher. The 5 kcal
 * per litre of oxygen is itself an approximation that varies with the fuel burned.
 */
const ML_O2_PER_KG_PER_METRE = 0.2
const KCAL_PER_LITRE_O2 = 5
const ML_PER_LITRE = 1000
const METRES_PER_KM = 1000

/**
 * Approximate active kilocalories for a level run, or null when the weight is unknown or there
 * is no positive distance. Never a made-up number: callers show an empty state instead.
 */
export function activeKcal(weightKg: number | null, distanceKm: number | null): number | null {
    if (weightKg === null || distanceKm === null) return null
    if (!(weightKg > 0) || !(distanceKm > 0) || !Number.isFinite(weightKg) || !Number.isFinite(distanceKm)) return null
    const mlO2 = ML_O2_PER_KG_PER_METRE * distanceKm * METRES_PER_KM * weightKg
    return (mlO2 / ML_PER_LITRE) * KCAL_PER_LITRE_O2
}
