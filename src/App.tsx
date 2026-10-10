import { useAppFlow } from './hooks/useAppFlow'
import type { Repositories } from './storage/repository'
import { NameScreen } from './screens/NameScreen'
import { CategoryScreen } from './screens/CategoryScreen'
import { BaselineScreen } from './screens/BaselineScreen'
import { PlanScreen } from './screens/PlanScreen'
import { WorkoutScreen } from './screens/WorkoutScreen'
import { RunScreen } from './screens/RunScreen'
import { CompleteScreen } from './screens/CompleteScreen'
import { StatusScreen } from './screens/StatusScreen'
import { ShopScreen } from './screens/ShopScreen'

/** The app depends on repository interfaces only; main.tsx chooses the implementation. */
export default function App({ repositories }: { repositories: Repositories }) {
  const flow = useAppFlow(repositories)
  const { preferences, view, session, plan, open } = flow
  if (!flow.ready) return <main className="shell" aria-busy="true" />
  const name = preferences.name ?? ''
  return <main className="shell">
    {flow.notice && <div className="notice" role="status">{flow.notice}<button type="button" className="link" onClick={flow.dismissNotice}>Dismiss</button></div>}
    {view === 'name' && <NameScreen initialName={name} initialCharacter={preferences.character} initialWeightKg={preferences.weightKg}
      storedCharacter={preferences.name ? preferences.character : undefined}
      onContinue={(next, character, weightKg) => { flow.persistName(next, character, weightKg); flow.setView('home') }} />}
    {(view === 'home' || view === 'category') && <CategoryScreen name={name} selected={open?.workout.category}
      onChangeName={() => flow.setView('name')} onEditAnswers={flow.editAnswers} onPick={flow.pickCategory} onShowPlan={flow.showPlan}
      onShowStatus={flow.openStatus} />}
    {view === 'status' && flow.progression && <StatusScreen progression={flow.progression} runs={flow.runLog} now={new Date()}
      onCollect={flow.collectIncome} onShop={flow.openShop} onBack={() => flow.setView('category')} />}
    {view === 'shop' && flow.progression && <ShopScreen progression={flow.progression} onBuy={flow.buyCosmetic}
      onEquip={flow.equipCosmetic} onUnequip={flow.unequipCosmetic} onBack={flow.openStatus} />}
    {view === 'baseline' && <BaselineScreen initial={flow.answers?.values ?? {}} submitAction={flow.submitAction} onBack={() => flow.setView('category')} onDone={flow.finishAnswers} />}
    {view === 'plan' && plan && <PlanScreen plan={plan} onOpenSession={flow.openSession} onBack={() => flow.setView('category')} />}
    {view === 'workout' && open && <WorkoutScreen workout={open.workout} onChange={flow.changeWorkout} onStart={flow.startWorkout}
      backLabel={open.sessionId ? 'Back to my plan' : 'Pick a different session'}
      onBack={() => flow.setView(open.sessionId ? 'plan' : 'category')} />}
    {view === 'run' && session && <RunScreen session={session} muted={preferences.muted} character={preferences.character}
      onSession={flow.persistSession} onComplete={flow.handleComplete} onQuit={flow.quitRun} onToggleMute={flow.toggleMute} />}
    {view === 'complete' && session && <CompleteScreen name={name} session={session} character={preferences.character} weightKg={preferences.weightKg} onAgain={flow.quitRun} />}
  </main>
}
