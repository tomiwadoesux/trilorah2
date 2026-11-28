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
  /**
   * `at`: which part of the control to click when it must be clicked (no
   * accessibility action). EasyWorship draws its previous/next arrows as the
   * two halves of one panel, so "the left of it" and "the right of it" are
   * two different buttons to a church and one element to Windows.
   * `via: 'click'`: a real click even though the control offers an
   * accessibility action — MediaShout's toolbar says "pressed" to Invoke and
   * opens nothing; only a click opens its Bibles panel.
   * `via: 'message'` (Windows): the click or the keys are handed to the
   * control's own window as messages. The pointer does not move, the app is
   * not brought forward, and the operator keeps the mouse and the keyboard.
   * Every control in a Delphi app (EasyWorship) is a window of its own, so
   * this is how that app is driven - including its previous/next arrows,
   * which ignore a synthetic pointer but answer a posted click in 0.2 s.
   * `patience`: how long (ms) a missing or greyed control is waited for
   * before the press is refused; 5 s unless said. A next arrow that is grey
   * because there is no next slide should say so at once, not after 5 s.
   */
  | { do: 'press'; at?: 'left' | 'right'; via?: 'click' | 'message'; patience?: number }
  | { do: 'type'; text: '$query' | '$reference' | string; submit?: boolean; via?: 'message' }
  | { do: 'menu'; path: string }
  | { do: 'key'; keys: string }
  | { do: 'wait'; ms: number }

/** How to find the control: the saved path first, the other cues to confirm. */
export interface ControlCues {
  path?: string
  role?: string
  name?: string
  id?: string
  /**
   * The window class, Windows only (TsdSpeedButton, Edit). Delphi apps such as
   * EasyWorship name a control by the text it shows and give it a fresh id every
   * launch, so the class is the cue that tells the Songs tab from the SONGS heading.
   */
  class?: string
  /**
   * Windows only: look only inside the pane of this window class. EasyWorship
   * has the same two arrows under Preview and under Live; `within:
   * TFrame_LivePreview` says which pair.
   */
  within?: string
  /** Of several controls that answer to the same cues, the one that sits there (the right-hand arrow). */
  which?: 'leftmost' | 'rightmost' | 'topmost' | 'bottommost'
  /** Shown to the person re-teaching a broken step: "the button that used to say Go Live". */
  label?: string
}

export interface RecipeStep extends ControlCues {
  action: StepAction
  /**
   * A click on the way to the target, not the target itself: the Collections
   * tab the operator opened before reaching the search box. Replay presses
   * these only when the target does not resolve on its own, so an already
   * open panel is not toggled shut.
   */
  enroute?: boolean
}

/**
 * The six questions, as the abilities a recipe can answer. Verses and songs
 * get separate finds because presentation apps usually keep them in separate
 * places (EasyWorship: Scriptures vs Songs) — one taught box must never have
 * the other's words typed into it.
 */
export type Ability = 'findVerse' | 'findSong' | 'show' | 'clear' | 'next' | 'previous' | 'restore'

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
  /**
   * The app's Clear is a switch that stays on: what is sent live while it is on
   * stays hidden (EasyWorship). After Trilorah has cleared, its next show presses
   * Clear once more so the verse is seen.
   */
  clearStaysOn?: boolean
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
    case 'press': return {
      do: 'press',
      ...(a.at === 'left' || a.at === 'right' ? { at: a.at } : {}),
      ...(a.via === 'click' || a.via === 'message' ? { via: a.via } : {}),
      ...(typeof a.patience === 'number' && a.patience >= 0 && a.patience <= 10_000 ? { patience: a.patience } : {}),
    }
    case 'type': return str(a.text, 2000) ? { do: 'type', text: a.text, ...(a.submit === true ? { submit: true } : {}), ...(a.via === 'message' ? { via: 'message' as const } : {}) } : null
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
  if (str(s.class, 120)) step.class = s.class
  if (str(s.within, 120)) step.within = s.within
  if (s.which === 'leftmost' || s.which === 'rightmost' || s.which === 'topmost' || s.which === 'bottommost') step.which = s.which
  if (str(s.label)) step.label = s.label
  if (s.enroute === true) step.enroute = true
  // A press or type needs something to aim at; menu, key and wait do not. A class inside
  // a named pane is aim enough: EasyWorship's arrows have no name, id or steady path.
  const aimed = step.path || step.name || step.id || (step.class && step.within)
  if ((action.do === 'press' || action.do === 'type') && !aimed) return null
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
  // 'find' is the old single search, from before verses and songs were taught
  // apart; an old recipe's one box was taught on "a song or verse", so it
  // serves as both until the church re-teaches.
  for (const key of ['findVerse', 'findSong', 'find', 'show', 'clear', 'next', 'previous', 'restore'] as const) {
    const steps = abilitiesRaw[key]
    if (steps === undefined) continue
    if (!Array.isArray(steps) || steps.length === 0) return null
    const parsed = steps.map(parseStep)
    if (parsed.some((s) => s === null)) return null
    if (key === 'find') {
      abilities.findVerse ??= parsed as RecipeStep[]
      abilities.findSong ??= parsed as RecipeStep[]
    } else {
      abilities[key] = parsed as RecipeStep[]
    }
  }
  if (!abilities.show) return null
  const taught = r.taught as Record<string, unknown> | undefined
  return {
    format: RECIPE_FORMAT,
    platform: r.platform,
    app: { id: app.id, name: app.name, ...(str(app.version, 60) ? { version: app.version } : {}) },
    abilities,
    ...(r.clearStaysOn === true ? { clearStaysOn: true } : {}),
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
  if (str(record.class, 120)) cues.class = record.class
  if (label) cues.label = label
  return cues
}

/** The selector words trilorah-inspect takes, from a step's cues. */
export function selectorWords(cues: ControlCues): string[] {
  const words: string[] = []
  if (cues.path) words.push(`path:${cues.path}`)
  if (cues.role) words.push(`role:${cues.role}`)
  if (cues.id) words.push(`id:${cues.id}`)
  if (cues.class) words.push(`class:${cues.class}`)
  if (cues.within) words.push(`within:${cues.within}`)
  if (cues.which) words.push(`which:${cues.which}`)
  if (cues.name) words.push(`name:${cues.name}`)
  return words
}
