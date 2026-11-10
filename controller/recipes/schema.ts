/**
 * A recipe: how Trilorah operates one foreign app.
 *
 * Learned once — written by us for the common apps, or taught by the operator
 * at sound check ("show me how you put something on the screen") — and then
 * replayed, dumbly and deterministically, on Sunday. No model is ever asked
 * anything while a recipe runs.
 *
 * Each step names a control by SEVERAL cues, recorded from the real element
 * the operator clicked (controller/macos/inspect.swift `watch`): its saved
 * path, role, name, identifier. The path is the fast way there (tens of
 * milliseconds); the other cues must still agree, so an app update that
 * renames or moves a control makes the step REFUSE rather than press the
 * wrong thing. `verify` runs every step's lookup without acting, before a
 * service, and names the steps that no longer resolve — those get re-taught,
 * one step at a time.
 *
 * The four abilities mirror the control commands (shared/control/schema.ts)
 * that every other client already speaks: a recipe is just another host.
 */

export const RECIPE_FORMAT = 1

/** The platform plumbing a recipe was recorded against. */
export type RecipePlatform = 'macos' | 'windows'

/** What a step does to its control. */
export type StepAction =
  | { do: 'press' }
  | { do: 'type'; text: '$query' | '$reference' | string; submit?: boolean }
  | { do: 'menu'; path: string }
  | { do: 'key'; keys: string }
  | { do: 'wait'; ms: number }

/** How to find the control: the saved path first, the other cues to confirm. */
export interface ControlCues {
  path?: string
  role?: string
  name?: string
  id?: string
  /** Shown to the person re-teaching a broken step: "the button that used to say Go Live". */
  label?: string
}

export interface RecipeStep extends ControlCues {
  action: StepAction
}

/** The four questions, as the abilities a recipe can answer. */
export type Ability = 'find' | 'show' | 'clear' | 'next' | 'previous'

export interface Recipe {
  format: typeof RECIPE_FORMAT
  platform: RecipePlatform
  app: {
    /** Bundle id on macOS, executable name on Windows. */
    id: string
    name: string
    /** The version the recipe was recorded against, when known. */
    version?: string
  }
  abilities: Partial<Record<Ability, RecipeStep[]>>
  taught: {
    by: 'trilorah' | 'operator'
    at: string
  }
}

const str = (v: unknown, max = 400): v is string => typeof v === 'string' && v.length > 0 && v.length <= max

function parseAction(raw: unknown): StepAction | null {
  if (!raw || typeof raw !== 'object') return null
  const a = raw as Record<string, unknown>
  switch (a.do) {
    case 'press': return { do: 'press' }
    case 'type': return str(a.text, 2000) ? { do: 'type', text: a.text, ...(a.submit === true ? { submit: true } : {}) } : null
    case 'menu': return str(a.path) ? { do: 'menu', path: a.path } : null
    case 'key': return str(a.keys, 40) ? { do: 'key', keys: a.keys } : null
    case 'wait': return typeof a.ms === 'number' && a.ms >= 0 && a.ms <= 10_000 ? { do: 'wait', ms: a.ms } : null
    default: return null
  }
}

function parseStep(raw: unknown): RecipeStep | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  const action = parseAction(s.action)
  if (!action) return null
  const step: RecipeStep = { action }
  if (str(s.path, 200)) step.path = s.path
  if (str(s.role, 60)) step.role = s.role
  if (str(s.name)) step.name = s.name
  if (str(s.id)) step.id = s.id
  if (str(s.label)) step.label = s.label
  // A press or type needs something to aim at; menu, key and wait do not.
  if ((action.do === 'press' || action.do === 'type') && !step.path && !step.name && !step.id) return null
  return step
}

/** A recipe off disk or off the wire is data until it has been looked at. */
export function parseRecipe(raw: unknown): Recipe | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.format !== RECIPE_FORMAT) return null
  if (r.platform !== 'macos' && r.platform !== 'windows') return null
  const app = r.app as Record<string, unknown> | undefined
  if (!app || !str(app.id) || !str(app.name)) return null
  const abilitiesRaw = r.abilities as Record<string, unknown> | undefined
  if (!abilitiesRaw || typeof abilitiesRaw !== 'object') return null
  const abilities: Recipe['abilities'] = {}
  for (const key of ['find', 'show', 'clear', 'next', 'previous'] as const) {
    const steps = abilitiesRaw[key]
    if (steps === undefined) continue
    if (!Array.isArray(steps) || steps.length === 0) return null
    const parsed = steps.map(parseStep)
    if (parsed.some((s) => s === null)) return null
    abilities[key] = parsed as RecipeStep[]
  }
  if (!abilities.show) return null
  const taught = r.taught as Record<string, unknown> | undefined
  return {
    format: RECIPE_FORMAT,
    platform: r.platform,
    app: { id: app.id, name: app.name, ...(str(app.version, 60) ? { version: app.version } : {}) },
    abilities,
    taught: {
      by: taught?.by === 'operator' ? 'operator' : 'trilorah',
      at: str(taught?.at, 40) ? (taught!.at as string) : new Date(0).toISOString(),
    },
  }
}

/** The `watch` record of one click, turned into the cues a step keeps. */
export function cuesFromWatch(record: Record<string, unknown>, label?: string): ControlCues {
  const cues: ControlCues = {}
  if (str(record.path, 200) && record.path !== '?') cues.path = record.path
  if (str(record.role, 60)) cues.role = record.role
  const name = [record.title, record.description, record.help].find((v) => str(v))
  if (name) cues.name = name as string
  if (str(record.id)) cues.id = record.id
  if (label) cues.label = label
  return cues
}

/** The selector words trilorah-inspect takes, from a step's cues. */
export function selectorWords(cues: ControlCues): string[] {
  const words: string[] = []
  if (cues.path) words.push(`path:${cues.path}`)
  if (cues.role) words.push(`role:${cues.role}`)
  if (cues.id) words.push(`id:${cues.id}`)
  if (cues.name) words.push(`name:${cues.name}`)
  return words
}
