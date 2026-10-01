/** Restore a newly opened screen, unless newer live content arrives first. */
export function outputRestore<T>(read: () => Promise<T>, apply: (snapshot: T) => void) {
  let changed = false
  let disposed = false
  return {
    invalidate() { changed = true },
    dispose() { disposed = true },
    async restore() {
      try {
        const snapshot = await read()
        if (!changed && !disposed) apply(snapshot)
      } catch { /* A closing output or unavailable main process has no snapshot. */ }
    },
  }
}
