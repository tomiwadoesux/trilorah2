import { cuesFromWatch, RECIPE_FORMAT, type Ability, type Recipe, type RecipePlatform, type RecipeStep } from './schema'

/**
 * The four questions. Trilorah asks, the operator shows, a recipe is written.
 *
 *   find   "Show me how you search for a song or verse here."  (click the box)
 *   show   "Show me how you put what's selected on the screen." (click the button)
 *   clear  "Show me how you take it off — clear or black."
 *   next   "Show me next." / previous
 *
 * Each answer is one or more clicks recorded by the inspector's `watch`: the
 * element's path and cues, never a mouse position. The `find` answer becomes
 * a type step (the operator's query goes in at run time); the rest become
 * presses. Learning happens at sound check, never during a service — the
 * caller enforces that; this only writes what it is shown.
 */

export interface Question {
  ability: Ability
  ask: string
  /** How many clicks make up the answer (a search is usually the box; go-live is one button). */
  clicks: number
  required: boolean
}

export const QUESTIONS: Question[] = [
  { ability: 'find', ask: 'Show me how you search for a song or verse here — click the search box.', clicks: 1, required: false },
  { ability: 'show', ask: "Show me how you put what's selected on the screen — click that button.", clicks: 1, required: true },
  { ability: 'clear', ask: 'Show me how you take it off the screen — click clear or black.', clicks: 1, required: false },
  { ability: 'next', ask: 'Show me next — click the button that steps forward.', clicks: 1, required: false },
  { ability: 'previous', ask: 'Show me previous — click the button that steps back.', clicks: 1, required: false },
]

export interface WatchRecord {
  path?: string
  role?: string
  title?: string
  description?: string
  help?: string
  id?: string
  [key: string]: unknown
}

/** The inspector's `watch`, as the teacher needs it: ask for N clicks, get the records (or nothing, on skip/timeout). */
export type Watcher = (ability: Ability, clicks: number) => Promise<WatchRecord[]>

export interface TeachOptions {
  platform: RecipePlatform
  app: { id: string; name: string; version?: string }
  /** Which questions to ask; default all five. */
  questions?: Question[]
  /** Called before each question with the words to show the operator. */
  say?: (ask: string, ability: Ability) => void
  now?: () => Date
}

export interface TeachResult {
  recipe: Recipe | null
  /** Abilities the operator skipped or that timed out. */
  skipped: Ability[]
  /** Why there is no recipe, when there is none. */
  problem?: string
}

/** One recorded click, as the step a recipe keeps. The find answer types; everything else presses. */
export function stepFromRecord(ability: Ability, record: WatchRecord): RecipeStep {
  const cues = cuesFromWatch(record, labelFor(ability, record))
  const typing = ability === 'find' || /text|search|combo/i.test(record.role ?? '')
  return typing
    ? { ...cues, action: { do: 'type', text: '$query', submit: true } }
    : { ...cues, action: { do: 'press' } }
}

function labelFor(ability: Ability, record: WatchRecord): string {
  const name = [record.title, record.description, record.help].find((v) => typeof v === 'string' && v) as string | undefined
  const what = ability === 'find' ? 'search box' : ability === 'show' ? 'go-live button' : `${ability} button`
  return name ? `the ${what} ("${name}")` : `the ${what}`
}

export async function teach(watch: Watcher, opts: TeachOptions): Promise<TeachResult> {
  const abilities: Recipe['abilities'] = {}
  const skipped: Ability[] = []
  for (const q of opts.questions ?? QUESTIONS) {
    opts.say?.(q.ask, q.ability)
    const records = await watch(q.ability, q.clicks)
    if (records.length < q.clicks) {
      skipped.push(q.ability)
      if (q.required) return { recipe: null, skipped, problem: `${opts.app.name} needs the "${q.ability}" answer — without it Trilorah cannot put anything on its screen` }
      continue
    }
    abilities[q.ability] = records.map((r) => stepFromRecord(q.ability, r))
  }
  return {
    recipe: {
      format: RECIPE_FORMAT,
      platform: opts.platform,
      app: opts.app,
      abilities,
      taught: { by: 'operator', at: (opts.now?.() ?? new Date()).toISOString() },
    },
    skipped,
  }
}
