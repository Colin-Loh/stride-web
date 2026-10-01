import { useAppFlow } from './hooks/useAppFlow'
import { toCharacter } from './storage'
import { NameScreen } from './screens/NameScreen'
import { CategoryScreen } from './screens/CategoryScreen'
import { BaselineScreen } from './screens/BaselineScreen'
import { PlanScreen } from './screens/PlanScreen'
import { RunScreen } from './screens/RunScreen'
import { CompleteScreen } from './screens/CompleteScreen'

export default function App() {
  const flow = useAppFlow()
  const { profile, view, session, plan } = flow
  return <main className="shell">
    {flow.notice && <div className="notice" role="status">{flow.notice}<button type="button" className="link" onClick={flow.dismissNotice}>Dismiss</button></div>}
    {view === 'name' && <NameScreen initialName={profile.name ?? ''} initialCharacter={toCharacter(profile.character)}
      onContinue={(name, character) => { flow.persistProfile({ name, character }); flow.setView('category') }} />}
    {view === 'category' && <CategoryScreen name={profile.name ?? ''} selected={plan?.category}
      onChangeName={() => flow.setView('name')} onEditAnswers={flow.editAnswers} onPick={flow.pickCategory} />}
    {view === 'baseline' && <BaselineScreen initial={flow.answers} editAll={flow.editingAnswers} onBack={() => flow.setView('category')} onDone={flow.finishAnswers} />}
    {view === 'plan' && plan && <PlanScreen workout={plan} onChange={flow.persistPlan} onBack={() => flow.setView('category')} onStart={flow.startPlan} />}
    {view === 'run' && session && <RunScreen session={session} muted={flow.muted} character={toCharacter(profile.character)}
      onSession={flow.persistSession} onComplete={flow.handleComplete} onQuit={flow.quitRun} onToggleMute={flow.toggleMute} />}
    {view === 'complete' && session && <CompleteScreen name={profile.name ?? ''} session={session} onAgain={flow.quitRun} />}
  </main>
}
