export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled'

/** The parts of `navigator` used for sharing; both are missing in many desktop browsers. */
export interface ShareNavigator {
    share?: (data: ShareData) => Promise<void>
    canShare?: (data: ShareData) => boolean
}

export function downloadFile(file: File): void {
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    document.body.append(link)
    link.click()
    link.remove()
    // Let the browser start the download before the URL goes away.
    setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * Opens the system share sheet with the picture when the browser can share files, and otherwise
 * saves the PNG. Dismissing the sheet is not an error and does not fall back to a download.
 */
export async function shareOrDownload(
    file: File, text: string, title: string, nav: ShareNavigator = navigator, download: (file: File) => void = downloadFile,
): Promise<ShareOutcome> {
    const data: ShareData = { files: [file], title, text }
    if (nav.share && nav.canShare?.({ files: [file] })) {
        try {
            await nav.share(data)
            return 'shared'
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
            // Any other failure (for example a blocked share) still leaves the runner with the picture.
        }
    }
    download(file)
    return 'downloaded'
}
