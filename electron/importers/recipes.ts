import fs from 'node:fs'
import path from 'node:path'
import type { ForeignColumnChoice } from '../../shared/foreignImport'

/** Structure signature → what the operator said last time. Content never enters this file. */
export type Recipes = Record<string, ForeignColumnChoice | 'skip'>
const FILE = 'import-recipes.json'
const valid = (value: unknown): value is ForeignColumnChoice | 'skip' => value === 'skip' || (!!value && typeof value === 'object' && typeof (value as any).title === 'string' && typeof (value as any).lyrics === 'string')

export function readRecipes(userData: string): Recipes {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(userData, FILE), 'utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).filter(([key, value]) => /^(sqlite|json|xml):[a-f0-9]{64}$/.test(key) && valid(value))) as Recipes
  } catch { return {} }
}

export function writeRecipes(userData: string, recipes: Recipes) {
  const entries = Object.entries(recipes).filter(([key, value]) => /^(sqlite|json|xml):[a-f0-9]{64}$/.test(key) && valid(value)).slice(-500)
  fs.mkdirSync(userData, { recursive: true })
  fs.writeFileSync(path.join(userData, FILE), JSON.stringify(Object.fromEntries(entries), null, 2))
}
