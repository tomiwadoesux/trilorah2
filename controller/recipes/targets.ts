import type { ControlHost } from '../../electron/control/dispatcher'
import type { ControlTarget } from '../../shared/control/schema'
import { recipeHost } from './host'
import { verify, type Inspector } from './runner'
import type { LoadedRecipe } from './store'

/**
 * One host that can point at Trilorah's own wall or at any taught app, and
 * switch between them with target.set. Everything the current target does
 * not cover (listening, the screen states) always goes to Trilorah's own
 * host, because that is where the microphone and the mic capture live.
 *
 * Switching to an app runs its verification straight away - every taught
 * control looked up, nothing pressed - and the target list carries the
 * answer, so a console or the CLI can show "EasyWorship ✓" or "EasyWorship:
 * 1 control not found" before anyone leans on it.
 */
export interface SwitchableOptions {
  own: ControlHost
  recipes: () => LoadedRecipe[]
  /** Null when this computer has no inspector for its platform. */
  inspector: Inspector | null
  onProblem?: (target: string, ability: string, problem: string) => void
  /** Called when a verification finishes, so a client can refresh what it shows. */
  onVerified?: (target: string, ok: boolean, broken: string[]) => void
}

export const OWN_TARGET = 'trilorah'

export function switchableHost(opts: SwitchableOptions): ControlHost {
  let currentId = OWN_TARGET
  let current: ControlHost = opts.own
  const verified = new Map<string, boolean>()

  const own = opts.own
  const find = (id: string) => opts.recipes().find((r) => r.id === id || r.recipe.app.name.toLowerCase() === id.toLowerCase())

  return {
    listening: () => own.listening(),
    startListening: (device) => own.startListening(device),
    stopListening: () => own.stopListening(),
    stageScripture: (reference, version) => current.stageScripture(reference, version),
    take: (via) => current.take(via),
    clearLive: () => current.clearLive(),
    next: () => current.next(),
    previous: () => current.previous(),
    setScreen: (state) => own.setScreen(state),
    toggleScreen: (state) => own.toggleScreen(state),
    screen: () => own.screen(),
    preview: () => current.preview(),
    live: () => current.live(),
    openConsole: () => own.openConsole(),

    targets: (): ControlTarget[] => [
      { id: OWN_TARGET, name: 'Trilorah' },
      ...opts.recipes().map((r) => ({ id: r.id, name: r.recipe.app.name, ...(verified.has(r.id) ? { verified: verified.get(r.id)! } : {}) })),
    ],
    target: () => currentId,
    setTarget: (id) => {
      if (id === OWN_TARGET || id.toLowerCase() === 'trilorah') {
        currentId = OWN_TARGET
        current = own
        return null
      }
      const loaded = find(id)
      if (!loaded) return `no taught app called "${id}" — trilorah target lists them`
      if (!opts.inspector) return `this computer has no inspector for ${loaded.recipe.platform} apps`
      const inspector = opts.inspector
      currentId = loaded.id
      current = recipeHost({
        recipe: loaded.recipe,
        inspector,
        own,
        onProblem: (ability, problem) => opts.onProblem?.(loaded.id, ability, problem),
      })
      // Verify straight away, without pressing; the list shows the answer when it lands.
      void verify(loaded.recipe, inspector).then((report) => {
        verified.set(loaded.id, report.ok)
        opts.onVerified?.(loaded.id, report.ok, report.broken.map((b) => `${b.ability}: ${b.label ?? 'step ' + b.index} — ${b.problem}`))
      }).catch(() => { verified.set(loaded.id, false) })
      return null
    },
  }
}
