import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseRecipe, type Recipe } from './schema'

/**
 * Where recipes live, and how they are read.
 *
 * - shipped: written by us for the common apps, inside the build.
 * - taught: written by the operator's four answers, in Trilorah's own data
 *   folder, so an update of Trilorah never erases what a church taught it.
 *
 * A taught recipe for the same app wins over a shipped one: the church's own
 * screen beats our guess about it.
 */
export interface LoadedRecipe {
  /** How commands name it: app:<its id>. */
  id: string
  recipe: Recipe
  source: 'shipped' | 'taught'
  file: string
}

export const APP_DATA_NAME = 'ai-preacher-assistant'

/** Trilorah's data folder, the same one Electron's app.getPath('userData') gives. */
export function userDataDir(): string {
  const home = os.homedir()
  if (process.platform === 'darwin') return path.join(home, 'Library', 'Application Support', APP_DATA_NAME)
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), APP_DATA_NAME)
  return path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), APP_DATA_NAME)
}

export function taughtRecipesDir(userData = userDataDir()): string {
  return path.join(userData, 'controller', 'recipes')
}

export const targetId = (recipe: Recipe): string => `app:${recipe.app.id}`

function readDir(dir: string, source: LoadedRecipe['source']): LoadedRecipe[] {
  let names: string[]
  try { names = fs.readdirSync(dir).filter((n) => n.endsWith('.json')) } catch { return [] }
  const out: LoadedRecipe[] = []
  for (const name of names) {
    const file = path.join(dir, name)
    try {
      const recipe = parseRecipe(JSON.parse(fs.readFileSync(file, 'utf8')))
      if (recipe) out.push({ id: targetId(recipe), recipe, source, file })
    } catch { /* a bad file is not a reason to lose the good ones */ }
  }
  return out
}

/** Every usable recipe for this platform, taught ones first and winning on a tie. */
export function loadRecipes(opts: { shippedDir?: string; taughtDir?: string; platform?: NodeJS.Platform } = {}): LoadedRecipe[] {
  const platform = opts.platform ?? process.platform
  const want = platform === 'win32' ? 'windows' : 'macos'
  const taught = readDir(opts.taughtDir ?? taughtRecipesDir(), 'taught')
  const shipped = readDir(opts.shippedDir ?? path.resolve(__dirname, 'shipped'), 'shipped')
  const seen = new Set<string>()
  const out: LoadedRecipe[] = []
  for (const r of [...taught, ...shipped]) {
    if (r.recipe.platform !== want || seen.has(r.id)) continue
    seen.add(r.id)
    out.push(r)
  }
  return out
}
