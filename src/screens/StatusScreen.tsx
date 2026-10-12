import { CHARACTER_NAMES, type Character } from '../domain/preferences'
import type { CompletedRun, Progression } from '../domain/types'
import { CurrencyIcon } from '../components/CurrencyIcon'
import { deriveHealth } from '../progression/health'
import { CharacterStill } from '../components/CharacterStill'
import { QuestBadge } from '../components/QuestBadge'
import { CURRENCY } from '../progression/questState'
import { localDateOf } from '../progression/localDate'
import { currentWeekIndex, addDays } from '../plan/dates'
import type { TrainingPlan } from '../domain/types'

interface Props {
    /** The locked character. Only this one is shown. */
    character: Character
    progression: Progression
    runs: readonly CompletedRun[]
    plan: TrainingPlan | null
    now: Date
    /** Claims the character's pending daily currency through the quest. Resolves with the number claimed. */
    onCollect: (character: Character) => Promise<number>
    onChangeCharacter?: (character: Character) => void
    onEditAnswers?: () => void
    hasPastRun?: boolean
    onShowPastRun?: () => void
    onBack?: () => void
}

export function StatusScreen({ character, progression, runs, plan, now, onCollect, onChangeCharacter, onEditAnswers, hasPastRun, onShowPastRun }: Props) {
    const health = deriveHealth(runs, now)[character]
    const weekIndex = plan ? currentWeekIndex(plan.startDate, plan.weeks.length, now) : -1
    const currentWeek = plan?.weeks[weekIndex] ?? null
    const weekEnd = currentWeek && plan
        ? plan.weeks[weekIndex + 1]?.startDate ?? addDays(currentWeek.startDate, 7)
        : null
    const completedKm = currentWeek && weekEnd ? Number(runs.reduce((total, run) => {
        const runDate = localDateOf(run.completedAt)
        return run.characterId === character && runDate >= currentWeek.startDate && runDate < weekEnd
            ? total + (run.distanceKm ?? 0)
            : total
    }, 0).toFixed(1)) : 0
    const goalKm = currentWeek ? Number(currentWeek.targetKm.toFixed(1)) : null
    const remainingKm = goalKm === null ? null : Math.max(0, goalKm - completedKm)
    const progressKm = goalKm === null ? 0 : Math.min(completedKm, goalKm)
    const wallet = progression.wallets[character]
    const currencyName = wallet === 1 ? CURRENCY[character].singular : CURRENCY[character].plural
    const otherCharacter = character === 'shiba' ? 'shooshy' : 'shiba'
    const characterName = CHARACTER_NAMES[character]
    return (
        <section className="card status">
            <p className="eyebrow">My status</p>
            <h1>{`How is ${characterName}?`}</h1>
            <div className="daily-goal">
                {currentWeek && goalKm !== null && remainingKm !== null ? (
                    <>
                        <div className="daily-goal-summary">
                            <span>{`${completedKm.toFixed(1)} / ${goalKm.toFixed(1)} km`}</span>
                            <strong>{remainingKm === 0 ? 'Goal complete' : `${remainingKm.toFixed(1)} km left this week`}</strong>
                        </div>
                        <div className="daily-goal-controls">
                            <progress
                                className="daily-goal-progress"
                                value={progressKm}
                                max={goalKm}
                                aria-label={`${characterName}'s week ${currentWeek.number} ${goalKm.toFixed(1)} km plan goal`}
                            />
                        </div>
                    </>
                ) : <p className="muted">No active training plan</p>}
            </div>
            <article className="status-card" aria-labelledby="status-character">
                <div className="status-stage">
                    <CharacterStill character={character} status={health.status} equipped={progression.equipped[character]} />
                </div>
                <h2 id="status-character">{health.label}</h2>
                <div className="status-wallet">
                    <span className="status-wallet-balance" role="img" aria-label={`${wallet} ${currencyName}`}>
                        <CurrencyIcon character={character} />
                        <span aria-hidden="true">{wallet}</span>
                    </span>
                    <QuestBadge progression={progression} character={character} now={now} onCollect={onCollect} />
                </div>
            </article>
            {(onChangeCharacter || onEditAnswers || (hasPastRun && onShowPastRun)) ? (
                <div className="status-actions">
                    {onChangeCharacter ? (
                        <button type="button" className="ghost" onClick={() => onChangeCharacter(otherCharacter)}>
                            {`Switch to ${CHARACTER_NAMES[otherCharacter]}`}
                        </button>
                    ) : null}
                    {onEditAnswers ? <button type="button" className="ghost" onClick={onEditAnswers}>Update answers</button> : null}
                    <button type="button" className="ghost" onClick={onShowPastRun} disabled={!hasPastRun || !onShowPastRun}>View past run</button>
                </div>
            ) : null}
        </section>
    )
}
