import { useState } from 'react'
import { renderCardPng } from './cardRender'
import { shareText, type CardData } from './cardLayout'
import { shareOrDownload } from './share'

const FILE_NAME = 'stride-session.png'

/** Draws the share card to a PNG and hands it to the share sheet, or saves it when sharing files is unavailable. */
export function ShareButton({ data, onIncludeCalories }: { data: CardData; onIncludeCalories: (include: boolean) => void }) {
    const [busy, setBusy] = useState(false)
    const [status, setStatus] = useState('')

    async function share() {
        setBusy(true)
        setStatus('')
        try {
            const png = await renderCardPng(data)
            const outcome = await shareOrDownload(new File([png], FILE_NAME, { type: 'image/png' }), shareText(data), 'Stride session')
            setStatus(outcome === 'shared' ? 'Shared.' : outcome === 'downloaded' ? 'Picture saved to your downloads.' : '')
        } catch {
            setStatus('The picture could not be created. Try again.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="share">
            {data.summary.kcal !== null ? (
                <label className="check">
                    <input type="checkbox" checked={data.includeCalories} onChange={(event) => onIncludeCalories(event.target.checked)} />
                    Include calories on the picture
                </label>
            ) : null}
            <button type="button" className="ghost" disabled={busy} onClick={share}>{busy ? 'Making picture…' : 'Share'}</button>
            <p role="status" className="muted">{status}</p>
        </div>
    )
}
