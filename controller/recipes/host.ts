import type { ControlHost } from '../../electron/control/dispatcher'
import type { ControlVerse } from '../../shared/control/schema'
import { perform, type Inspector } from './runner'
import type { Recipe } from './schema'

/**
 * A recipe as a ControlHost: the bridge that lets the same commands the CLI,
 * the console and the remotes already send - stage, take, clear, next,
 * previous - land in someone else's presentation software instead of
 * Trilorah's own wall.
 *
 * Only the five abilities are forwarded. Listening and the mic stay
 * Trilorah's: the brain still hears the sermon; the recipe only moves the
 * other app's screen. And the owner's rule survives the border untouched:
 * nothing here runs by itself - a detection stages in Trilorah and waits, and
 * only a press (CLI, console, remote) sends `live.take` here.
 *
 * Honesty: the foreign app never tells us what text it put up, so a result
 * carries the reference as asked, marked with the app's name as its version.
 * A failed step fails the command with the step's words ("the go-live button
 * is disabled right now"), never a quiet success.
 */
export interface RecipeHostOptions {
  recipe: Recipe
  inspector: Inspector
  /** Trilorah's own host: everything a recipe does not cover (listening, screen) goes here. */
  own: ControlHost
  /** What happens when a step fails, for a notice; the command still fails. */
  onProblem?: (ability: string, problem: string) => void
  /** What an ability took when it worked, for a log line: the time the room feels. */
  onDid?: (ability: string, ms: number) => void
  /**
   * The reference in Trilorah's own words - "Psalms 23:1" for a typed "Psalm 23:1",
   * "John 3:16-17" for a range - or null when Trilorah's Bible has no such passage. The
   * app's search box gets the canonical words: MediaShout's offers "Psalms" as a
   * completion for "Psalm" and spends the Enter on accepting it, searching nothing.
   */
  words?: (reference: string, version?: string) => string | null
  /** True while an ability is being performed in the app, false when the line is empty again: verification yields to it. */
  onBusy?: (busy: boolean) => void
}

export function recipeHost(opts: RecipeHostOptions): ControlHost {
  const { recipe, inspector, own } = opts
  let staged: ControlVerse | null = null
  let live: ControlVerse | null = null
  const asVerse = (reference: string): ControlVerse => ({ book: reference, chapter: 0, verse: 0, version: recipe.app.name, text: '' })

  // One ability at a time. The inspector is a process per step, so two
  // abilities started together would take turns step by step - the take's
  // "go live" landing between a search's typing and its Enter. Everything the
  // host is asked to do joins one line and runs in the order it was asked.
  let line: Promise<unknown> = Promise.resolve()
  let queued = 0
  const after = <T>(work: () => Promise<T>): Promise<T> => {
    if (queued++ === 0) opts.onBusy?.(true)
    const done = async () => { try { return await work() } finally { if (--queued === 0) opts.onBusy?.(false) } }
    const next = line.then(done, done)
    line = next.catch(() => undefined)
    return next
  }

  /** Runs one ability; returns its problem, if any, having told whoever listens. */
  async function run(ability: 'findVerse' | 'findSong' | 'show' | 'clear' | 'next' | 'previous', vars: { query?: string } = {}): Promise<string | null> {
    const started = Date.now()
    const result = await perform(recipe, ability, inspector, vars)
    if (result.ok) { opts.onDid?.(ability, Date.now() - started); return null }
    const problem = result.failed?.problem ?? `${recipe.app.name} did not ${ability}`
    opts.onProblem?.(ability, problem)
    return problem
  }

  // A search is slow in a clicked app (a panel, typing, Enter), and the
  // preacher moves on: when a newer reference is staged before an older one's
  // search has started, the older search is skipped - only what is staged
  // now is worth typing. A search already under way finishes.
  let searchFor: ControlVerse | null = null
  const search = (ability: 'findVerse' | 'findSong', what: ControlVerse) => {
    searchFor = what
    void after(async () => {
      if (searchFor !== what) return
      const problem = await run(ability, { query: what.book })
      if (problem && staged === what) staged = null
    })
  }

  // ControlHost is synchronous; the inspector is a process. The dispatcher's
  // contract is "what actually happened", so the async work is kicked off and
  // the synchronous answer is what we asked for, with the failure surfacing
  // through onProblem (a notice) and the next snapshot. Step 3 of the plan
  // makes the host async; until then this is the honest shape available.
  return {
    listening: () => own.listening(),
    startListening: (device) => own.startListening(device),
    stopListening: () => own.stopListening(),
    stageScripture: (reference, version) => {
      if (!recipe.abilities.findVerse) {
        opts.onProblem?.('findVerse', `${recipe.app.name} was never taught where verses are searched — re-teach it`)
        return null
      }
      staged = asVerse(opts.words?.(reference, version) ?? reference)
      search('findVerse', staged)
      return staged
    },
    take: () => {
      if (!staged) return null
      const taking = staged
      void after(async () => {
        // Its search failed meanwhile: nothing of ours is selected to show.
        if (staged === null) return
        const problem = await run('show')
        if (!problem) live = taking
      })
      return taking
    },
    stageSong: (title) => {
      // Never the verse box as a stand-in: a song title typed into a scripture
      // search is the kind of wrong-screen moment teaching exists to prevent.
      if (!recipe.abilities.findSong) return { error: `${recipe.app.name} was never taught where songs are searched — re-teach it and answer the song question` }
      staged = asVerse(title)
      search('findSong', staged)
      return { staged }
    },
    clearLive: () => { void after(async () => { if (!(await run('clear'))) live = null }) },
    next: () => { void after(() => run('next')) },
    previous: () => { void after(() => run('previous')) },
    setScreen: (state) => own.setScreen(state),
    toggleScreen: (state) => own.toggleScreen(state),
    screen: () => own.screen(),
    preview: () => staged,
    live: () => live,
    openConsole: () => own.openConsole(),
  }
}
