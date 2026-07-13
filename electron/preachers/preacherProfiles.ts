import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'
import type { ServiceContext } from '../engine/serviceContext'

export interface FavoriteVerse {
  ref: string
  frequency: number
}

export interface SermonHistoryEntry {
  date: string
  title?: string
  versesUsed: string[]
  topics: string[]
  durationMinutes: number
}

export interface PreacherProfile {
  id: string
  name: string
  favoriteVerses: FavoriteVerse[]
  commonTopics: string[]
  speechPatterns: any[]
  sermonHistory: SermonHistoryEntry[]
  createdAt: string
  updatedAt: string
}

function getProfilesDir(): string {
  const dir = path.join(app.getPath('userData'), 'preacher-profiles')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

function profilePath(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '_')
  return path.join(getProfilesDir(), `${safe}.json`)
}

export function createProfile(id: string, name: string): PreacherProfile {
  const now = new Date().toISOString()
  return {
    id,
    name,
    favoriteVerses: [],
    commonTopics: [],
    speechPatterns: [],
    sermonHistory: [],
    createdAt: now,
    updatedAt: now
  }
}

export function loadProfile(id: string): PreacherProfile | null {
  const filePath = profilePath(id)
  if (!fs.existsSync(filePath)) return null
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    console.error(`Failed to load preacher profile: ${id}`)
    return null
  }
}

export function saveProfile(profile: PreacherProfile) {
  profile.updatedAt = new Date().toISOString()
  const filePath = profilePath(profile.id)
  fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), 'utf-8')
  console.log(`💾 Saved preacher profile: ${profile.name} (${profile.id})`)
}

export function listProfiles(): Array<{ id: string; name: string }> {
  const dir = getProfilesDir()
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
  const profiles: Array<{ id: string; name: string }> = []
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, file), 'utf-8')
      const data = JSON.parse(raw)
      profiles.push({ id: data.id, name: data.name })
    } catch {
    }
  }
  return profiles
}

export function deleteProfile(id: string): boolean {
  const filePath = profilePath(id)
  if (!fs.existsSync(filePath)) return false
  fs.unlinkSync(filePath)
  return true
}

export function extractAndUpdateProfile(
  context: ServiceContext,
  preacherId: string,
  preacherName: string,
  sermonTitle?: string
): PreacherProfile {
  let profile = loadProfile(preacherId)
  if (!profile) {
    profile = createProfile(preacherId, preacherName)
  }
  const entry = buildHistoryEntry(context, sermonTitle)
  profile.sermonHistory.push(entry)
  if (profile.sermonHistory.length > 50) {
    profile.sermonHistory = profile.sermonHistory.slice(-50)
  }
  updateVerseFrequencies(profile, context.detectedVerses)
  const topics = extractTopics(context.getFullSermonText())
  updateTopics(profile, topics)
  saveProfile(profile)
  console.log(
    `🧠 MemoryExtractor: updated profile for ${profile.name} — ${entry.versesUsed.length} verses, ${topics.length} topics`
  )
  return profile
}

function buildHistoryEntry(context: ServiceContext, title?: string): SermonHistoryEntry {
  const versesUsed = [
    ...new Set(context.detectedVerses.map((v) => v.ref))
  ]
  const durationMinutes = Math.round(
    (Date.now() - context.serviceStartTime) / 6e4
  )
  const topics = extractTopics(context.getFullSermonText())
  return {
    date: new Date().toISOString().split('T')[0],
    title,
    versesUsed,
    topics,
    durationMinutes
  }
}

function updateVerseFrequencies(profile: PreacherProfile, detections: Array<{ ref: string }>) {
  const refs = [...new Set(detections.map((v) => v.ref))]
  for (const ref of refs) {
    const existing = profile.favoriteVerses.find((fv) => fv.ref === ref)
    if (existing) {
      existing.frequency += 1
    } else {
      profile.favoriteVerses.push({ ref, frequency: 1 })
    }
  }
  profile.favoriteVerses.sort((a, b) => b.frequency - a.frequency)
  if (profile.favoriteVerses.length > 100) {
    profile.favoriteVerses = profile.favoriteVerses.slice(0, 100)
  }
}

const TOPIC_KEYWORDS = [
  'grace',
  'faith',
  'love',
  'hope',
  'salvation',
  'redemption',
  'forgiveness',
  'prayer',
  'worship',
  'holiness',
  'righteousness',
  'mercy',
  'justice',
  'peace',
  'joy',
  'healing',
  'deliverance',
  'covenant',
  'kingdom',
  'glory',
  'repentance',
  'obedience',
  'sacrifice',
  'resurrection',
  'baptism',
  'communion',
  'fellowship',
  'discipleship',
  'evangelism',
  'stewardship',
  'persecution',
  'suffering',
  'temptation',
  'sin',
  'judgment',
  'prophecy',
  'revelation',
  'creation',
  'marriage',
  'family',
  'prosperity',
  'blessing',
  'tithe',
  'offering',
  'anointing',
  'spirit',
  'holy spirit',
  'christ',
  'cross',
  'blood'
]

function extractTopics(sermonText: string): string[] {
  if (!sermonText) return []
  const lower = sermonText.toLowerCase()
  const found: string[] = []
  for (const topic of TOPIC_KEYWORDS) {
    const regex = new RegExp(`\\b${topic}\\b`, 'gi')
    const matches = lower.match(regex)
    if (matches && matches.length >= 2) {
      found.push(topic)
    }
  }
  return found
}

function updateTopics(profile: PreacherProfile, newTopics: string[]) {
  for (const topic of newTopics) {
    if (!profile.commonTopics.includes(topic)) {
      profile.commonTopics.push(topic)
    }
  }
  if (profile.commonTopics.length > 50) {
    profile.commonTopics = profile.commonTopics.slice(-50)
  }
}
