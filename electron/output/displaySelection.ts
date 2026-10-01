import { OUTPUT_ORDER } from './displays'

type Choices = Partial<Record<string, number | 'none'>>

/** A display choice activates that output, without opening unrelated outputs. */
export function applyDisplaySelection(
  before: Choices,
  after: Choices,
  actions: { isOpen(id: string): boolean; open(id: string): void; move(id: string): void; close(id: string): void },
): void {
  for (const id of OUTPUT_ORDER) {
    if (after[id] === 'none') {
      if (actions.isOpen(id)) actions.close(id)
    } else if (actions.isOpen(id)) {
      actions.move(id)
    } else if (before[id] !== after[id]) {
      actions.open(id)
    }
  }
}
