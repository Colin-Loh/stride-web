import type { RunSession } from '../domain/types'

/**
 * The view shown on boot. Without a name the runner starts onboarding; with a name the
 * unfinished or finished run comes first, and otherwise the home view.
 */
export function startView(name: string | null, resumed: RunSession | null): 'name' | 'run' | 'complete' | 'home' {
  if (!name) return 'name'
  if (resumed) return resumed.completed ? 'complete' : 'run'
  return 'home'
}
