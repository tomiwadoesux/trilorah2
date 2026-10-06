/** The recognizer revised a provisional suggestion; this never clears live output. */
export interface RecognitionWithdrawal {
  suggestionId: string
  book: string
  chapter: number
  verse: number
  endVerse?: number | null
}
