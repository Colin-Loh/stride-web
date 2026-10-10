import type { CSSProperties } from 'react'
import type { Character } from '../domain/preferences'
import type { CompletedRun, Progression } from '../domain/types'
import { deriveHealth, type CharacterHealth } from '../progression/health'
import { pendingIncome } from '../progression/income'
import { CHARACTER_SPRITES, OBESE_STILLS } from '../sprites'

/** Same scale as the other sprites, so frame edges stay on whole pixels. */
const SPRITE_SCALE = 0.5

interface CharacterRow {
    character: Character
    walletName: string
}

const ROWS: CharacterRow[] = [
    { character: 'shiba', walletName: 'bones' },
    { character: 'shooshy', walletName: 'fish' },
]

const RULE_TEXT = 'Obese after 7 days with no completed run of 5 minutes or more. A new run restores health.'

interface Props {
    progression: Progression
    runs: readonly CompletedRun[]
    now: Date
    onCollect: (character: Character) => void
    onBack: () => void
}

/**
 * The still picture for a character: the obese still when obese, otherwise the first frame of
 * the run sheet. Decorative: the health label beside it carries the meaning, so alt is empty.
 */
function StatusSprite({ character, health }: { character: Character; health: CharacterHealth }) {
    if (health.status === 'obese') {
        const still = OBESE_STILLS[character]
        return (
            <img
                className="status-sprite"
                src={still.url}
                width={Math.round(still.width * SPRITE_SCALE)}
                height={Math.round(still.height * SPRITE_SCALE)}
                alt=""
            />
        )
    }
    const sheet = CHARACTER_SPRITES[character]
    const style = {
        backgroundImage: `url(${sheet.url})`,
        backgroundSize: `${sheet.frames * 100}% 100%`,
        backgroundPosition: '0 0',
        width: `${Math.round(sheet.frameWidth * SPRITE_SCALE)}px`,
        height: `${Math.round(sheet.frameHeight * SPRITE_SCALE)}px`,
    } as CSSProperties
    return <span className="status-sprite status-sprite-run" aria-hidden="true" style={style} />
}

export function StatusScreen({ progression, runs, now, onCollect, onBack }: Props) {
    const health = deriveHealth(runs, now)
    return (
        <section className="card status">
            <p className="eyebrow">My status</p>
            <h1>How are your characters?</h1>
            <p className="lede">{RULE_TEXT}</p>
            <div className="stack">
                {ROWS.map(({ character, walletName }) => {
                    const characterHealth = health[character]
                    const pending = pendingIncome(progression, character, now)
                    const wallet = progression.wallets[character]
                    return (
                        <article key={character} className="status-card" aria-labelledby={`status-${character}`}>
                            <StatusSprite character={character} health={characterHealth} />
                            <h2 id={`status-${character}`}>{characterHealth.label}</h2>
                            <p>{`${walletName[0].toUpperCase()}${walletName.slice(1)}: ${wallet}`}</p>
                            <p className="muted">{`Pending ${walletName}: ${pending}`}</p>
                            <button
                                type="button"
                                className="primary"
                                disabled={pending === 0}
                                onClick={() => onCollect(character)}
                            >
                                {pending === 0 ? 'Nothing to collect today' : `Collect ${pending}`}
                            </button>
                            <p className="muted">
                                {`Completed plan sessions in the last 7 days: ${characterHealth.planSessionsInWindow}`}
                            </p>
                        </article>
                    )
                })}
            </div>
            <button type="button" className="link" onClick={onBack}>
                Back
            </button>
        </section>
    )
}
