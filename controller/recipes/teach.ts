import { cuesFromWatch, RECIPE_FORMAT, type Ability, type Recipe, type RecipePlatform, type RecipeStep } from './schema'

/**
 * The six questions. Trilorah asks, the operator shows, a recipe is written.
 *
 * Each question is a small rehearsal of Sunday, not an instruction: "pull up
 * John 3:16 the way you would live", so the operator understands what the
 * click is for. An answer is the WHOLE trail of clicks it took — opening
 * Collections, switching to the Scripture tab, then the search box — ended
 * by the operator saying "that's it" (or the trail filling up). The last
 * click is the target; the clicks before it are the way there, kept as
 * `enroute` steps that replay only when the target is not already reachable.
 *
 * Verses and songs are asked separately: most presentation software keeps
 * them in different places, and typing a song title into a scripture box
 * (or the reverse) is exactly the Sunday surprise teaching exists to prevent.
 *
 * Learning happens at sound check, never during a service — the caller
 * enforces that; this only writes what it is shown.
 */

export interface Question {
  ability: Ability
  ask: string
  /** The most clicks one answer can hold; the trail usually ends on "that's it" well before. */
  maxClicks: number
  required: boolean
}

export const MAX_TRAIL = 8

export const QUESTIONS: Question[] = [
  {
    ability: 'findVerse',
    ask: 'Pull up John 3:16 the way you would on a Sunday. If you open a Bible or Scripture panel on the way, those clicks are part of the lesson — finish on the box you type the verse into.',
    maxClicks: MAX_TRAIL,
    required: false,
  },
  {
    ability: 'findSong',
    ask: 'Now a song: go where you would look up "Amazing Grace" and finish on the box you type the title into. Songs often live somewhere else than verses — if it is the same box here, click the same box again.',
    maxClicks: MAX_TRAIL,
    required: false,
  },
  {
    ability: 'show',
    ask: 'Put what is selected on the screen, the way you would live — click your go-live.',
    maxClicks: MAX_TRAIL,
    required: true,
  },
  {
    ability: 'clear',
    ask: 'The preacher has moved on. Click whatever takes it off the wall — clear, black, or logo.',
    maxClicks: MAX_TRAIL,
    required: false,
  },
  {
    ability: 'next',
    ask: 'A verse runs over two pages. Click what steps forward.',
    maxClicks: MAX_TRAIL,
    required: false,
  },
  {
    ability: 'previous',
    ask: 'And click what steps back.',
    maxClicks: MAX_TRAIL,
    required: false,
  },
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

/** The inspector's `watch`, as the teacher needs it: watch for up to N clicks, get the trail (or nothing, on skip/timeout). */
export type Watcher = (ability: Ability, maxClicks: number) => Promise<WatchRecord[]>

export interface TeachOptions {
  platform: RecipePlatform
  app: { id: string; name: string; version?: string }
  /** Which questions to ask; default all six. */
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

/** The control's own words, for showing the operator what was recorded. */
export function plainName(record: WatchRecord): string {
  const name = [record.title, record.description, record.help].find((v) => typeof v === 'string' && v) as string | undefined
  const role = String(record.role ?? '').replace(/^AX/, '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return name ? `${role || 'control'} "${name}"` : (role || 'control')
}

function labelFor(ability: Ability, record: WatchRecord): string {
  const name = [record.title, record.description, record.help].find((v) => typeof v === 'string' && v) as string | undefined
  const what =
    ability === 'findVerse' ? 'verse search box'
    : ability === 'findSong' ? 'song search box'
    : ability === 'show' ? 'go-live button'
    : `${ability} button`
  return name ? `the ${what} ("${name}")` : `the ${what}`
}

/**
 * A recorded trail, as the steps a recipe keeps. The last click is the
 * target — a type step for the finds, a press for everything else. The
 * clicks before it are the way there: presses, marked `enroute`, replayed
 * only when the target is not already reachable.
 */
export function stepsFromTrail(ability: Ability, records: WatchRecord[]): RecipeStep[] {
  return records.map((record, i): RecipeStep => {
    if (i < records.length - 1) {
      return { ...cuesFromWatch(record, `on the way: ${plainName(record)}`), enroute: true, action: { do: 'press' } }
    }
    const typing = ability === 'findVerse' || ability === 'findSong'
    return typing
      ? { ...cuesFromWatch(record, labelFor(ability, record)), action: { do: 'type', text: '$query', submit: true } }
      : { ...cuesFromWatch(record, labelFor(ability, record)), action: { do: 'press' } }
  })
}

export async function teach(watch: Watcher, opts: TeachOptions): Promise<TeachResult> {
  const abilities: Recipe['abilities'] = {}
  const skipped: Ability[] = []
  for (const q of opts.questions ?? QUESTIONS) {
    opts.say?.(q.ask, q.ability)
    const records = await watch(q.ability, q.maxClicks)
    if (records.length === 0) {
      skipped.push(q.ability)
      if (q.required) return { recipe: null, skipped, problem: `${opts.app.name} needs the "${q.ability}" answer — without it Trilorah cannot put anything on its screen` }
      continue
    }
    abilities[q.ability] = stepsFromTrail(q.ability, records)
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
