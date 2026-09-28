import type { PreacherStats, ReviewItem } from './types'

export interface BookAlias {
  heard: string
  means: string
  source: 'learned' | 'taught'
  hits: number
}

export interface PreacherTeaching {
  soundsLike: BookAlias[]
  vocabulary: string[]
  ignoreTails: string[]
  voiceCommands: boolean
}

export interface PreacherLearningDetail extends PreacherTeaching {
  stats: PreacherStats
  gates: { trust: number; samples: number; services: number }
  reviews: ReviewItem[]
  history: { label: string; trust: number; precision: number }[]
  legacySamples: number
  serviceOpen: boolean
  habits: { avgSermonMin: number | null; mostQuoted: string | null; topBooks: string[]; lastPreached: string | null }
  recent: { date: string; verses: number; accuracy: number | null; minutes: number }[]
}

export const SOUND_CHECK_PROMPTS = [
  { say: 'Proverbs chapter three, verse five', book: 'Proverbs', chapter: 3, verse: 5 },
  { say: 'First John chapter four, verse eight', book: '1 John', chapter: 4, verse: 8 },
  { say: 'Romans chapter eight, verse twenty-eight', book: 'Romans', chapter: 8, verse: 28 },
] as const

export interface SoundCheckState {
  sessionId: string
  preacherId: string
  promptIndex: number
  status: 'starting' | 'listening' | 'finished' | 'error'
  message: string
  heard: string
  detected: string | null
  matches: boolean
}
