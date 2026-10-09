import type { TriSelection, TriSnapshot } from './triPackage'

/** What the operator can say about a text file the importer could not place. */
export type ForeignTextChoice = 'song' | 'note' | 'skip'
/** Which columns (or fields) of a table-shaped source hold the song. */
export interface ForeignColumnChoice { title: string; lyrics: string }
export type ForeignChoice = ForeignTextChoice | ForeignColumnChoice
export type ForeignAnswers = Record<string, ForeignChoice>

/**
 * One thing the importer is not sure about. `text` questions are per file and
 * offer song / note / skip. `table` questions ask which column is the title and
 * which is the lyrics; their `signature` describes the structure only (never the
 * content) and is the key under which an answer is remembered as a recipe.
 */
export interface ForeignQuestion {
  id: string
  kind: 'text' | 'table'
  file: string
  preview: string[]
  columns?: string[]
  signature?: string
  rows?: number
  suggested?: ForeignChoice
  answer?: ForeignChoice
  remembered?: boolean
}

export const isColumnChoice = (choice: ForeignChoice | undefined): choice is ForeignColumnChoice => !!choice && typeof choice === 'object'
export const unanswered = (questions: ForeignQuestion[] | undefined) => (questions ?? []).filter(question => question.answer === undefined)

/** Keep the review checkboxes/count consistent with the resources the backend includes for a selected run/theme. */
export function foreignDependencies(snapshot: TriSnapshot, selection: TriSelection): TriSelection {
  const songs = new Set<string>(), paths = new Set<string>()
  for (const service of snapshot.categories.service ?? []) {
    if (!selection.service?.includes(service.id)) continue
    for (const segment of service.data.segments ?? []) for (const row of segment.items ?? []) {
      if (row.songId) songs.add(row.songId)
      if (row.path) paths.add(row.path)
      if (row.preview) paths.add(row.preview)
    }
  }
  for (const theme of snapshot.categories.themes ?? []) if (selection.themes?.includes(theme.id) && theme.data.defaultBackgroundUrl) paths.add(theme.data.defaultBackgroundUrl)
  return {
    songs: (snapshot.categories.songs ?? []).filter(item => songs.has(item.id)).map(item => item.id),
    media: (snapshot.categories.media ?? []).filter(item => paths.has(item.data.url)).map(item => item.id),
  }
}
