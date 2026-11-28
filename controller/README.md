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
  `--action toggle|select|expand|click`. Run as `serve`, it stays up and
  answers requests over stdin, one JSON line each — PowerShell and UI Automation
  take five seconds to load, paid once per session, not per click. A search
  runs inside the app (FindAll with the cues as a condition and a cache
  request for the rest: one round trip instead of one per property per
  element), exact name, help or id first and the old "contains" only when
  nothing is called exactly that; a control found once is remembered and only
  checked, not searched for, the next time. Measured in MediaShout on
  2026-11-27: a first find one to two seconds, a repeat under a tenth; the
  same calls were 20–45 s before. A press or a type waits up to `--patience`
  ms (5 s) for a control that is not there or not enabled yet - an app still
  opening its panel - and only then refuses; a value set in one go gets a
  moment to settle before Enter. Trilorah's side (`recipes/inspect.ts`) keeps
  one request in flight, sends the service's calls ahead of a verification's
  looks, logs any call over four seconds with where its time went, and starts
  the server again if it dies or stops answering.
- The message door (2026-11-27, evening). Windows hands every click and key to a
  window as a message, and a control that is a window of its own can be given
  those messages directly: `press … --action message` posts the click to the
  control, `type … --message` sends it the keys (Home, then key-down and
  character per letter, one key-up). The pointer does not move, the app is not
  brought forward, the operator keeps mouse and keyboard, and the wait that is
  left is the app's own. Every control in EasyWorship (Delphi) is such a
  window, so its whole recipe uses it: a verse is in Preview 0.7–1.6 s after it
  is asked for (EasyWorship's lookup), Go Live in 0.2–0.3 s, next and previous
  in 0.2 s — and the live arrows, which ignored a synthetic pointer entirely,
  answer. Two cues came with it: `within:<class>` (only inside that pane: the
  arrows under Live, not the same pair under Preview) and
  `which:leftmost|rightmost|topmost|bottommost` (of several identical
  controls, the one that sits there). A remembered control must now also be
  visible: a tab switched away keeps its controls alive and hidden, UI
  Automation still calls them on screen, and a verse typed into the hidden
  Songs box went nowhere until the window itself was asked.
  EasyWorship's own Remote protocol (TCP, mDNS `_ezwremote._tcp`, paired and
  unlocked by the operator) was read up on and set aside: it steps through
  what is already live or scheduled but has no command to search the library,
  and it needs setting up in EasyWorship; the message door needs nothing.
  Not every app has windows to post to — WPF, Electron and FireMonkey apps
  draw their controls inside one window (EasyWorship 8 is reported to be
  FireMonkey; untested here) — so UI Automation stays the default and
  `via: 'message'` is a per-step choice in the recipe.
- The floating console and the follow switch (2026-11-28). The pop-up console
  (`trilorah console`, the tray, the main window's "pop out") is now a narrow
  column that stays on top of the presentation app and goes where it is
  dragged, with no title bar; its place is remembered. Top to bottom: what is
  live, the big take, clear and put back, previous and next, a reference box,
  a song box, then the same catches card the main window shows. Two taps of
  the spacebar take the staged catch live; two more while it is live clear it
  (only in that window, never while a text box has focus).
  With the screen pointed at another app, nothing heard is typed into it until
  the operator turns **follow** on (off at every start): with it on, spoken
  references go in as they are heard, quotes, named passages and stories never
  do - a take stages them there first, then shows. The operator's own presses in
  Trilorah's windows (a catch card's live, the phone, "take that down", "next
  verse") reach the app as well. **Put back** (`live.restore`) returns what
  Trilorah's verse replaced: a song or the previous reading on Trilorah's own
  wall; in EasyWorship its Go Back button (the `restore` ability, which verify
  leaves alone because the button exists only after a take).
  `trilorah hear "words"` feeds a sentence in through the same door as the
  microphone's words, so any of this is provable without speaking: the
  rehearsal that evening showed a quote staging John 3:16 and reaching
  EasyWorship on the take, "next verse" stepping EasyWorship's slide, "take
  that down" pressing its Clear.
- A window open over the app (2026-11-28). Edit Song, Options, a file picker:
  a modal window disables the app's main window and every control in it, and
  a press used to wait its patience out and then say "disabled" - true and
  useless. The inspector now names the window at once (`busy`, with its
  title, read through Windows itself: UI Automation does not list an owned
  window among the desktop's children). The recipe host holds the ability,
  tries again every 2 s, and lets it go in when the window closes within 45 s
  (the owner's choice); after that it drops it and says so. Nothing of
  Trilorah's presses anything in that window. The console shows "waiting for
  EasyWorship's Song Editor window" while it holds; the main window gets a
  notice. Proven on EasyWorship's Song Editor.
- Pages of three (2026-11-28). A range shown together on Trilorah's wall is
  paged by words (80) and now also by count: never more than three verses to
  a page, however short (`PAGE_VERSES`, shared/verseDisplay.ts). Psalm
  23:1-6 is two pages; next and previous step them. EasyWorship pages its own
  slides and is left to it.
- `recipes/`: the recipe format, the runner (verify without acting; perform and
  stop at the first failure), the four-question teacher, and the spawn-based
  inspector that picks the right tool per platform. `cli/teach.ts` runs the
  teacher from a terminal: `npx tsx controller/cli/teach.ts <App> --seconds 240`.

macOS asks once, per controlling app, under System Settings › Privacy & Security ›
Accessibility. Until granted, `see` and friends exit 3 and say so.
