/** The bottom bar's destinations. Each one is a view the runner can open from here. */
export type HomeDestination = 'workouts' | 'plan' | 'shop' | 'status'

interface Props {
    /** Destination marked as current in the bar. Omitted when none applies. */
    current?: HomeDestination
    onPlan: () => void
    onWorkouts: () => void
    onShop: () => void
    onStatus: () => void
}

/**
 * The bottom bar. Four labelled destinations inside a landmark named "Main". The destination
 * marked current carries aria-current="page".
 */
export function HomeNav({ current, onPlan, onWorkouts, onShop, onStatus }: Props) {
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
