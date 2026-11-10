# controller — Trilorah driving other apps

The second half of the app-control plan (docs/engineering/TRILORAH-APP-CONTROL-PLAN.md):
the brain that already commands Trilorah's own wall learning to operate a
church's *existing* presentation software — EasyWorship first.

## The door we chose, and why

Three ways an AI on a laptop can control another app:

1. **The app volunteers its functions** (MCP, an HTTP API). Best when it exists —
   ProPresenter, OBS and vMix have one. EasyWorship, MediaShout, OpenLP do not and
   never will for us.
2. **The accessibility tree.** The operating system describes every running app's
   interface — windows, buttons, menus, fields — with names, states and the
   actions each accepts (it exists so screen readers work). A program can ask
   "what buttons does this app have?" and press one *by name*: milliseconds, no
   model call, no internet, no pixels, nothing asked of the app. **This is the
   universal engine.**
3. **Screenshots and clicks** (an AI looking and acting like a person). Works on
   anything, slow and fragile, a model call per step. Emergency fallback only.

Door 1 where it exists, door 2 everywhere, door 3 as a parachute.

## Two layers, kept apart

- **Operating** (Sunday, live) is dumb and deterministic: *press the element called
  X, type into field Y.* No AI, ever, in that loop.
- **Learning** (which element means "go live" in *this* app) happens once per app,
  at sound check: recipes we ship for the common apps, or the operator shows it
  — four questions (find · put on screen · take off · step), each answered by doing
  it once while Trilorah records *which element* was used. Never during a service.

A recipe is matched on several cues (name, role, place in the tree, shortcut) so
one renamed button does not kill it, verified before every service without
pressing anything, and re-taught one step at a time when an update moves things.

## What is here

- `macos/inspect.swift` → `bin/trilorah-inspect` (built by `scripts/build-inspect.sh`):
  the operating layer on macOS. `check`, `apps`, `see`, `find`, `press`, `type`,
  `menu`, `focus`. JSON out; `--pretty` for people. A press refuses to guess:
  an ambiguous selector is an error, not a coin toss.
- `windows/trilorah-inspect.ps1`: the Windows twin, same commands and JSON over
  UI Automation. A PowerShell script on purpose — UI Automation and PowerShell
  5.1 ship inside every Windows 10/11, so a church installs nothing. Untested
  until it meets a real Windows machine (EasyWorship is Windows-only; that
  session happens at the owner's Windows laptop).
- `recipes/`: the recipe format, the runner (verify without acting; perform and
  stop at the first failure), the four-question teacher, and the spawn-based
  inspector that picks the right tool per platform. `cli/teach.ts` runs the
  teacher from a terminal: `npx tsx controller/cli/teach.ts <App> --seconds 240`.

macOS asks once, per controlling app, under System Settings › Privacy & Security ›
Accessibility. Until granted, `see` and friends exit 3 and say so.
