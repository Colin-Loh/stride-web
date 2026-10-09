import { describe, expect, it, vi } from 'vitest'
import { shareOrDownload, type ShareNavigator } from './share'

const file = new File(['png'], 'stride-session.png', { type: 'image/png' })

describe('shareOrDownload', () => {
    it('shares the file when the browser can share files', async () => {
        const nav: ShareNavigator = { canShare: vi.fn(() => true), share: vi.fn(async () => undefined) }
        const download = vi.fn()
        expect(await shareOrDownload(file, 'text', 'title', nav, download)).toBe('shared')
        expect(nav.canShare).toHaveBeenCalledWith({ files: [file] })
        expect(nav.share).toHaveBeenCalledWith({ files: [file], title: 'title', text: 'text' })
        expect(download).not.toHaveBeenCalled()
    })

    it('downloads when canShare refuses files or share does not exist', async () => {
        const download = vi.fn()
        const refuse: ShareNavigator = { canShare: () => false, share: vi.fn() }
        expect(await shareOrDownload(file, 't', 't', refuse, download)).toBe('downloaded')
        expect(refuse.share).not.toHaveBeenCalled()
        expect(await shareOrDownload(file, 't', 't', { canShare: () => true }, download)).toBe('downloaded')
        expect(await shareOrDownload(file, 't', 't', {}, download)).toBe('downloaded')
        expect(download).toHaveBeenCalledTimes(3)
        expect(download).toHaveBeenCalledWith(file)
    })

    it('treats dismissing the share sheet as cancelled, with no download', async () => {
        const download = vi.fn()
        const nav: ShareNavigator = { canShare: () => true, share: async () => { throw new DOMException('dismissed', 'AbortError') } }
        expect(await shareOrDownload(file, 't', 't', nav, download)).toBe('cancelled')
        expect(download).not.toHaveBeenCalled()
    })

    it('still downloads when sharing fails for another reason', async () => {
        const download = vi.fn()
        const nav: ShareNavigator = { canShare: () => true, share: async () => { throw new DOMException('blocked', 'NotAllowedError') } }
        expect(await shareOrDownload(file, 't', 't', nav, download)).toBe('downloaded')
        expect(download).toHaveBeenCalledWith(file)
    })
})
