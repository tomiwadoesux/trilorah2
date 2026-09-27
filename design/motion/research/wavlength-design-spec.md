# Wavlength design system

This is the working spec for Wavlength's UI: tokens, motion, components and the rules every screen follows. The code lives in `lib/ui/core/design/`, and the one import you need is `design/design.dart`. It is a first pass. It borrows the Family wallet's feel, the token and icon discipline of Spotify's Encore, and the animation craft rules from Emil Kowalski's and Apple's guidance. It is meant to be revised, and later turned into a skill.

## 1. Principles

1. **Simplicity: reveal things when they matter.** The fundamentals stay at your fingertips; everything else appears when it becomes relevant, in a tray over the screen you're on. There is one job per tray and one primary action per screen.
2. **Fluidity: nothing teleports.** When something changes, the eye should see where it came from and where it went. Labels morph, persistent things travel instead of being duplicated, pages move in the direction of travel, and trays grow out of the button that opened them.
3. **Delight: selective emphasis.** The rarer the moment, the more it can celebrate (the first song of the night, the chorus landing, the recap reveal). Things done every few seconds stay quiet (lyric lines advancing, tab taps).
4. **Every motion has a job:** orientation (where did this come from), feedback (you did something), or a marked moment. If it has no job, it doesn't animate.
5. **Semantic, never raw.** Screens use tokens by role (`context.wav.textSubdued`, `WavSpace.l`, `WavMotion.base`). A hex value, a raw duration or `Colors.white` in a screen is a bug.

## 2. Foundation (`tokens.dart`)

### Color: `context.wav.<role>`
The palette is generated from two inputs, a page colour and an accent, by `WavColors.generate`. Text tiers are nudged until they clear their contrast floor. The app ships `WavColors.dark`: page `#0A0A0C`, accent a warm flare `#FF6A3D`. This is deliberately not a streaming service's green.

| Role | Use | Contrast floor on page |
|---|---|---|
| `bgBase` | the page | – |
| `bgElevated` | cards and rows on the page | – |
| `bgElevatedHigher` | trays, sheets, the mini-player | – |
| `bgHighlight` | pressed rows, secondary buttons, skeleton base | – |
| `bgHighlightStrong` | skeleton sweep band | – |
| `bgScrim` | dims the page behind a tray (black 62%, no blur) | – |
| `line` / `lineStrong` | hairlines, outlines | decorative |
| `textBase` | primary text and icons | 12:1 |
| `textSubdued` | artist, metadata, upcoming lyric lines | 7:1 |
| `textMuted` | tertiary: timestamps, past lyric lines, hints (never the only carrier of meaning) | 4.5:1 |
| `essential` | THE accent: the primary button, the live lyric highlight, the chorus, live indicators | 4.5:1 |
| `onEssential` | text/icons on `essential` | 4.5:1 on accent |
| `essentialSubdued` | quiet accent wash (chips, selected rows) | – |
| `positive` / `negative` / `warning` | status | 4.5:1 |

- **Text over artwork or video** sits on a black 54% scrim, which keeps it readable over any image.
- **One accent.** If everything is orange, nothing is. Accent marks what's live, what's primary and what's the chorus.

### Space: `WavSpace`
A 4pt scale: `xxs 2 · xs 4 · s 8 · m 12 · l 16 · xl 20 · xxl 24 · x3 32 · x4 40 · x5 48`. The page gutter is 20.

### Radius: `WavRadius`
`xs 6 · s 10 · m 14 · l 20 · xl 28 · tray 36 · pill`. Cards and trays use iOS continuous corners: `WavRadius.shape(r)` (a `RoundedSuperellipseBorder`), and `ClipRSuperellipse` for clipping.

### Type: `WavType`
Uses the system font (SF Pro) with Apple tracking: tighter as text grows, looser as it shrinks.

| Style | Size / weight | Use |
|---|---|---|
| `display` | 34 / 700 | the rare hero (recap title) |
| `title` | 24 / 700 | page titles, the now-playing song title |
| `headline` | 17 / 600 | card and tray titles |
| `body` / `bodyStrong` | 15 / 400 / 600 | body text; the strong weight for row titles |
| `callout` | 13 / 500 | secondary lines |
| `caption` | 12 / 500 | metadata |
| `overline` | 11 / 700, +1.2 tracking, UPPERCASE | "CHORUS IN 12s", section labels |
| `lyricNow` | 30 / 800 | the line being sung |
| `lyricNear` | 22 / 700 | lines around it |
| `tabular` | font feature | any ticking number |

### Icons
- Use `CupertinoIcons`, never `Icons.*` in redesigned screens.
- Two sizes: `WavIconSize.small` (16) and `regular` (24). Hero icons are the 24 drawing scaled up.
- **The active state fills in** (`mic` → `mic_fill`); it doesn't just get bolder. Inactive icons are `textMuted`/`textSubdued`, active ones `textBase` or `essential`.

## 3. Motion (`motion.dart`)

The full rulebook, with its sources and Flutter translations, is in `research/motion-rulebook.md`. The Family clip-by-clip notes are in `research/family-interactions.md`.

**The gate (every animation passes all four, in order):**
1. **Frequency.** 100+ a night gets no animation. Tens gets near-imperceptible motion. Occasional gets standard motion. Rare can celebrate.
2. **Purpose.** Feedback, orientation, state, preventing a jarring jump, or a rare delight. "It looks cool" is not a purpose.
3. **Speed.** UI stays ≤ 300 ms.
4. **Function.** Text the user is reading (lyrics, log rows, recap numbers once landed) doesn't move for style.

| Token | Value | For |
|---|---|---|
| `WavMotion.press` / `release` | 100 / 160 ms | press in and out (asymmetric on purpose) |
| `micro` | 120 ms | tiny flips; a lyric line's ink change |
| `fast` | 180 ms | small things, exits, tab flash |
| `base` | 240 ms | component swaps, skeleton → content, banner in |
| `slow` | 300 ms | the ceiling for UI; label morphs |
| `moment` | 450 ms | rare celebrations only |
| `digitRoll` | 200 ms | odometer digits |
| `skeletonGrace` / `skeletonMinShow` | 200 / 400 ms | a skeleton never flashes and never flickers |
| `stagger` | 40 ms, max 6 items | rows entering; never blocks input |
| `easeOut` | `Cubic(0.23, 1, 0.32, 1)` | enter, exit, default |
| `easeOutReverse` | its flipped curve | **every** `reverseCurve` and `AnimatedSwitcher.switchOutCurve`, or the exit plays as an ease-in |
| `easeOutSoft` | `Cubic(0.215, 0.61, 0.355, 1)` | text and opacity |
| `easeInOut` | `Cubic(0.77, 0, 0.175, 1)` | something on screen moving somewhere; shared elements |
| `easeColor` | `Cubic(0.25, 0.1, 0.25, 1)` | colour and tint changes |
| `WavSprings.tray` | 320 ms, bounce 0 | a tray opened by a tap |
| `WavSprings.trayFling` | 300 ms, bounce 0.2 | a tray settling after a drag release |
| `WavSprings.follow` | 300 ms, bounce 0 | lyric scroll re-centring (retarget with velocity) |
| `WavSprings.move` / `ui` | 400 / 350 ms, bounce 0 | repositioning, default |
| `WavSprings.lively` | 500 ms, bounce 0.2 | the first match of the night, nothing else |
| `WavCurves.*` | springs as curves, built once | give implicit widgets `WavCurves.x.settle` as their duration |

**Rules**
- **Never use ease-in on UI.** Flutter's `Curves.easeOut`/`easeInOut` are too weak, so use the tokens.
- **No overshoot** except `trayFling` (the finger gave momentum) and `lively` (rare delight).
- Nothing appears from nothing: `enterScale` 0.96 plus fade. A bare fade entrance is a finding.
- **Exits are ~20% quicker than entrances.** Close a tray as fast as it opened.
- Crossfades hide the double image with `WavMotion.blur` (σ 2). Glass materializes with σ 8 plus scale.
- **Interruptible:** implicit widgets, or `controller.springTo(target, spring)` (keeps velocity). No `forward(from: 0)` on toggles, and no locking input during a transition.
- **GPU only:** transform, opacity, blur. `AnimatedSize` only on small leaves.
- **Reduce Motion is gentler, not zero:** `WavMotion.of` (movement → 0), `WavMotion.fadeOf` (fades kept, ≤ 200 ms) and `WavMotion.sizeOf` for `AnimatedSize` (a 1 ms snap — a zero-duration `AnimatedSize` throws inside its own layout).
- **Haptics (`WavHaptics`)** fire on the causal event, on the same frame as the visual: first match → success, song switch → light, snap home → medium, detents → selection. Never per lyric line, countdown tick or tab.
- **Lyrics:**
  - The current line changes ink colour only (`micro`, `easeColor`). Never animate font size or weight.
  - For a bigger current line, reserve the big box and scale the neighbours with `Transform.scale`.
  - The scroll re-centres with the `follow` spring, carrying velocity.

| Moment in Wavlength | How often | Motion |
|---|---|---|
| lyric line advances | every 2–5 s | ink colour 120 ms; the scroll follows a critically damped spring; no haptic |
| tab switch | constantly | a flash of direction: in from 8pt, out 16pt, 180 ms; the icon fill swaps instantly |
| song switch (party) | every ~3 min | the card never unmounts: title and artist crossfade (up 8pt, blur), art crossfades from 0.96, lyrics dim to 0.4 over 240 ms then go skeleton → lines; light haptic |
| chorus countdown | per song | chip rises in (240 ms, from 0.96, left-anchored); digits roll down; at 0 it morphs to "CHORUS" |
| first song of the night | once | skeleton → card; art materializes (0.96, blur 8 → 0); lines stagger 40 ms; success haptic |
| trays | occasional | rise on `tray`, height morphs between steps, content crossfades in place |
| moment banner | occasional | in from the top (240 ms), out through the top (180 ms); swipe up to dismiss |

## 4. Components (`lib/ui/core/design/`)

| Component | What it is | Rules |
|---|---|---|
| `Pressable` | a tap target that shrinks to 0.97 on press | for deliberate taps; `haptic: true` only for moments that matter (mic, start party); `selected:` for chips and segments |
| `WavButton` | pill button: `primary` / `secondary` / `tertiary` / `destructive`, sizes `large` 52 / `medium` 40 / `small` 32 | **one primary per screen**; the label morphs on change; `busy` puts a spinner in the icon slot without moving the label; `destructive` (negative fill) only as the confirm inside a tray |
| `WavIconButton` | the round 32 pt icon button with a 44 pt hit area; `filled` for an active state | header actions, "…" menus, tray close/back |
| `MorphText` | single-line text that morphs: shared letters glide, others blur out and in; unrelated strings get a soft vertical crossfade | use for any label, title or status that changes in place |
| `RollingNumber` | odometer digits (tabular) | countdowns, counts. `down: true` for countdowns |
| `Skeleton`, `SkeletonText`, `Skeleton.circle` | placeholders with a single screen-wide shimmer (from `ShimmerScope` in the shell); `still: true` for empty-state ghosts | match the real layout exactly; the shimmer clock only ticks while a skeleton is on screen |
| `Loadable(loading:, skeleton:, child:)` | skeleton → content crossfade with blur, size glides | the standard way to show async data |
| `WavArtwork` | album art with a skeleton while loading, fade-in, and a glyph fallback | always use this for remote images |
| `showWavTray` / `TrayPage` / `Tray.of(ctx).push` | Family trays: floating, inset 8, radius 36, rise on the `tray` spring, height morph between steps with the content crossfading in place, ✕ ↔ ‹, scrim 62% (no blur), drag down or tap outside to dismiss | transient choices, confirmations, explainers, short flows. One job per tray |
| `WavPageHeader` | tab title, optional morphing subtitle, actions, avatar (opens Settings) | the top of every tab |
| `WavMotion`, `WavSprings`, `WavCurves`, `WavGesture`, `WavHaptics` | motion, gesture and haptic tokens | never hand-type a curve, duration or haptic |
| `AvatarButton` / `openSettings` | Settings lives behind the avatar | – |

## 5. Loading (placeholders)

- **Skeleton when the layout is known and the data is late:** a track card, lyric lines, list rows, a person, a recap paragraph. **Spinner only for an action in flight** with nothing to shape (inside a `WavButton`'s `busy`).
- Skeletons match the final geometry exactly: the same card, bars where text goes, tiles where art goes. **Zero layout shift** when data lands.
- Crossfade skeleton → content with `Loadable` (240ms, blur-in, 4pt rise).
- Pending values (a count that's still loading) sit at 30% opacity, then brighten, then roll into place with `RollingNumber`.
- A CTA that needs the data stays disabled (40% opacity) until it's ready, then fades to full.
- Empty states keep what's constant: the call to action and the sentence frame stay, and only the part that differs changes.

## 6. Family patterns → Wavlength

| Pattern | Where it goes |
|---|---|
| Tray grows out of its trigger and folds back into it | Resync → lyric-offset tray (− +0.5s +, "Resync lyrics"); Next song → "Skip to next match?"; mic first use → "Allow Wavlength to listen" |
| Label morph with shared letters | "Start party" → "Starting…" → "End party"; "Listen" → "Listening…"; "Save 1 track" → "Save 2 tracks" |
| Persistent element travels, never duplicates | now-playing art and title between the mini-bar and Listen; the song title shrinking into the Log on a switch |
| Direction-aware push and crossfade | tabs; Normal ↔ Party segmented control; step flows (onboarding, sign-in) |
| FLIP regroup (items fly to their new place) | Log grouping (by hour / artist), Party karaoke parts, Recap chapters |
| Info sub-tray: X goes back to the parent | "Synced lyrics ⓘ" explainer inside a song-details tray |
| Toast pill under the Dynamic Island | small confirmations ("Added to tonight's log") |

## 7. Screen rules (for anyone building a screen)

1. Start the tab with `WavPageHeader`. Pushed pages use an app bar with a back chevron.
2. Import `../../../core/design/design.dart`. Colours come from `context.wav`, spacing from `WavSpace`, text from `WavType`, durations and curves from `WavMotion`.
3. No `Colors.white/black/grey`, no hex, no raw `Duration(milliseconds:)`, no `Icons.*`. Use `CupertinoIcons` with outline and fill for state.
4. The body extends under the translucent tab bar and mini-player. Bottom-pad scrollables with `MediaQuery.paddingOf(context).bottom`.
5. Every async thing gets a skeleton or `Loadable`. Every in-place text change gets `MorphText` or `RollingNumber`.
6. Keep every view-model call exactly as it was. Views change; view models don't.
7. Demo mode (`DemoMode`, and `--dart-define=WAV_PREVIEW=true` in debug) must still render every screen with fake data.
8. The skill `.claude/skills/wavlength-design` is the short path through this document; use it when building or reviewing any screen.

## 8. What not to copy

Spotify's green, logo, name or the Spotify Mix font. Also not Family's exact visuals: take the behaviour, not the look.
