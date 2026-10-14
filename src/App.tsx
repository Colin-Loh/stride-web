import { useAppFlow } from './hooks/useAppFlow'
import type { Repositories } from './storage/repository'
import { NameScreen } from './screens/NameScreen'
import { BaselineScreen } from './screens/BaselineScreen'
import { PlanScreen } from './screens/PlanScreen'
import { WorkoutScreen } from './screens/WorkoutScreen'
import { RunScreen } from './screens/RunScreen'
import { CompleteScreen } from './screens/CompleteScreen'
import { StatusScreen } from './screens/StatusScreen'
import { ShopScreen } from './screens/ShopScreen'
import { HomeNav } from './components/HomeNav'

/** The app depends on repository interfaces only; main.tsx chooses the implementation. */
export default function App({ repositories }: { repositories: Repositories }) {
  const flow = useAppFlow(repositories)
  const { preferences, view, session, plan, open } = flow
  if (!flow.ready) return <main className="shell" data-theme="retro" aria-busy="true" />
  const name = preferences.name ?? ''
  // The retro-pixel theme covers every screen.
  return <main className="shell" data-theme="retro" data-screen={view === 'home' || view === 'status' ? 'status' : undefined}>
    {flow.notice && <div className="notice" role="status">{flow.notice}<button type="button" className="link" onClick={flow.dismissNotice}>Dismiss</button></div>}
    {view === 'name' && <NameScreen initialName={name} initialCharacter={preferences.character} initialWeightKg={preferences.weightKg}
      storedCharacter={preferences.name ? preferences.character : undefined}
      onContinue={(next, character, weightKg) => { flow.persistName(next, character, weightKg); flow.setView('home') }} />}
    {(view === 'home' || view === 'status') && flow.progression && <StatusScreen character={preferences.character} progression={flow.progression} runs={flow.runLog} now={new Date()}
      plan={flow.plan}
      hasPastRun={flow.runLog.some(run => run.characterId === preferences.character && run.session !== undefined)}
      onCollect={flow.collectIncome} onEditAnswers={flow.editAnswers} onSwitchToChase={flow.switchToChase} onSwitchToShooshy={flow.switchToShooshy} onShowPastRun={flow.showPastRun} />}
    {(view === 'home' || view === 'status') && flow.progression && <HomeNav current="status" onPlan={flow.showPlan} onShop={flow.openShop} onStatus={flow.openStatus} />}
    {view === 'past-complete' && flow.pastRunSession && <CompleteScreen name={name} session={flow.pastRunSession}
      character={flow.pastRunSession.characterId ?? preferences.character} weightKg={preferences.weightKg}
      onAgain={flow.closePastRun} onAgainLabel="Back to status" />}
    {view === 'shop' && flow.progression && <ShopScreen character={preferences.character} progression={flow.progression}
      onBuy={flow.buyCosmetic} onEquip={flow.equipCosmetic} onUnequip={flow.unequipCosmetic} />}
    {view === 'shop' && flow.progression && <HomeNav current="shop" onPlan={flow.showPlan} onShop={flow.openShop} onStatus={flow.openStatus} />}
    {view === 'baseline' && <BaselineScreen initial={flow.answers?.values ?? {}} submitAction={flow.submitAction} onBack={() => flow.setView('home')} onDone={flow.finishAnswers} />}
    {view === 'plan' && plan && <PlanScreen plan={plan} onOpenSession={flow.openSession} />}
    {view === 'plan' && plan && <HomeNav current="plan" onPlan={flow.showPlan} onShop={flow.openShop} onStatus={flow.openStatus} />}
    {view === 'workout' && open && <WorkoutScreen workout={open.workout} onChange={flow.changeWorkout} onStart={flow.startWorkout}
      backLabel={open.sessionId ? 'Back to my plan' : 'Pick a different session'}
      onBack={() => flow.setView(open.sessionId ? 'plan' : 'home')} />}
    {view === 'run' && session && <RunScreen session={session} muted={preferences.muted} character={preferences.character}
      equipped={flow.progression?.equipped[preferences.character]}
      onSession={flow.persistSession} onComplete={flow.handleComplete} onQuit={flow.quitRun} onToggleMute={flow.toggleMute} />}
    {view === 'complete' && session && <CompleteScreen name={name} session={session} character={preferences.character} weightKg={preferences.weightKg} onAgain={flow.quitRun} />}
  </main>
}
