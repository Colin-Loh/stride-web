/** The message a runner sees when saved data could not be used. Shared by every repository. */

let notice = ''

export const OUTDATED_NOTICE = 'Some saved data is outdated or invalid. Start a new workout; your valid profile is kept.'
export const UNREADABLE_NOTICE = 'Saved data could not be read. You can continue with a new workout.'
export const UNSAVED_NOTICE = 'Changes cannot be saved in this browser. Keep this page open; refreshing may lose your workout.'

export const storageNotice = () => notice

export function warn(message: string) {
    notice = message
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('stride-storage'))
}

export function clearStorageNotice() {
    notice = ''
}
