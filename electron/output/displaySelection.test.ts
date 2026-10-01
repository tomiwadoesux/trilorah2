import { describe, expect, it, vi } from 'vitest'
import { applyDisplaySelection } from './displaySelection'

const actions = (open: string[] = []) => ({ isOpen: (id: string) => open.includes(id), open: vi.fn(), move: vi.fn(), close: vi.fn() })
describe('choosing an output display', () => {
  it('opens the chosen closed output, without opening other outputs', () => {
    const a = actions()
    applyDisplaySelection({}, { main: 2 }, a)
    expect(a.open.mock.calls).toEqual([['main']])
    expect(a.move).not.toHaveBeenCalled()
  })
  it('moves an existing output instead of creating a duplicate', () => {
    const a = actions(['main'])
    applyDisplaySelection({ main: 2 }, { main: 3 }, a)
    expect(a.move.mock.calls).toEqual([['main']])
    expect(a.open).not.toHaveBeenCalled()
  })
  it('closes disabled outputs and reopens them when automatic is selected', () => {
    const a = actions(['main'])
    applyDisplaySelection({ main: 2 }, { main: 'none' }, a)
    expect(a.close.mock.calls).toEqual([['main']])
    const b = actions()
    applyDisplaySelection({ main: 'none' }, {}, b)
    expect(b.open.mock.calls).toEqual([['main']])
  })
  it('does not reopen a deliberately closed unrelated output', () => {
    const a = actions()
    applyDisplaySelection({ main: 2, alternate: 3 }, { main: 2, alternate: 4 }, a)
    expect(a.open.mock.calls).toEqual([['alternate']])
  })
})
