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
}

export function recipeHost(opts: RecipeHostOptions): ControlHost {
  const { recipe, inspector, own } = opts
  let staged: ControlVerse | null = null
  let live: ControlVerse | null = null
  const asVerse = (reference: string): ControlVerse => ({ book: reference, chapter: 0, verse: 0, version: recipe.app.name, text: '' })

  /** Runs one ability; returns its problem, if any, having told whoever listens. */
  async function run(ability: 'find' | 'show' | 'clear' | 'next' | 'previous', vars: { query?: string } = {}): Promise<string | null> {
    const result = await perform(recipe, ability, inspector, vars)
    if (result.ok) return null
    const problem = result.failed?.problem ?? `${recipe.app.name} did not ${ability}`
    opts.onProblem?.(ability, problem)
    return problem
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
    stageScripture: (reference) => {
      if (!recipe.abilities.find) {
        opts.onProblem?.('find', `${recipe.app.name} was never taught how to search`)
        return null
      }
      staged = asVerse(reference)
      void run('find', { query: reference }).then((problem) => { if (problem) staged = null })
      return staged
    },
    take: () => {
      if (!staged) return null
      const taking = staged
      void run('show').then((problem) => { if (!problem) live = taking })
      return taking
    },
    clearLive: () => { void run('clear').then((problem) => { if (!problem) live = null }) },
    next: () => { void run('next') },
    previous: () => { void run('previous') },
    setScreen: (state) => own.setScreen(state),
    toggleScreen: (state) => own.toggleScreen(state),
    screen: () => own.screen(),
    preview: () => staged,
    live: () => live,
    openConsole: () => own.openConsole(),
  }
}
