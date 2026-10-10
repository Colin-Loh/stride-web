import type { Character } from '../domain/preferences'
import type { CompletedRun, Progression } from '../domain/types'
import { deriveHealth } from '../progression/health'
import { CharacterStill } from '../components/CharacterStill'
import { QuestBadge } from '../components/QuestBadge'
import { CURRENCY } from '../progression/questState'

/** The bottom bar's destinations. Each one is a view the runner can open from here. */
export type HomeDestination = 'workouts' | 'plan' | 'shop' | 'status'

interface Props {
    character: Character
    progression: Progression
    runs: readonly CompletedRun[]
    now: Date
    /** Destination marked as current in the bar. Omitted on the home view itself. */
    current?: HomeDestination
    onPlan: () => void
    onWorkouts: () => void
    onShop: () => void
    onStatus: () => void
    /** Claims the character's pending daily currency through the quest. Resolves with the number claimed. */
    onCollect: (character: Character) => Promise<number>
}

/** Small glyph for each currency, drawn in code. Decorative: the word beside it names it. */
function CurrencyIcon({ character }: { character: Character }) {
    if (character === 'shiba') {
        return (
            <svg className="home-currency-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <g fill="currentColor">
                    <circle cx="5" cy="8" r="3" />
                    <circle cx="5" cy="16" r="3" />
                    <circle cx="19" cy="8" r="3" />
                    <circle cx="19" cy="16" r="3" />
                    <rect x="5" y="10" width="14" height="4" rx="2" />
                </g>
            </svg>
        )
    }
    return (
        <svg className="home-currency-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path fill="currentColor" d="M2 12 L6 8 L6 16 Z" />
            <ellipse cx="14" cy="12" rx="8" ry="5" fill="currentColor" />
        </svg>
    )
}

/**
 * The bottom bar. Four labelled destinations inside a landmark named "Main". The destination
 * marked current carries aria-current="page".
 */
export function HomeNav({ current, onPlan, onWorkouts, onShop, onStatus }: Pick<Props, 'current' | 'onPlan' | 'onWorkouts' | 'onShop' | 'onStatus'>) {
    const items: { id: HomeDestination; label: string; onSelect: () => void }[] = [
        { id: 'workouts', label: 'Workouts', onSelect: onWorkouts },
        { id: 'plan', label: 'My plan', onSelect: onPlan },
        { id: 'shop', label: 'Shop', onSelect: onShop },
        { id: 'status', label: 'Status', onSelect: onStatus },
    ]
    return (
        <nav className="home-nav" aria-label="Main">
            {items.map((item) => (
                <button
                    key={item.id}
                    type="button"
                    className="home-nav-button"
                    aria-current={current === item.id ? 'page' : undefined}
                    onClick={item.onSelect}
                >
                    {item.label}
                </button>
            ))}
        </nav>
    )
}

export function HomeScreen({ character, progression, runs, now, current, onPlan, onWorkouts, onShop, onStatus, onCollect }: Props) {
    const health = deriveHealth(runs, now)[character]
    const count = progression.wallets[character]
    const currency = CURRENCY[character]
    const word = count === 1 ? currency.singular : currency.plural
    return (
        <section className="home" aria-label="Home">
            <div className="home-stage">
                <CharacterStill character={character} status={health.status} equipped={progression.equipped[character]} />
                <QuestBadge progression={progression} character={character} now={now} onCollect={onCollect} />
            </div>
            <p className="home-health">{health.label}</p>
            <p className="home-balance">
                <CurrencyIcon character={character} />
                <span>{`${count} ${word}`}</span>
            </p>
            <HomeNav current={current} onPlan={onPlan} onWorkouts={onWorkouts} onShop={onShop} onStatus={onStatus} />
        </section>
    )
}
