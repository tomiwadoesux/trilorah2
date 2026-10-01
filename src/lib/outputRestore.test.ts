import { describe, expect, it, vi } from 'vitest'
import { outputRestore } from './outputRestore'

describe('opening an output mid-service', () => {
  it('loads the scripture already live', async () => {
    const snapshot = { verse: { book: 'Titus', chapter: 1, verse: 3 }, content: null }
    const apply = vi.fn()
    await outputRestore(async () => snapshot, apply).restore()
    expect(apply).toHaveBeenCalledWith(snapshot)
  })
  it('does not replace a new live push or clear with a late startup snapshot', async () => {
    let resolve!: (value: string) => void
    const apply = vi.fn()
    const restore = outputRestore(() => new Promise<string>(r => { resolve = r }), apply)
    const pending = restore.restore()
    restore.invalidate()
    resolve('old verse')
    await pending
    expect(apply).not.toHaveBeenCalled()
  })
  it('does not update a closed output', async () => {
    const apply = vi.fn()
    const restore = outputRestore(async () => 'verse', apply)
    const pending = restore.restore()
    restore.dispose()
    await pending
    expect(apply).not.toHaveBeenCalled()
  })
})
