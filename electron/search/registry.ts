/**
 * Command registry — the single list of everything a person can navigate
 * to or trigger from the palette: screens, sections inside screens,
 * individual settings, and actions.
 *
 * Pure data. No Electron, no UI. The palette (built later) reads this
 * through SearchIndex; the seed list lives in ./entries.ts.
 */

export type RegistryKind = 'screen' | 'section' | 'setting' | 'action'

export interface RegistryEntry {
  id: string
  kind: RegistryKind
  title: string
  /** Renderer route, e.g. '/settings#asr'. Actions carry the screen they act on. */
  route: string
  keywords: string[]
  /** A short paragraph written the way a person would ask for this thing. */
  description: string
  /** For kind 'action': the id the renderer/main dispatches on. */
  actionId?: string
}

export class CommandRegistry {
  private entries = new Map<string, RegistryEntry>()

  constructor(seed: RegistryEntry[] = []) {
    this.register(seed)
  }

  register(entry: RegistryEntry | RegistryEntry[]): void {
    const list = Array.isArray(entry) ? entry : [entry]
    for (const e of list) {
      if (!e.id) throw new Error('RegistryEntry requires an id')
      this.entries.set(e.id, { ...e, keywords: [...e.keywords] })
    }
  }

  remove(id: string): boolean {
    return this.entries.delete(id)
  }

  get(id: string): RegistryEntry | undefined {
    return this.entries.get(id)
  }

  all(): RegistryEntry[] {
    return [...this.entries.values()]
  }

  get size(): number {
    return this.entries.size
  }
}
