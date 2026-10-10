import type { Character } from '../domain/preferences'
import type { CompletedRun, Progression } from '../domain/types'
import { deriveHealth } from '../progression/health'
import { CharacterStill } from '../components/CharacterStill'
import { CURRENCY } from '../progression/questState'

const ROWS: Character[] = ['shiba', 'shooshy']

const RULE_TEXT = 'Obese after 7 days with no completed run of 5 minutes or more. A new run restores health.'

interface Props {
    progression: Progression
    runs: readonly CompletedRun[]
    now: Date
    onShop: () => void
    onBack: () => void
}

export function StatusScreen({ progression, runs, now, onShop, onBack }: Props) {
    const health = deriveHealth(runs, now)
    return (
        <section className="card status">
            <p className="eyebrow">My status</p>
            <h1>How are your characters?</h1>
            <p className="lede">{RULE_TEXT}</p>
            <div className="stack">
                {ROWS.map((character) => {
                    const characterHealth = health[character]
                    const wallet = progression.wallets[character]
                    return (
                        <article key={character} className="status-card" aria-labelledby={`status-${character}`}>
                            <CharacterStill character={character} status={characterHealth.status} equipped={progression.equipped[character]} />
                            <h2 id={`status-${character}`}>{characterHealth.label}</h2>
                            <p>{`${CURRENCY[character].plural[0].toUpperCase()}${CURRENCY[character].plural.slice(1)}: ${wallet}`}</p>
                            <p className="muted">
                                {`Completed plan sessions in the last 7 days: ${characterHealth.planSessionsInWindow}`}
                            </p>
                        </article>
                    )
                })}
            </div>
            <button type="button" className="ghost" onClick={onShop}>
                Shop
            </button>
            <button type="button" className="link" onClick={onBack}>
                Back
            </button>
        </section>
    )
}
