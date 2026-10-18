import { capitalizeScriptureNames } from './scriptureNames'

// Notes use several shapes (incremental, generated, archived). Only content
// fields are cased; IDs, file paths, URLs and other metadata remain untouched.
const TEXT_FIELDS = new Set([
  'title', 'theme', 'summary', 'heading', 'point', 'explanation', 'content',
  'term', 'definition', 'applications', 'quotes', 'memorable_quotes',
  'scriptures', 'all_scriptures',
])

export function formatNoteText<T>(notes: T): T {
  function visit(value: unknown, field = ''): unknown {
    if (typeof value === 'string') return TEXT_FIELDS.has(field) ? capitalizeScriptureNames(value) : value
    if (Array.isArray(value)) return value.map((item) => visit(item, field))
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item, key)]))
    }
    return value
  }
  return visit(notes) as T
}
