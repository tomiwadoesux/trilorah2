import * as fs from 'node:fs'

export interface ExpectedVerse {
  ref: string
  context?: string
}

export interface SermonPlan {
  title: string
  date?: string
  preacherId?: string
  expectedVerses: ExpectedVerse[]
  outline?: any[]
  themes?: string[]
}

export function loadSermonPlan(jsonOrPath: string): SermonPlan {
  let raw: string
  if (jsonOrPath.endsWith('.json') && fs.existsSync(jsonOrPath)) {
    raw = fs.readFileSync(jsonOrPath, 'utf-8')
  } else {
    raw = jsonOrPath
  }
  const parsed = JSON.parse(raw)
  const plan: SermonPlan = {
    title: parsed.title || 'Untitled',
    date: parsed.date,
    preacherId: parsed.preacherId,
    expectedVerses: [],
    outline: parsed.outline,
    themes: parsed.themes
  }
  if (Array.isArray(parsed.expectedVerses)) {
    plan.expectedVerses = parsed.expectedVerses.map(
      (v: any) => typeof v === 'string' ? { ref: v } : v
    )
  }
  if (Array.isArray(parsed.outline)) {
    for (const point of parsed.outline) {
      if (Array.isArray(point.scriptures)) {
        for (const ref of point.scriptures) {
          if (!plan.expectedVerses.some((v) => v.ref === ref)) {
            plan.expectedVerses.push({ ref, context: 'outline' })
          }
        }
      }
    }
  }
  return plan
}

export function getExpectedVerseRefs(plan: SermonPlan): string[] {
  return plan.expectedVerses.map((v) => v.ref)
}
