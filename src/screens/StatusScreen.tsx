import { CHARACTER_NAMES, type Character } from '../domain/preferences'
import type { CompletedRun, Progression } from '../domain/types'
import { deriveHealth } from '../progression/health'
import { CharacterStill } from '../components/CharacterStill'
import { QuestBadge } from '../components/QuestBadge'
import { CURRENCY } from '../progression/questState'

const RULE_TEXT = 'Obese after 7 days with no completed run of 5 minutes or more. A new run restores health.'

interface Props {
    /** The locked character. Only this one is shown. */
    character: Character
    progression: Progression
    runs: readonly CompletedRun[]
    now: Date
    /** Claims the character's pending daily currency through the quest. Resolves with the number claimed. */
    onCollect: (character: Character) => Promise<number>
    onBack: () => void
}

export function StatusScreen({ character, progression, runs, now, onCollect, onBack }: Props) {
    const health = deriveHealth(runs, now)[character]
    const wallet = progression.wallets[character]
    const plural = CURRENCY[character].plural
    return (
        <section className="card status">
            <p className="eyebrow">My status</p>
            <h1>{`How is ${CHARACTER_NAMES[character]}?`}</h1>
            <p className="lede">{RULE_TEXT}</p>
            <article className="status-card" aria-labelledby="status-character">
                <div className="status-stage">
                    <CharacterStill character={character} status={health.status} equipped={progression.equipped[character]} />
                    <QuestBadge progression={progression} character={character} now={now} onCollect={onCollect} />
                </div>
                <h2 id="status-character">{health.label}</h2>
                <p>{`${plural[0].toUpperCase()}${plural.slice(1)}: ${wallet}`}</p>
                <p className="muted">
                    {`Completed plan sessions in the last 7 days: ${health.planSessionsInWindow}`}
                </p>
            </article>
            <button type="button" className="link" onClick={onBack}>
                Back
            </button>
        </section>
    )
}
