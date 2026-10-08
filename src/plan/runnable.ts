import { validateWorkout } from './validation'
import type { PersonalizedWorkout } from './types'

/** Keep time/distance targets intact. Timed sections can run without a speed. */
export function runnablePlan(plan: PersonalizedWorkout): PersonalizedWorkout | null {
  return validateWorkout(plan).ok ? plan : null
}
