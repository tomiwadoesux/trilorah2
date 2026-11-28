import { selectorWords, type Ability, type Recipe, type RecipeStep } from './schema'

/**
 * Runs recipes through the platform inspector (controller/macos/inspect.swift,
 * later its Windows twin). Two jobs:
 *
 * verify — before a service, look every step's control up WITHOUT acting and
 *   name the steps that no longer resolve to exactly one control. Those are
 *   the ones to re-teach; everything else is green.
 * perform — on Sunday, do one ability's steps in order. The first step that
 *   fails stops the rest: half a sequence in someone else's software is worse
 *   than none, and the result says exactly which step and why.
 *
 * The inspector is injected, so this unit-tests without a desktop.
 */

export interface InspectResult {
  ok: boolean
  error?: string
  count?: number
  [key: string]: unknown
}

export interface Inspector {
  /**
   * One call to the platform tool. `background` marks a look that can wait - a
   * verification's finds - so that a press or a type for the service goes ahead
   * of it when the tool answers one request at a time.
   */
  run(args: string[], opts?: { background?: boolean }): Promise<InspectResult>
}

export interface StepOutcome {
  ability: Ability
  index: number
  ok: boolean
  /** The operator's words for the control, when the recipe has them. */
  label?: string
  problem?: string
  /** The app has a window open over itself (a dialog the operator is in); the step was not tried. */
  busy?: boolean
  /** That window's title, when the inspector could read it. */
  window?: string
}

export interface VerifyReport {
  ok: boolean
  checked: number
  broken: StepOutcome[]
}

export interface PerformResult {
  ok: boolean
  ability: Ability
  done: number
  failed?: StepOutcome
}

/** What a type step types: the operator's words stand in for the moment's values. */
export function fillText(text: string, vars: { query?: string; reference?: string }): string {
  return text.replace(/\$query/g, vars.query ?? '').replace(/\$reference/g, vars.reference ?? '')
}

function aims(step: RecipeStep): boolean {
  return step.action.do === 'press' || step.action.do === 'type'
}

async function lookUp(step: RecipeStep, recipe: Recipe, inspect: Inspector, background = false): Promise<string | null> {
  if (aims(step)) {
    const r = await inspect.run(['find', recipe.app.id, ...selectorWords(step)], { background })
    if (!r.ok) return r.error ?? 'the inspector could not look'
    if (r.count === 0) return 'no control matches any more'
    if ((r.count ?? 0) > 1) return `${r.count} controls match — the recipe needs more cues`
    return null
  }
  if (step.action.do === 'menu') {
    const last = step.action.path.split('>').pop()?.trim() ?? ''
    const r = await inspect.run(['find', recipe.app.id, 'role:AXMenuItem', `name:${last}`], { background })
    if (!r.ok) return r.error ?? 'the inspector could not look'
    if (r.count === 0) return `no menu item called "${last}" any more`
    return null
  }
  return null
}

/**
 * Verification with a trail is two honest looks, not one: the target may
 * legitimately be hidden behind the panel the enroute clicks open, so the
 * ability is sound when EITHER the target resolves now OR the first enroute
 * step does (the door to it is still there). Only when both are gone is it
 * broken. Enroute steps past the first cannot be checked without pressing,
 * which verify never does.
 */
export async function verify(recipe: Recipe, inspect: Inspector): Promise<VerifyReport> {
  const broken: StepOutcome[] = []
  let checked = 0
  for (const [ability, steps] of Object.entries(recipe.abilities) as [Ability, RecipeStep[]][]) {
    // A put-back control exists only after a take (EasyWorship's Go Back appears once
    // something went live from its library): nothing to look for at sound check.
    if (ability === 'restore') continue
    const enroute = steps.filter((s) => s.enroute)
    if (enroute.length === 0) {
      for (const [index, step] of steps.entries()) {
        checked++
        const problem = await lookUp(step, recipe, inspect, true)
        if (problem) broken.push({ ability, index, ok: false, label: step.label, problem })
      }
      continue
    }
    const target = steps[steps.length - 1]
    checked++
    const targetProblem = await lookUp(target, recipe, inspect, true)
    if (!targetProblem) continue
    checked++
    const doorProblem = await lookUp(enroute[0], recipe, inspect, true)
    if (doorProblem) {
      broken.push({ ability, index: steps.length - 1, ok: false, label: target.label, problem: `${targetProblem}; and the way there is gone too (${enroute[0].label ?? 'its first click'}: ${doorProblem})` })
    }
  }
  return { ok: broken.length === 0, checked, broken }
}

type Refusal = { problem: string; busy?: boolean; window?: string }

/** A failed inspector answer as a refusal: the words, and whether a dialog is what stopped it. */
function refused(r: { ok: boolean; error?: string; busy?: unknown; window?: unknown }, fallback: string): Refusal {
  return {
    problem: r.error ?? fallback,
    ...(r.busy === true ? { busy: true, ...(typeof r.window === 'string' ? { window: r.window } : {}) } : {}),
  }
}

async function act(step: RecipeStep, recipe: Recipe, inspect: Inspector, vars: { query?: string; reference?: string }): Promise<Refusal | null> {
  const app = recipe.app.id
  switch (step.action.do) {
    case 'press': {
      const args = ['press', app, ...selectorWords(step)]
      if (step.action.at) args.push('--at', step.action.at)
      if (step.action.via) args.push('--action', step.action.via)
      if (step.action.patience !== undefined) args.push('--patience', String(step.action.patience))
      const r = await inspect.run(args)
      return r.ok ? null : refused(r, 'the press failed')
    }
    case 'type': {
      const args = ['type', app, ...selectorWords(step), '--text', fillText(step.action.text, vars)]
      if (step.action.submit) args.push('--submit')
      if (step.action.via === 'message') args.push('--message')
      const r = await inspect.run(args)
      return r.ok ? null : refused(r, 'typing failed')
    }
    case 'menu': {
      const r = await inspect.run(['menu', app, step.action.path])
      return r.ok ? null : refused(r, 'the menu press failed')
    }
    case 'key': {
      const r = await inspect.run(['key', app, step.action.keys])
      return r.ok ? null : refused(r, 'the key press failed')
    }
    case 'wait': {
      const ms = step.action.ms
      await new Promise((resolve) => setTimeout(resolve, ms))
      return null
    }
  }
}

export async function perform(
  recipe: Recipe,
  ability: Ability,
  inspect: Inspector,
  vars: { query?: string; reference?: string } = {}
): Promise<PerformResult> {
  const steps = recipe.abilities[ability]
  if (!steps) return { ok: false, ability, done: 0, failed: { ability, index: -1, ok: false, problem: `${recipe.app.name} was never taught how to ${ability}` } }
  // A trail's enroute clicks exist to reach the target. When the target is
  // already reachable, pressing them again would toggle panels for nothing
  // (or shut); so look first, and walk the trail only when the look fails.
  let run = steps
  if (steps.some((s) => s.enroute)) {
    const target = steps[steps.length - 1]
    const reachable = await lookUp(target, recipe, inspect)
    if (reachable === null) run = steps.filter((s) => !s.enroute)
  }
  for (const step of run) {
    const index = steps.indexOf(step)
    const refusal = await act(step, recipe, inspect, vars)
    if (refusal) return { ok: false, ability, done: run.indexOf(step), failed: { ability, index, ok: false, label: step.label, ...refusal } }
  }
  return { ok: true, ability, done: run.length }
}
