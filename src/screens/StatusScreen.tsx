import type { CSSProperties } from 'react'
import type { Character } from '../domain/preferences'
import type { CompletedRun, Progression } from '../domain/types'
import { deriveHealth, type CharacterHealth } from '../progression/health'
import { pendingIncome } from '../progression/income'
import { CHARACTER_SPRITES, OBESE_STILLS } from '../sprites'
import { CosmeticOverlay } from '../cosmetics/CosmeticOverlay'
import { STILL_SCALE } from '../cosmetics/art'
import { isCosmeticId } from '../cosmetics/catalog'

/** Same scale as the other sprites, so frame edges stay on whole pixels. */
const SPRITE_SCALE = STILL_SCALE

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
    onShop: () => void
    onBack: () => void
}

/**
 * The still picture for a character: the obese still when obese, otherwise the first frame of
 * the run sheet, with the equipped item drawn over it. Decorative: the health label beside it
 * carries the meaning, so alt is empty.
 */
function StatusSprite({ character, health, equipped }: { character: Character; health: CharacterHealth; equipped: string | null }) {
    const sprite =
        health.status === 'obese' ? (
            <img
                className="status-sprite"
                src={OBESE_STILLS[character].url}
                width={Math.round(OBESE_STILLS[character].width * SPRITE_SCALE)}
                height={Math.round(OBESE_STILLS[character].height * SPRITE_SCALE)}
                alt=""
            />
        ) : (
            <span
                className="status-sprite status-sprite-run"
                aria-hidden="true"
                style={{
                    backgroundImage: `url(${CHARACTER_SPRITES[character].url})`,
                    backgroundSize: `${CHARACTER_SPRITES[character].frames * 100}% 100%`,
                    backgroundPosition: '0 0',
                    width: `${Math.round(CHARACTER_SPRITES[character].frameWidth * SPRITE_SCALE)}px`,
                    height: `${Math.round(CHARACTER_SPRITES[character].frameHeight * SPRITE_SCALE)}px`,
                } as CSSProperties}
            />
        )
    return (
        <div className="still-frame">
            {sprite}
            {isCosmeticId(equipped) && <CosmeticOverlay itemId={equipped} />}
        </div>
    )
}

export function StatusScreen({ progression, runs, now, onCollect, onShop, onBack }: Props) {
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
                            <StatusSprite character={character} health={characterHealth} equipped={progression.equipped[character]} />
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
            <button type="button" className="ghost" onClick={onShop}>
                Shop
            </button>
            <button type="button" className="link" onClick={onBack}>
                Back
            </button>
        </section>
    )
}
