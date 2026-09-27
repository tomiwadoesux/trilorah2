# wavlength × Spotify design sources: what to copy

## Source status (read this first)

| # | Source | What happened | What I used |
|---|---|---|---|
| 1 | spotify.design Encore "three years on" (Dec 2022) | 301 redirect to open.spotify.com, which returns **404**. The article has moved off the live web. | Full text from the Wayback snapshot of 2024-12-31. The token-comparison image in the article was read too. |
| 2 | spotify.design icon refresh (Jan 2022) | Same 404 | Full text from the Wayback snapshot of 2024-11-27 |
| 3 | Medium "Spotify heart" | **HTTP 403 (blocked)** | Same article on spotify.design, full text from the Wayback snapshot of 2024-10-15 |
| 5 | Spotify newsroom desktop redesign | Worked | Full text |
| 6 | Figma blog "Creating coherence" | Worked | Full text |
| 9 | intodesignsystems.com "AI-ready" (Feb 2026) | Worked | Full text |
| extra | Real Encore token names and values | **None of the articles lists token names.** | The Spicetify `SemanticColor` type, which is "deducted from Spotify's internal usage. It may not be accurate", plus the live web-player stylesheet `open.spotifycdn.com/cdn/build/web-player/web-player.dcc6c80b.css`, fetched today. Values marked "observed" come from that CSS. Contrast ratios are my own WCAG calculations. |

---

## 1. Token architecture

### What Encore says (quotes)
- **Lesson #4:** "Non-semantic design tokens offer limited value." Palette, spacer and type-scale tokens could not be changed "without causing some alarming downstream regressions". Example: Spotify Green "was being used thousands of times … but we didn't know where or how." The fix was "introducing semantic layers into our token system so that we can better understand the context in which our tokens are being used."
- **Article image:** one `UI Green #1DB954` was used both as a button fill and as text. It was split into **`Accent Background #1ED760`** and **`Accent text #117A37`**. **Rule to copy: one brand hue becomes separate tokens per role (fill vs text), each tuned to pass contrast in that role.**
- **Lesson #5:** "a color-theming algorithm that, given a few input values, can generate an entire color theme with guaranteed accessible color contrast." They were also building an algorithm to "generate layout and spacing themes". The "Figgy" bot syncs code tokens into Figma, so the code is the source of truth.
- **Figma blog:** the Foundation layer holds "design tokens for foundational design decisions, such as color schemes and type styles". Spacing variables became "layout themes".

### What the shipped system actually looks like (observed CSS)
- **Themes:** `encore-dark-theme`, `encore-light-theme`, `encore-layout-theme`, `encore-small-devices-theme`, `encore-medium-devices-theme`.
- **Color sets** (scoped CSS classes): `base`, `bright-accent`, `muted-accent`, `app-frame`, `over-media`, `inverted` / `inverted-dark` / `inverted-light`, and `negative`, `warning`, `positive`, `announcement`, each also with a `-subdued` version.
- **Every set defines the same 28 token names:**
  - `background-{base, highlight, press}`, `background-elevated-{base, highlight, press}`, `background-tinted-{base, highlight, press}`
  - `text-{base, subdued, bright-accent, negative, warning, positive, announcement}`
  - `essential-{base, subdued, bright-accent, negative, warning, positive, announcement}`
  - `decorative-{base, subdued}`
  - The Spicetify type also lists `backgroundUnsafeForSmallText{Base, Highlight, Press}`.
- **The key trick:** inside a filled set, every text and essential token collapses to a single "on" color. Examples: `bright-accent-set` sets all 14 to `#000`, and `negative-set` sets all to `#fff`. **A component only ever uses `text-base`. You wrap it in a set and contrast is correct automatically.**
- **Dark base values (Spotify's, for the pattern only):**
  - `background-base #121212`, `highlight #1f1f1f`, `press #000`. On dark, press is *darker* than base and highlight is lighter.
  - `elevated-base #1f1f1f`, `elevated-highlight #2a2a2a`
  - `tinted` is white at 10%, 14% and 21% alpha (`#ffffff1a`, `#ffffff24`, `#ffffff36`)
  - `text-subdued #b3b3b3`, `essential-subdued #7c7c7c`, `decorative-subdued #292929`
- **Contrast pattern I calculated:**
  - `text-*` sits around **6.7:1** on base, and `text-subdued` at 8.9:1.
  - `essential-*` sits right at **4.5:1 on base** and about **3.4:1 on elevated-highlight**, so it stays at 3:1 or better on every surface. That meets the WCAG non-text contrast rule for icons and borders.
  - `decorative-*` is about 1.3:1: no requirement, dividers only.
  - **So the three namespaces are really three contrast budgets.**
- **`over-media-set` background is black at 54% (`#0000008a`).** White text on that scrim is **4.61:1 even over a pure-white image**. This is the "text over artwork or video" rule.
- **Layout tokens (observed):**
  - Spacing: `tighter-5…looser-6` = 2, 4, 6, 8, 12, **16 (base)**, 20, 24, 32, 40, 48, 64
  - Control size: `smaller` 32, `base` 48, `larger` 56
  - Layout margin: 16 / 16 / 24
  - Corner radius: 2, 4, 6, 8, 16
  - Border width: hairline 1, thin 2, thick 4, thicker 8, focus 2
  - Text size: 9, 11, 13, **16**, 18, 20, 24, 32, 40, 48
  - Graphic sizes come in two kinds: `decorative-*` in px (12…88) and `informative-*` in rem, meaning they **scale with the user's text size**.

### Proposed wavlength dark tokens (my values; contrast verified)
Names follow Encore's grammar: `{namespace}.{role}.{state}`. The background has a slight cool tint and is not `#121212`.

| Token | Value | Contrast on base / elevated.highlight |
|---|---|---|
| `background.base` (app canvas) | `#0E0E12` | — |
| `background.highlight` / `.press` | `#1A1A20` / `#060608` | — |
| `background.elevated.base` / `.highlight` / `.press` (cards, sheets, now-playing card) | `#18181E` / `#23232B` / `#141418` | — |
| `background.tinted.base` / `.highlight` / `.press` (chips, skeleton base, glass on artwork) | white 8% / 12% / 18% | — |
| `text.base` | `#F5F5F7` | 17.7 / 14.3 |
| `text.subdued` (artist, metadata, upcoming lyric lines) | `#A6A6B0` | 8.0 / 6.5 |
| `essential.base` | `#F5F5F7` | — |
| `essential.subdued` (inactive icons, borders, past lyric lines) | `#7A7A86` | 4.55 / 3.7 |
| `decorative.base` / `.subdued` (dividers, skeleton sweep) | `#FFFFFF` / `#2A2A33` | no requirement |
| `text.accent` / `essential.accent` (**placeholder hue; brand to decide, not green**) | `#B9A4FF` / `#9B7BFF` | 9.0, 6.1 / 7.3, 5.0 |
| `text.negative` / `essential.negative` | `#FF7B86` / `#F2414F` | 7.7, 5.2 / 6.3, 4.2 |
| `text.warning` / `essential.warning` | `#FFB44D` / `#F59E0B` | ≥ 8.8 |
| `text.positive` / `essential.positive` | `#5EE0A0` / `#2FBF7A` | ≥ 6.6 |
| `text.announcement` / `essential.announcement` (moment banner, "CHORUS IN") | `#72B4FF` / `#3A8DFF` | 8.9, 5.9 / 7.2, 4.8 |

**Color sets for wavlength:**
- `base`
- `elevated`: sheets
- `accent`: fill `#9B7BFF`, on-color `#0E0E12` (6.1:1)
- `negative`: fill `#D42A38` with white (5.0:1). My first pick, `#E5303F`, only reached 4.35 and was rejected.
- `warning`, `positive`, `announcement`: each with a `-subdued` version
- `overMedia`: black 54% scrim with white text. Use it for text on video Moments and album art.
- `artwork`: generated per song (see derivation below)

**Component-level aliases** point to semantic tokens and never to hex values:
- `lyric.active` → `text.base`
- `lyric.upcoming` → `text.subdued`
- `lyric.past` → `essential.subdued`
- `skeleton.base` → `background.tinted.base`
- `skeleton.sweep` → `background.tinted.highlight`

### Deriving the theme from a few inputs, with contrast guaranteed
1. **Inputs:** `neutralHue` plus a tiny chroma, `accentHue`, fixed status hues, and optionally `artworkColor` (dominant color of the recognized song's art).
2. **Generate in OKLCH.**
   - Neutrals: fixed lightness steps, with base about 0.15 L and highlight/elevated +0.04 to +0.08 L. Press is darker than base.
   - For each hue, make `text.*` by raising L until contrast is at least 4.5:1 against `elevated.highlight`.
   - Make `essential.*` by raising L until contrast is at least 4.5:1 on `base` and at least 3:1 on every surface. This reproduces Encore's observed budgets.
   - Filled sets: pick black or white on-color by the higher contrast. If that is still below 4.5:1, darken the fill.
3. **Artwork set:** clamp the artwork color's L to 0.20–0.30 to get `background.base`. Its on-colors come from step 2. Animate the background to it on each song switch.
4. **The guarantee is a test, not a promise.** `test/design/contrast_test.dart` loops over every set × every `text.*` (needs 4.5) × every `essential.*` (needs 3.0) × every non-"unsafe" background. It also runs over a set of about 50 random artwork colors. CI fails when any pair is below its budget.

**Flutter shape:**
- `WavColors extends ThemeExtension<WavColors>`: the 28 fields above
- `WavColorSet(set: WavSet.accent, child: …)`: an InheritedWidget that swaps the `WavColors` below it. This is the direct equivalent of Encore's CSS set classes.
- `WavSpace`, `WavRadius`, `WavControl` (32/48/56), `WavType`: constant classes that copy Encore's `tighter/base/looser` and `smaller/base/larger-N` naming.

---

## 2. Icon rules (translated to Flutter)

### Spotify rules (quotes from the icon article)
- The stroke went "from 1px to 2px at 24px icon size". "Two, bolder sizes: 24 & 16px":
  - "24px using a 2-pixel stroke size (considered our main/default size)"
  - "16px using a 1.5-pixel stroke size"
- "Any other sizes that are needed will be scaled versions of these distinct sizes." Previously they had "220 icons x 5 size variants = 1,100 individual assets". Going to two sizes removed 660 drawings.
- 16px icons "needed to use the full width and height of that icon space".
- **Active state:** "active states are no longer using only subtle changes to weights but instead filling up a portion of the icon."
- **Why:** icons increasingly replace text buttons, bigger type made thin icons look "out of proportion", and icons must stay readable "on top of a variety of different backgrounds".
- They kept existing metaphors so the change felt "seamless".

### wavlength translation (my recommendation)
- **Icon set: Phosphor** (`phosphor_flutter` 2.1.0, 772 icons). It has thin, light, regular, bold, fill and duotone styles in one set, so the partial-fill active rule works without drawing custom icons. I measured the SVGs: the 256-unit grid gives regular a 16-unit stroke and bold a 24-unit stroke.
  - **16px → `PhosphorIconsBold` = exactly 1.5px stroke**, which matches Spotify's 16px rule.
  - **24px → `PhosphorIconsBold` = 2.25px**, the closest to 2px. Regular is 1.5px at 24px, the "too thin" problem Spotify fixed.
- **Active state:** `PhosphorIconsDuotone` (the secondary layer defaults to 20% opacity; set it through `duotoneSecondaryOpacity`) or `PhosphorIconsFill`. Examples: the Listen tab, a pinned Moment, the Party mode toggle, the mic while listening.
  - Animate the change as a cross-fade plus a 0.9→1.0 scale of the fill layer over 160ms. Never use weight alone.
- **Alternative:** Lucide (`lucide_icons_flutter` 3.1.20) is natively 24px with a 2px stroke, and its weights are exposed as suffixes such as `activity100`…`activity600`. It has no filled versions, so the active fill would need custom drawing.
- **Sizes:** only `WavIconSize.small = 16` and `base = 24`.
  - Hero icons (mic 32/40, empty states 48/64) use the 24px drawing scaled up, and the stroke scales with it.
  - Informative icons (next to text) scale with `MediaQuery.textScaler`. Decorative icons don't. This copies Encore's `graphic-size-informative` vs `decorative` split.
- **Color:** icons use `essential.*` and never `text.*`. Inactive is `essential.subdued` (4.55:1), active is `essential.base` or `essential.accent`.
- **Migration:** the app has **56 `Icons.*` references and 0 Cupertino references**. Route them all through one `lib/ui/design/foundation/wav_icons.dart` facade, then ban `Icons.` everywhere else.

---

## 3. Motion rules

### Spotify (heart article; quotes)
- Motion is "inspired by the beat and rhythm of the music. It's characterized by pulses, flourishes, and the glow of light and color."
- Three principles:
  - **Move with purpose:** "Motion provides orientation and invites interaction. By showing that something's happening, it can also help reduce frustration."
  - **Provide feedback:** "Motion is a way to show that the interface is responding."
  - **Add delight:** "the little touches and attention to detail that can add beauty."
- **Numbers:** "We aimed for a duration of max 500 milliseconds and 60fps to find the perfect balance between snappy enough but still fluent."
- **Process:** static storyboards first, "to reflect on the timings and choreography". Made in After Effects with the Inspector Spacetime plugin so timings read in milliseconds. Rendered with **Lottie**. A debug switcher let them compare versions inside the real app.
- **Haptics:** "we … eventually opted to use iOS native feedback for better backward compatibility and simplicity."
- **Outcome:** delight "makes users interact with the button more", and "delight … can also move metrics".

### wavlength rules (Spotify ceiling combined with Emil's craft rules)
- **500ms is the ceiling for rare delight moments only. Everyday UI stays under 300ms.**
- **Frequency decides:** lyric lines advance every few seconds, so their motion must be quiet. First recognition happens once a night, so it can be expressive.
- **Curves (`WavMotion`):**
  - `easeOut = Cubic(0.23, 1, 0.32, 1)` for entering and appearing
  - `easeInOut = Cubic(0.77, 0, 0.175, 1)` for things moving on screen
  - `drawer = Cubic(0.32, 0.72, 0, 1)` for sheets
  - **Never ease-in.**
  - Springs are for gestures only (bounce 0.1–0.2).
- **Rules:** animate only transform and opacity. Enter from a 0.95 scale with opacity 0, never from 0. Exits are faster than entrances. Animations must be interruptible (implicit animations or `AnimationController.animateTo`, never restarting keyframes). Stagger lists by 30–80ms.
- **Pressables:** scale to 0.97 over 120–160ms with the ease-out curve, plus `HapticFeedback.selectionClick()` or `lightImpact()` from Flutter's built-in iOS haptics.
- **Reduced motion:** when `MediaQuery.disableAnimationsOf(context)` is true, keep opacity and color changes and drop all translate and scale.

| Moment | Motion | Haptic |
|---|---|---|
| Mic tap | scale 0.97, 140ms; listening ring pulses at the beat (1 loop per beat, linear, opacity only) | `lightImpact` |
| "listening…" / "finding lyrics…" | **Skeleton** in the shape of the final layout (art square, 2 title bars, lyric bars at 60–90% width). Sweep of `skeleton.sweep` over `skeleton.base`, 1.2s linear loop; static when reduced motion is on. Skeleton → content: cross-fade 200ms, no layout jump. | none |
| First song recognized (rare) | Card enters from 0.95 + opacity, 400–500ms spring (bounce 0.15); artwork color flood fades in 400ms | `mediumImpact` |
| Song switch | Title/artist cross-fade with a 2px blur, 250ms; background animates to the new artwork set, 400ms; lyrics panel resets through the skeleton | `lightImpact` |
| Lyric line advance (high frequency) | List moves by one line height, 250ms ease-in-out; active line color and weight change together; **no bounce, no haptic** | none |
| "CHORUS IN 12s" | Digits change instantly, with at most a 120ms roll. The last 3s pulse once per second in `announcement` color. At 0, the chorus lines light up in accent, ≤500ms. | `selectionClick` at 3, 2, 1 (optional) |
| Moment banner | Slides down from above (off by its own height) with opacity, 250ms ease-out; exits in 180ms. Swipe up to dismiss with velocity (dismiss above about 0.11 px/ms) and rubber-banding past the edge. | `lightImpact` on appear |
| Lyrics sync rail drag | Follows the finger exactly; spring back on release | `selectionClick` per line crossed |

---

## 4. Layout and navigation lessons for a phone music app

Source quotes (newsroom, June 2023):
- Library "anchor[ed]" on the left "so you can quickly access your saved music"; users found it "helps them save time … more easily switch".
- **Now Playing** on the right "displays the current song … more information about the song and artist … tour dates and merch". For select podcasts you can "follow transcripts as you listen". This is a precedent for synced text shown next to audio.
- Both panels "can both be resized". There is a "Go compact" mode showing icons only, filters that "toggle through your dedicated music, podcast, and audiobook feeds", and you can "move and pin".
- "Friend Activity" moved to "the 'friends' icon next to your profile picture in the top-right corner".
- Goal: "a richer experience, more context, and quicker access to personal favorites."

Translated to wavlength:
1. **Now-playing context is always one gesture away.** On Party, Log and Recap, show a persistent **mini now-playing bar** (48px control height, `background.elevated`, 16px margins). Tapping it opens Listen through a shared-element hero on the artwork and title.
2. **Listen is the "Now Playing view" at full screen, and lyrics are the main content.** Order: now-playing card at top, the big lyrics panel filling the middle, the "CHORUS IN" chip and next-song/resync controls in the thumb zone. Extra detail (credits, who's in the room) goes in a **draggable sheet with detents** (`DraggableScrollableSheet` with `snapSizes` at about 0.12, 0.5 and 0.92). This replaces the desktop's "resizable panel".
3. **Compact mode = focus mode:** hide the chrome and show lyrics only, for when the phone is held up at a party. This translates "Go compact".
4. **Filter chips instead of search** on Log (All · Sung · Moments · Recognized) and Party (People · Moments · Lines). Use the `tinted` set; selected chips are `inverted`.
5. **Pin:** pin Moments and tracks to the Recap.
6. **Secondary destinations go behind the avatar** in the top-right corner (Settings, account), like Friend Activity. The bottom bar keeps 4 tabs: **Listen · Party · Log · Recap**, with 24px icons, duotone when active and text labels. Use 48px targets (`control-size-base`).
7. Normal vs Party mode is a two-segment control in the header, not a tab.

---

## 5. Component spec template (the "outline")

From the Figma blog: the outline "might include a glossary of terms, the anatomy of the component, or any variants we need to support". It defines "terms, available states, and how properties will be applied together". It covers "naming conventions, platform specifications, and accessibility requirements", plus a "size framework and naming structure". Buttons have a "unified hierarchy: primary, secondary, and tertiary", "custom focus states (platform-dependent), and even usage guidelines". Each component has one project lead.

Use this front-matter plus body for `docs/design/components/<name>.md`:

```yaml
name: WavButton            # PascalCase class = file name
layer: component           # foundation | style | behavior | component | pattern
status: stable             # draft | stable | deprecated
glossary: { primary: "the single most important action on a screen (max 1)" }
anatomy: [container, label, leadingIcon?, trailingIcon?, focusRing]
variants:
  hierarchy: [primary, secondary, tertiary]   # primary = accent set fill; secondary = outlined essential.subdued; tertiary = text only
  size: [smaller(32), base(48), larger(56)]   # WavControl tokens
properties: { label: String, icon: WavIcon?, onPressed: VoidCallback?, loading: bool }
states: [enabled, pressed, focused, disabled, loading(skeleton|spinner)]
tokens: { bg: accent.background.base, fg: accent.text.base, radius: WavRadius.full, pad: WavSpace.base }
behavior: WavPressable     # headless: scale 0.97/140ms, haptic selectionClick, semantics button
motion: { press: "scale 0.97 140ms easeOut", loading: "crossfade 200ms" }
skeleton: "pill 48h, width = label estimate, skeleton.base"
a11y: { minTarget: 48, contrast: ">=4.5 text / >=3 essential", semantics: "button, label" }
platform: { iOS: "haptics on; no ripple", android: "ripple allowed" }
usage: { do: ["1 primary per screen"], dont: ["primary on over-media without overMedia set"] }
tests: [test/design/wav_button_golden_test.dart]
```

---

## 6. Layering for AI-readability

Source (intodesignsystems, Feb 2026):
- Encore separates the "Foundational layer", the "Component style layer" and the "Component behavior layer". Behavior is handled by "headless components" (React ARIA, Base UI), which give "way smaller context bubbles" for AI.
- Spotify shipped an **MCP server** for Encore documentation. It tests AI output against "Encore components", "Lint errors", "Similarity scores" and "Visual output".
- Patterns: **Presence** ("Design systems must exist where AI operates or get bypassed"), **Structure Over Generation**, **Flexible Over Rigid**, **Test Real Output**, **Infrastructure Mindset**.
- "The foundation is machine-readable documentation. Everything else builds on that."
- The Encore article's lesson on Conway's law is also relevant: keep **one** foundation and no "local systems".

Proposed Flutter structure. It replaces `lib/ui/core/theme.dart`, the flat wireframe.

```
lib/ui/design/
  foundation/   wav_colors.dart (28 semantic tokens + WavColorSet), color_sets.dart (generated),
                theme_generator.dart (OKLCH algorithm), wav_space.dart, wav_radius.dart,
                wav_type.dart, wav_motion.dart (curves, durations, springs), wav_icons.dart, wav_haptics.dart
  styles/       ThemeExtensions per component (WavButtonStyle, WavCardStyle…); tokens only, no logic
  behavior/     headless: WavPressable, WavSkeleton (shimmer controller + reduced motion),
                WavSwipeDismiss (velocity), WavDetentSheet, WavCountdown; no colors
  components/   WavButton, NowPlayingCard, LyricsPanel, ChorusChip, MomentBanner, MiniPlayer
                = style + behavior; nothing else
docs/design/    DESIGN.md (rules index, <200 lines), tokens.md (generated from code), components/*.md (outline above)
.claude/skills/wavlength-design/SKILL.md   # "presence": the rules live where the agent works; links to docs/design
test/design/    contrast_test.dart, golden tests per component, token_usage_test.dart
```

**Enforcement.** "Structure over generation" becomes CI checks:
- No `Color(0x…)` or `Colors.` outside `foundation/`
- No raw `Duration(milliseconds:)` or `Curves.` outside `wav_motion.dart`
- No `Icons.` outside `wav_icons.dart`
- No `HapticFeedback` outside `wav_haptics.dart`

Implement these as a `custom_lint` rule or a grep test. Write DESIGN.md rules as short imperative statements with the reason, for example: "Icons use essential.*, text uses text.*; reason: contrast budgets." Keep `tokens.md` generated from code so it can't drift. This is Figgy's "code is source of truth" idea.

---

## 7. What NOT to copy
- **Brand:**
  - Spotify greens: `#1DB954`, `#1ED760`, `#117A37`, and the accent-set hover and press values `#3BE477` / `#1ABC54`
  - The logo, the name, the fonts (**Spotify Mix**, Circular)
  - The Encore name
  - The heart icon and its specific Lottie like-animation
- **Exact Spotify values:** the `#121212` / `#1f1f1f` / `#b3b3b3` neutrals and its exact status hexes. Copy the **structure and contrast budgets**, not the numbers. My values above are my own and already verified.
- **Anything that makes wavlength look like a Spotify clone:** black-and-green pill buttons, "Your Library" / "Liked Songs" naming, and the three-panel desktop layout, which doesn't fit a phone.
- **Org and process complexity:** "system of systems" or local subsystems (the article itself says they drifted into Conway's law and "a spider's web"), 5 icon size variants, a Figma sync bot, an MCP server. For one repo, the in-repo skill plus docs plus tests is enough.
- **Custom haptic design tools:** Spotify itself chose native iOS feedback.
- **The 500ms budget as a default:** it applies only to rare delight moments. Everyday UI stays at 300ms or less.

---

**Sources:**
- [Encore three years on (Wayback)](https://web.archive.org/web/2024/https://spotify.design/article/can-i-get-an-encore-spotifys-design-system-three-years-on)
- [Icon refresh (Wayback)](https://web.archive.org/web/2024/https://spotify.design/article/refreshing-our-icon-system-the-why-and-how-behind-the-changes)
- [Heart animation (Wayback of spotify.design copy; Medium returned 403)](https://web.archive.org/web/2024/https://spotify.design/article/bringing-the-spotify-heart-to-life)
- [Spotify newsroom desktop redesign](https://newsroom.spotify.com/2023-06-20/spotify-desktop-experience-redesign-your-library-now-playing-views-customize/)
- [Figma blog: Creating coherence](https://www.figma.com/blog/creating-coherence-how-spotifys-design-system-goes-beyond-platforms/)
- [Into Design Systems: Spotify AI-ready](https://www.intodesignsystems.com/blog/how-spotify-design-system-ai-ready)
- [Spicetify SemanticColor type](https://spicetify.app/docs/development/api-wrapper/types/semantic-color/)
- Spotify web-player CSS: `open.spotifycdn.com/cdn/build/web-player/web-player.dcc6c80b.css` (observed token values)
- [phosphor_flutter](https://pub.dev/packages/phosphor_flutter)
- [lucide_icons_flutter](https://pub.dev/packages/lucide_icons_flutter)

Raw extracted texts are in `/private/tmp/claude-501/-Users-ayotomiwa-Documents-wavlength/220f87b5-cba6-4f2f-92af-e12aab865f22/scratchpad/` (`wb-*.txt`, `icon.txt`, `figma.txt`, `ids.txt`, `news.txt`, `wp.css`, `semantic-tokens.png`).