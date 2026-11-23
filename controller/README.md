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
  — six questions (find a verse · find a song · put on screen · take off · step
  forward · step back), each answered by doing the real thing once while Trilorah
  records the whole trail of clicks: the last click is the target, the ones
  before it are the way there, replayed only when the target is not already on
  screen. Verses and songs are asked apart because most apps keep them in
  different places. Never during a service.

A recipe is matched on several cues (name, role, place in the tree, shortcut) so
one renamed button does not kill it, verified before every service without
pressing anything, and re-taught one step at a time when an update moves things.

## What is here

- `propresenter/`: door 1 for ProPresenter 7+, over its HTTP API (Preferences ›
  Network › Enable Network). `discover.ts` lists the ports this computer has
  open and `target.ts` knocks on each with GET /version (ProPresenter picks its
  own port; a church can pin one in settings), `client.ts` is the slice of the
  API we use, `host.ts` answers the five abilities — a verse goes up as a
  ProPresenter *Message* carrying the reference and the text Trilorah resolved
  (its API has no Bible search; the message is created once on the Scripture
  theme), a song is looked up by title in the Default library and triggered
  from its first slide, clear takes the message and slide layers, next/previous
  are its own triggers — and `target.ts` lists it under **screen** whenever the
  API answers. Checked against ProPresenter 22.0.1 on Windows, 2026-11-23.
- `openlp/`: door 1 for OpenLP 3, over its Remote API (port 4316 unless the
  church changed it; a login there must be off). Its own Bible and song
  searches find the item, `songs/live` and `bibles/live` show it,
  `controller/progress` steps, `core/display` blanks. Checked against OpenLP
  3.1.7 on Windows, 2026-11-23.
- `macos/inspect.swift` → `bin/trilorah-inspect` (built by `scripts/build-inspect.sh`):
  the operating layer on macOS. `check`, `apps`, `see`, `find`, `press`, `type`,
  `menu`, `focus`. JSON out; `--pretty` for people. A press refuses to guess:
  an ambiguous selector is an error, not a coin toss.
- `windows/trilorah-inspect.ps1`: the Windows twin, same commands and JSON over
  UI Automation. A PowerShell script on purpose — UI Automation and PowerShell
  5.1 ship inside every Windows 10/11, so a church installs nothing. Met real
  Windows apps on 2026-11-23 and learned from them: it is DPI-aware (a scaled
  screen halved every click before), presses bring the app forward and click
  like a hand (move, down, a beat, up), typing clicks the box first and types
  one character at a time (EasyWorship's reference box parses as it goes), and
  two selector words were added — `class:` (the window class, the steady cue in
  Delphi apps whose names are the text they show) and `--at left|right` /
  `--action toggle|select|expand|click`. Each call starts a PowerShell, so a
  call costs seconds, not milliseconds.
- `recipes/`: the recipe format, the runner (verify without acting; perform and
  stop at the first failure), the four-question teacher, and the spawn-based
  inspector that picks the right tool per platform. `cli/teach.ts` runs the
  teacher from a terminal: `npx tsx controller/cli/teach.ts <App> --seconds 240`.

macOS asks once, per controlling app, under System Settings › Privacy & Security ›
Accessibility. Until granted, `see` and friends exit 3 and say so.
