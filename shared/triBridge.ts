import type { RunSegment } from './operatorRun'
import type { TriManifest, TriSelection, TriSnapshot } from './triPackage'
import type { ForeignAnswers, ForeignQuestion } from './foreignImport'

export interface TriRendererState {
  run: RunSegment[]
  media: any[]
  customDecks: any[]
  theme?: Record<string, unknown>
}
export interface TriResult {
  canceled?: boolean
  error?: string
  path?: string
  title?: string
  warnings?: string[]
}
export interface TriInspection extends TriResult {
  token?: string
  manifest?: TriManifest
  suggestedSelection?: TriSelection
  /** Things the importer could not place; answer them with triAnswerForeign. */
  questions?: ForeignQuestion[]
}
export interface TriImportResult extends TriResult {
  snapshot?: TriSnapshot
}
export interface TriApi {
  triCatalog: (state: TriRendererState) => Promise<TriSnapshot>
  triSave: (request: { title: string; selection: TriSelection; state: TriRendererState; saveAs?: boolean; exportOnly?: boolean }) => Promise<TriResult>
  triInspect: (recentPath?: string) => Promise<TriInspection>
  triInspectForeign: () => Promise<TriInspection>
  triAnswerForeign: (request: { token: string; answers: ForeignAnswers }) => Promise<TriInspection>
  triDiscardPreview: (token: string) => Promise<void>
  triImport: (request: { token: string; selection: TriSelection; openService: boolean }) => Promise<TriImportResult>
  triRecent: () => Promise<Array<{ path: string; title: string }>>
  triStatus: () => Promise<{ path?: string; title: string; selection?: TriSelection; pendingOpen?: boolean }>
  triNew: () => Promise<void>
  onTriOpenRequested: (callback: () => void) => () => void
}
