export interface SermonStartState {
  status: 'watching' | 'approaching' | 'confirmation' | 'active'
  requestId: number
  candidateAt: number | null
  startedAt: number | null
  confirmedAt: number | null
  evidence: string[]
}

export type SermonStartAction = 'start' | 'confirm' | 'not-yet' | 'end'
