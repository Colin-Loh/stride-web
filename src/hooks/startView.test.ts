import { describe, expect, it } from 'vitest'
import { startView } from './startView'
import type { RunSession } from '../domain/types'

const run = { completed: false } as RunSession
const finished = { completed: true } as RunSession

describe('startView', () => {
    it('starts onboarding when no name is saved', () => {
        expect(startView(null, null)).toBe('name')
        expect(startView('', null)).toBe('name')
    })

    it('goes to home for a returning runner with nothing in progress', () => {
        expect(startView('Alex', null)).toBe('home')
    })

    it('resumes an unfinished or finished run ahead of home', () => {
        expect(startView('Alex', run)).toBe('run')
        expect(startView('Alex', finished)).toBe('complete')
    })
})
