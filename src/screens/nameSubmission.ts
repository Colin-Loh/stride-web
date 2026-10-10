import { parseWeightKg, type Character } from '../domain/preferences'

export interface NameSubmission {
  name: string
  character: Character
  weightKg: number | null
}

/**
 * The payload for a valid name and weight, or null when either is unusable.
 * Once a character is stored it is the only one used; the selection is ignored.
 */
export function nameSubmission(
  name: string,
  weightText: string,
  selected: Character,
  storedCharacter?: Character,
): NameSubmission | null {
  const trimmed = name.trim()
  const weight = parseWeightKg(weightText)
  if (!trimmed || !weight.ok) return null
  return { name: trimmed, character: storedCharacter ?? selected, weightKg: weight.kg }
}
