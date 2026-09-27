# Family wallet interactions, clip by clip (frame-measured)

The 53 interaction clips from Benji Taylor's essay "Family Values", each read frame by frame at **20 fps** (a frame every 50 ms) from contact sheets, with tray edges, card positions and glyph positions measured on pixel rows and opacities estimated per frame. This replaces an earlier coarse pass (one frame every 0.11–0.84 s), whose timings were mostly 1.5–3× too slow; every section ends with what that pass got wrong.

Reading the numbers: "progress per frame 33 / 72 / 94 / 100 %" means the fraction of the total travel reached at +50, +100, +150, +200 ms after the first moving frame. In every clip the transition starts on touch-UP; the 200–250 ms between the touch ring appearing and the first motion is the press, not latency. No overshoot was seen in any clip.

The distilled catalogue is `.claude/skills/wavlength-design/references/family-patterns.md`.

## 01 — Height-morphing tray: bottom anchored, both pages pinned to the moving top edge, a 150 ms crossfade that leads a 250–300 ms spring on the height
*Essay section:* SIMPLICITY / dynamic tray system: trays expand, contract and adapt to their content (Options -> Private Key -> Options -> Secret Recovery Phrase -> Options)

**What happens.** Options tray is 130 px tall in the sheet (≈255 pt); Private Key / Secret Recovery Phrase are 215 px (≈422 pt), so +167 pt. Measured on the tray's white left margin, the bottom edge sits on the same pixel row (424) in all 89 frames: only the top edge moves, width and side insets never change. Sequence for the first expand: touch ring appears on 'View Private Key' at 0.25 s; nothing moves for four frames; at 0.45 s the top edge has risen 11 % and the Options list is ALREADY ~50 % faded with the Private Key icon/title/bullets ghosted in underneath; 0.50 s = 41 % height, Options ~25 %, new content ~60 %; 0.55 s = 76 %, Options ~10 %, new ~85 %; 0.60 s = 93 %, new content fully opaque, no Options ghost left; 0.65–0.75 s creep 98→100 %. The close-x rides the top edge (it is always ~38 pt below whatever the top is). Both pages are laid out from the top edge: the 'Options' title occupies the slot where the Private Key ICON ends up; 'Private Key' sits ~40 pt lower, so it is a plain crossfade of two top-pinned layouts, not a title-to-title morph. The Cancel/Reveal row is laid out at its final offset and is clipped by the bottom edge until the tray is tall enough (visible half-cut at 0.55 s). Outgoing text stays crisp and in place at 2× zoom: no scale, no blur, no slide. The collapse (close-x, ring 1.45 s, motion 1.65 s) is the exact reverse: Private Key content ~50 % gone in the first moving frame, Options already ~40 % in, background rows uncovered without moving. Expand 2 (ring 2.45, motion 2.65–2.90) and collapse 2 (ring 3.85, motion 4.05–4.30) repeat it pixel-for-pixel. Scrim constant throughout.

**Timing.** Height, all four transitions: first movement 200 ms after the ring appears; travel per frame from first motion = 4–14 %, 41–59 %, 76–86 %, 91–94 %, 98 %, 100 % → 250 ms to 98 %, 300 ms to the last pixel. Expand and collapse use the same curve and the same duration (collapse 2: 4 %, 45 %, 79 %, 94 %, 99 %). Crossfade: ~50 % at the first moving frame, done by the 3rd–4th frame → 150–200 ms, finishing ~100 ms before the height. Confidence: high (measured on pixel rows, 4 transitions agree within one frame).

**Easing.** S-shaped, not front-loaded: ~10 % in the first 50 ms, ~50 % by 100 ms, ~80 % by 150 ms, then a 2-frame 1-px creep. That is a spring starting from rest (zero initial velocity), roughly response 0.3 s, damping ≈ 0.9–1.0; no overshoot frame in any of the four transitions. The crossfade is faster and front-loaded (half done in the first frame), so it does not share the height curve.

**Corrections vs the coarse pass.**
- Collapse is NOT slower than expand; both are ~250 ms on the same curve. The '30 % first frame' read was a sampling artefact.
- Easing is not a hard ease-out: the first 50 ms carry only ~10 % of travel (spring from rest), peak velocity at 100–150 ms.
- The crossfade leads the height (half-faded before the tray has moved 15 %) and finishes ~100 ms earlier; coarse had it 'seems to finish before' with no numbers.
- 'Options' does not dissolve into the new title at the same origin; the titles are 40 pt apart. The old title lands on the new icon's slot.
- Height numbers: 255→422 pt, not 281→450.

**In Wavlength.** Keep the Song-options tray plan (Resync / Wrong song? / Lyrics offset) and the close-x-pops-back rule. In lib/ui/core/design/tray.dart: AnimatedSize bottom-anchored with a spring-from-rest curve (~280 ms, no overshoot), pages top-aligned, a 150 ms opacity crossfade that starts on the same tick as the size change, no horizontal slide, no blur, and let the tray clip the incoming page's CTA row until the height arrives.

## 02 — Multi-step tray that rides the keyboard curve exactly; every step is a 150 ms top-pinned crossfade; exit is faster than the keyboard
*Essay section:* SIMPLICITY / trays appear on top of content (multi-step Wallet Details edit flow with keyboard; heights adapt per step)

**What happens.** Ring on Luke at 0.70 s; scrim and tray start on the same frame, 0.95 s: scrim ~60 % and the tray top already 46 % of the way up (it translates from fully below the screen, no scale, no fade), 84 % at 1.00, 97 % at 1.05, settled at 1.10; scrim full by 1.05. Steps and heights (sheet px, ≈×1.96 pt): Wallet Details menu 130 (255 pt) → Edit form 147 (290 pt) → Select Icon 189 (371 pt) → Choose an Emoji 195 (383 pt) → Use Emoji 239 (468 pt) → form 147. 'Edit Wallet' (ring 1.90, motion 2.10): keyboard and tray move on the same frame; per-frame fractions of travel are identical for the keyboard top (23, 54, 76, 88, 95, 97, 99, 100 %) and the tray top (23, 55, 76, 88, 94, 97, 99, 100 %), i.e. the tray is literally attached to the keyboard's curve, ending 7–8 px (≈15 pt) above it. The menu→form crossfade is happening in the same frames ('Luke' over 'Edit Wallet', 'Save' over 'Remove Wallet', all top-pinned) and is done by 2.20. 'Icon' (ring 2.95, motion 3.15): keyboard drops (2, 31, 60, 80, 90, 96, 99, 100 % over 3.20–3.50) while the tray falls back to its bottom anchor and grows; the tray is settled by 3.45, one frame before the keyboard. 'Use Emoji' (ring 4.10, motion 4.30–4.40): only 6 px of height change; the titles 'Select Icon' / 'Choose an Emoji' overlap at the SAME slot at 4.30 (~70/40 %), rows and emoji grid crossfade in place, done at 4.40. Emoji tap → 'Use Emoji' (5.90–6.10): height 5, 47, 79, 95, 100 %; the big avatar preview fades in at final position and ~final size (no flight from the grid cell, ≤10 % scale if any); grid ghost gone by 6.05. Swatch tap (6.90–7.15) recolours the avatar with a ~100 ms fade. Save (ring 8.15, motion 8.40): keyboard rises and the tray top tracks it again (23, 55, 77, 87, 97, 100 %); the form is fully in by 8.50 but the outgoing avatar ghost lingers to ~8.70–8.75 behind the Icon row; the Icon row shows the teal emoji from the first frame. Close (ring 9.75, motion 10.00): the tray drops ~45 % of its exit travel in the first frame and is gone by 10.05–10.10; scrim gone by 10.10; the keyboard is slower (7, 36, ~75, 100 % at 10.15). Luke's grid avatar already shows the new emoji at 10.05, under the fading scrim.

**Timing.** Entry 200 ms (tray) / 150 ms (scrim), 250 ms after the ring. Keyboard-coupled moves: ~90 % at 200 ms, settled at 350 ms (system keyboard curve). Height-only morph (5.90): 200–250 ms. Content crossfades: 150 ms in every step, starting on the first moving frame. Exit: tray 100–150 ms, scrim 150 ms, keyboard ~300 ms. Confidence: high for the keyboard coupling and step crossfades (pixel-measured); medium for the exit (2 frames).

**Easing.** Keyboard-coupled: ~23 % in the first frame then a long soft tail (the UIKit keyboard spring); tray and keyboard share one curve to the frame. Pure height morph: S-shaped spring-from-rest as in clip 01 (5 → 47 → 79 → 95 %). Entry translate is front-loaded (46 % first frame). Exit is the most front-loaded move in the clip. No overshoot anywhere; settled tops repeat pixel-exact.

**Corrections vs the coarse pass.**
- Tray-to-keyboard gap is ~15 pt, not 8–10 pt; the tray does not merely 'ride above' the keyboard, it shares the keyboard's per-frame curve exactly.
- Every step change completes in 150 ms (crossfade), not 'within 480 ms'; height changes take 200–350 ms depending on whether the keyboard is involved.
- Exit: the tray leaves ahead of the keyboard (gone in ≤100–150 ms), it does not 'dismiss with the keyboard'.
- Missed: the outgoing avatar ghost outlives the incoming form by ~200 ms; the step transition where titles share one slot ('Select Icon' → 'Choose an Emoji') is a true same-origin title crossfade, unlike clip 01.

**In Wavlength.** Keep the 'You' tray plan (name → Icon → emoji → colour → Save). Implement the keyboard step by animating the tray's bottom with the same curve/duration as the keyboard inset (Flutter: drive it from MediaQuery.viewInsets each frame rather than a separate AnimatedPadding), 16 pt above the keyboard; step content = 150 ms top-pinned crossfade; close = 120 ms slide-down with a 150 ms scrim fade, keyboard left to its own curve.

## 03 — Button-to-tray unfold in 150 ms (rect interpolated from the CTA, content revealed by the clip, not faded), then a sequenced ~250 ms step slide with instant icon swap and a two-phase progress hand-off
*Essay section:* SIMPLICITY / trays emerge from buttons, plus FLUIDITY step transition (close-x -> back-chevron, directional slide, progress hand-off). Keep.

**What happens.** Ring on 'New Group' at 0.70 s. Nothing moves for 4 frames. 0.90 s: scrim already ~70 %; the tray's rect is 42 % of the way from the Continue button's rect (158 px wide, top at ~405) to the final tray (182 px wide, top at 150): both width and top edge read 42 % in the same frame, so it is one rect interpolation. Inside it the '?' icon, 'Are you sure?' and the body are ALREADY fully opaque, laid out at final size and pinned to the rising top edge; the rect clips them. The Continue button has moved only 3 px. 0.95 s: rect ~85 %, scrim 100 %, Continue at its final tray position (bottom edge 422 vs 428 on the page: it rises 6–8 px ≈ 14 pt and nothing else). 1.00 s: settled; identical through 1.75. The tray's bottom edge is the button's bottom edge (428 → 431): the tray grows up and sideways from the CTA, never down. Collapse (ring 1.65, motion 1.85): 1.85 = 4 %, 1.90 = ~60 % with the button back on the page and the scrim ~40 %, 1.95 = rect at the button with the remaining content ghost at ~30 % (the content fades only in the last frame), scrim gone; 2.00 clean page. The page then holds still for 4 frames; the step change starts at 2.25 s. In that first frame: the × is already a < (no intermediate drawn), the progress pill shows segments 1 and 2 both blue at nearly equal length, the keyboard has started rising and Continue has turned half-pale and moved up 13 %. Outgoing page: −42 pt at ~70 % opacity (2.25), −60 pt / 40 % (2.30), −80 pt / 20 % (2.35), ghost gone by 2.45. Incoming page: +64 pt (2.25), +32 (2.30), +10 (2.35), +4 (2.40), 0 (2.45). Progress: lengths swap over 2.25–2.30, then segment 1's blue fades to grey over 2.30–2.40. Continue rides the keyboard curve exactly (13, 47, 72, 88, 96, 100 %). Back (ring 3.95, motion 4.15) is the mirror with the same fractions: incoming at −32 pt (4.20), −16 (4.25), −4 (4.30), 0 (4.35); < is × on the first frame; keyboard and Continue glide down together; segment 2 fades after the lengths swap.

**Timing.** Unfold 150 ms (3 frames: 42, 85, 100 %); scrim in 100–150 ms and leading the rect. Collapse 150 ms (4, 60, 95+fade, 100 %). Gap between collapse end and slide start: 250 ms. Slide 200–250 ms both directions (incoming ≈ 50, 75, 92, 97, 100 %); outgoing fade 150–200 ms; icon swap ≤ 50 ms; pill 100 ms length + 100–150 ms colour. Keyboard/Continue: ~90 % at 200 ms, settled ~300 ms. Confidence: high for the unfold and slide fractions (pixel-measured), medium for the outgoing travel (text clipped at the screen edge).

**Easing.** Unfold is front-loaded (42 % in the first frame, ease-out), unlike the spring-from-rest height morphs in clips 01/02; collapse starts soft (4 %) then snaps. Slide is ease-out with no overshoot (incoming lands from +4 pt with no pass-through). Continue and keyboard share one curve; the page slide is a separate, faster curve.

**Corrections vs the coarse pass.**
- Unfold is ~150 ms, not 300–350; collapse ~150 ms, not '≤230'.
- Tray content does not fade in: it is opaque from the first frame and revealed by the growing clip. Only the collapse has a short opacity tail.
- The slide is symmetric; the '85 %/25 %' vs '30 %/70 %' asymmetry was a sampling artefact. Incoming and outgoing move ~100–130 pt on the same curve.
- The ×/< swap is instantaneous on the first slide frame, not a morph; the pill hand-off is two-phase (length first, colour second).
- Missed: the 250 ms rest between the tray leaving and the step starting; scrim enters ahead of the tray rect.

**In Wavlength.** Keep the 'Start a party?' unfold from the primary CTA and the sign-in step pattern. Build the unfold as a 150 ms RectTween from the button (ease-out) with content pre-laid-out and clipped, CTA lifting 14 pt; wait ~250 ms after the collapse before the step slide; steps = 250 ms, ~1/3-width slide + 150 ms fade; swap the nav icon on frame 1; progress pill: 100 ms width, then 150 ms colour.

## 04 — Five-step tray: steps are 150–200 ms same-slot crossfades, height barely changes (it is the keyboard coupling that moves the tray), CTA label morph, in-CTA spinner, blur-swap toast in the title slot
*Essay section:* SIMPLICITY / each subsequent tray varies in height; one job per tray. Keep, but see the height correction.

**What happens.** Entry: scrim ~70 % and tray top 59 % of the way up on the same frame (1.00 s), 89 % at 1.05, done at 1.10–1.15 (translate, no scale). Heights measured from the tray top to the fixed bottom (≈×1.96 pt): How can we help 416 pt → Choose Areas 477 → Share Feedback 410 → Attach Media 408 → Your Details 416. Only step 2 is visibly taller; steps 3, 4 and 5 are within 8 pt of step 1. Every step change: titles crossfade in the SAME slot (e.g. 'How can we help?' over 'Choose Areas' at 50/50 at 2.00 s), rows/fields crossfade in place pinned to the top edge, done in 3–4 frames. Step 1→2 height: 6, 50, 83, 93, 100 % (1.95–2.15). Tick on 'Send': appears at ~30 % (2.85) then full (2.90); Continue turns solid over 2.85–2.95. Step 2→3 (ring 4.65, motion 4.85): keyboard rises and the tray top tracks it frame-for-frame (tray 22, 53, 75, 88, 95, 98, 100 % vs keyboard 20, 52, 74, 87, 93, 97, 100 %), settling 7 px (≈15 pt) above it. Focusing the body field (6.75–7.00) adds the predictive bar: the keyboard grows 46 pt and the tray rides up 44 pt on the same 5-frame curve. Step 3→4 (motion 8.25): keyboard drops 169 px, tray top drops 156 px, fractions identical (23, 54, 76, 88, 92, 97, 99, 100 %). The 'Tap to add attachments' tooltip starts at 8.55 s, i.e. on the frame the tray lands: it scales up in place above the icon (≈10 %, 60 %, 95 %, 100 % over 8.55–8.70), no overshoot visible. Step 4→5 (motion 9.55): tray and keyboard rise together again (13, 45, 70, 85, 93, 97, 99, 100 %); the tooltip rides up and fades out over 9.55–9.65; CTA morph: 'Continue' stays opaque and slides left (~1/3 at 9.60) while 'to Submit' fades in at its final x, done by 9.70. Submit (ring 10.50, motion 10.65): form dims to ~40 % and the CTA goes pale with a right-end spinner within the first frame; the keyboard leaves fast (21, 66, 95, 100 % by 10.80) while the tray settles to the bottom on its own curve (5, 38, 65, 81, 91, 95, 98, 100 % by 11.00); not keyboard-locked this time. Spinner visible 10.65–11.45 (0.8 s). Exit 11.45–11.60: tray 10, 53, ~95, 100 %; the scrim fades over the same three frames (≈50 ms behind). 200 ms after the page is clean (11.80), the nav title BLURS out and 'Feedback Shared' blurs in with a white capsule and soft shadow (11.80 blurred both, 11.85 ~90 %, 11.90 crisp); it holds to 13.75 then blur-swaps back to 'Wallets' over 13.80–13.90.

**Timing.** Entry 150–200 ms. Step crossfades 150–200 ms, starting on the first moving frame. Height-only morph 200 ms. Keyboard-coupled moves ~90 % at 200 ms, settled 350 ms. Tooltip pop 150 ms, starting at tray landing. CTA morph 150 ms. Submit dim/spinner ≤ 50 ms; spinner shown 800 ms. Exit 150–200 ms; scrim 150 ms concurrent. Toast in/out 100–150 ms each, on screen ≈ 2.0 s. Confidence: high for tray/keyboard fractions (pixel-measured), medium for tooltip and toast (2–3 frames).

**Easing.** Keyboard-coupled: shared keyboard curve. Pure height morph and exit: S-curve spring-from-rest (5–10 % first frame). Entry: front-loaded. Tooltip: ease-out scale. Toast: opacity + blur (the only blur in the batch), no travel.

**Corrections vs the coarse pass.**
- Step heights are NOT clearly different: 416/477/410/408/416 pt. The 'unmistakable step change' comes from the same-slot title crossfade and from the keyboard moving the whole tray, not from height.
- Tooltip is not a 'pop after the tray lands' with unknown timing: it starts on the landing frame and scales up over 150 ms; it fades out on the next step rather than persisting.
- The scrim fades WITH the tray exit, not after it.
- Missed: the title-to-toast swap uses blur; toast appears 200 ms after the page settles and lasts ~2 s; on submit the tray is decoupled from the keyboard; predictive-bar growth is tracked too.

**In Wavlength.** Keep the 'Lyrics wrong?' report flow, the in-CTA spinner with 40 % dimmed content, and the 'Continue' → 'Continue to Send' morph (150 ms, keep the shared word opaque and sliding). Do not force ≥ 40 pt height steps; rely on same-slot title crossfades and keyboard coupling. On success: 200 ms after the tray is gone, blur-swap the Listen header title into a 'Thanks - sent' capsule for 2 s (moment_banner.dart slot), blur-swap back.

## 05 — Nested explainer trays: 200–250 ms bottom-anchored shrink/grow with a 150 ms same-slot crossfade; the gauge draws once (350 ms, ease-out) and is kept, not redrawn, when popping back
*Essay section:* SIMPLICITY / every tray has a title and an icon; one piece of content per tray. Keep.

**What happens.** Heights (sheet px ×1.96): Refuel Gas 247 → 484 pt, Fee Estimate 228 → 447 pt, Price Range 173 → 339 pt. Bottom edge on row 424 in every frame; width constant. Forward 1 (ring on the Fee Estimate 'i' at 1.10, first motion 1.30): the tray top drops 19 px; in the same first frame 'Refuel Gas' is ~60 % and 'Fee Estimate' ~40 % in the same title slot, the 'Price Range' card is ghosted at its final offset from the top edge over the Send/Receive rows, and the arc is a grey track with ~15 % green. 1.35: title swap ~80/20, arc ~40 % coloured. 1.40: crossfade done, arc ~75 %. 1.45 ~90 %, 1.50 ~95 %, 1.55–1.60 the last few degrees of red, full by 1.65. The rows behind (Chat Settings) are simply uncovered, sharp and unmoving. Forward 2 (ring 2.60, motion 2.80): 55 px shrink; at 2.80 'Fee Estimate' → 'Price Range' overlap 60/40 in one slot, gauge card at ~40 % with the paragraph at ~60 % on top of it, both top-pinned; 2.85 gauge ghost ~15 %; 2.90 clean. Back 1 (close-x ring 4.05, motion 4.25): the tray grows 55 px; the gauge comes back FULLY drawn on its first ghost frame (4.25, ~40 %) — no re-draw, the previous step's view was retained. Back 2 (ring 5.15, motion 5.35): grows 20 px; Refuel Gas rows crossfade in over 5.35–5.45 with the Cancel/Continue row clipped by the bottom edge until 5.45. Background list is progressively covered again without moving. No scrim change at any point.

**Timing.** Ring → first motion: 200 ms in all four transitions (likely touch-up trigger). Height, fraction per frame: fwd1 37, 74, 89, 95, 100 % (200 ms); fwd2 20, 62, 87, 98, 100 % (200–250 ms); back1 38, 75, 93, 98, 100 % (200 ms); back2 40, 80, 95, 100 % (150–200 ms). Crossfade: ~40 % at the first moving frame, done by the third → 150 ms, finishing before the height. Gauge draw: starts on the first morph frame, ~350 ms to full (15, 40, 75, 90, 95, 98, 100 %). Confidence: high (pixel rows; 4 transitions consistent).

**Easing.** Height is ease-out here (20–40 % in the first 50 ms), slightly softer on the big shrink (20 %); no overshoot (settled tops repeat pixel-exact for 20+ frames). Gauge sweep is a clear ease-out that outlasts the tray by ~150 ms. Crossfade is linear-ish and faster than both.

**Corrections vs the coarse pass.**
- Heights: 484 / 447 / 339 pt (coarse: 480 / 444 / 338, fine). Back morph is NOT slower (39 % at mid was one sample); back and forward are both ~200 ms on the same curve.
- The gauge draws only the first time. Popping back from Price Range shows the arc already complete; it does not re-animate.
- Gauge draw is ~350 ms and starts on the morph's first frame (coarse had 350–450 ms, 'finishes after' — confirmed, tightened).
- Missed: the outgoing title and incoming title share one slot (unlike clip 01, where the layouts differ); the 200 ms ring-to-motion gap.

**In Wavlength.** Sync tray (from the sync-quality dot or the chorus chip) with a confidence/offset arc: draw the arc once per tray open (350 ms ease-out, starting on the same tick as the tray morph) and keep the drawn state when the user drills into 'How live sync works' and pops back. Tray step: 200 ms bottom-anchored ease-out height change + 150 ms same-slot title/body crossfade, no scrim change, background never moves.

## 06 — Hero explainer tray: 200 ms translate-in with the scrim on the identical curve, a one-shot ~0.9 s logo morph after landing (not a loop), 200 ms exit
*Essay section:* SIMPLICITY / one piece of content and one primary action per tray (contextual '?' help tray with a hero header). Keep.

**What happens.** Ring on '?' at 0.90 s; nothing for four frames; at 1.10 the tray top has covered 34 % of its 319 px travel (from below the screen to row 130 ≈ 625 pt tall, floating ~31 pt above the screen edge) and the scrim is at 35 % of its final density (page white 255 → 187, i.e. ~27 % black); 1.15: tray 79 %, scrim 79 %; 1.20: 96 % / 97 %; 1.25: 99.7 % / 100 %; 1.30 settled. The tray is a pure translate: the blue band, glyph, title, close-x, body text and 'Got It' are all fully opaque and at final layout from the first frame; nothing scales or fades. The pale glyph in the header band is mid-shape as it rises and keeps morphing after landing: frame-to-frame pixel change in the band is large from 1.30 to ~2.15 (rounded blob → bracket → square → two-lobed frame → four-circle frame) and then drops to zero from 2.20 through 3.85, so the illustration is a ~0.9–1.0 s one-shot settle into its final four-blob logo, not a continuous loop. Body text scrolls under a white-to-transparent mask above 'Got It' (static). Ring on 'Got It' at 3.70; exit starts at 3.90: tray 43 % down, scrim 43 % lifted; 3.95: 82 % / 81 %; 4.00: 96 % / 94 %; 4.05: tray gone, scrim 99 %; 4.10 clean page. The page behind never moves or scales; it only dims.

**Timing.** Ring → motion: 200 ms on both entry and exit. Entry: 200 ms to 99 % (4 frames). Exit: 150–200 ms (3 frames to 96 %). Scrim in/out: same 200 ms, same frames. Glyph morph: ~900 ms starting as the tray lands (1.30 → 2.15), then static for the rest of the clip (1.7 s observed). Confidence: high for tray/scrim (pixel-measured per frame, two events); medium-high for the morph end (pixel-diff drops to noise floor).

**Easing.** Entry per-frame fractions 34, 79, 96, 100 %: front-loaded ease-out (roughly a critically damped spring with ~60 % of travel in the first 100 ms). Exit 43, 82, 96, 100 %: the same curve, slightly quicker. Scrim opacity and tray translate are driven by one progress value (the fractions match to 1–2 %). No overshoot: the tray top sits on row 129–131 for 50 consecutive frames.

**Corrections vs the coarse pass.**
- Entry is ~200 ms, not 300–350 ms; the '47 pt short at 0.2 s' sample was taken while the tray was still 1 frame from landing because motion starts 200 ms after the ring, not at the ring.
- Exit is not faster than entry; both are ~200 ms on the same curve.
- The illustration is not a continuous loop of 0.2–0.4 s per shape: it morphs once for ~0.9 s after landing and then holds still.
- Scrim and tray share one curve exactly (coarse said 'together', now measured).
- Tray height ≈ 625 pt, header band ≈ 165 pt; the tray floats ~31 pt above the bottom edge.

**In Wavlength.** First-use explainers ('What is Party mode?', 'How Moments work', 'Karaoke lines'): 200 ms ease-out slide-up with the scrim tied to the same animation value; accent-colour header band with a logo/waveform morph that runs once (~0.9 s) after the tray lands and then rests, so it reads as a flourish rather than a busy loop; one 'Got it' that dismisses on a 200 ms mirror of the entry.

## 07 — Theme-matched dark tray: 150 ms entry that outruns a 200 ms scrim, 200–250 ms nested morphs on the clip-01 S-curve, gauge draw with live-ticking values, scrim-tap exit
*Essay section:* SIMPLICITY / tray theme adapts to the flow (dark flow -> dark tray). Keep.

**What happens.** Dark 'Confirm transaction to James' page. Ring on the Fee Estimate 'i' at 0.55 s; first motion at 0.75: the tray top is already 60 % of the way up (from below the screen to row 189, i.e. ≈ 480 pt tall, floating ~30 pt above the bottom edge) while the page title has dimmed only 38 % (white 255 → final 93, so the page ends at ~36 % brightness, a ~64 % black scrim); 0.80: tray 97 %, scrim 79 %; 0.85: tray 97 %, scrim 95 %; 0.90: 100 % / 99 %. The tray surface is rgb(30,30,30) with an inner 'Price Range' card at ~rgb(45–50). The gauge starts drawing on the tray's first frame: ~10 % of the arc at 0.75, 30 % at 0.80, 55 % at 0.85, 72 % at 0.90, 85 % at 0.95, 93 % at 1.00, 97 % at 1.05, full at 1.10. While it draws, the numbers under it tick: $1.18 → $1.19, Base Fee 12.08 → 12.09 → 12.11 → 12.17 → 12.2 → 12.21 over 0.80–1.10, the ETH sub-values changing every frame — live data settling in step with the sweep. Morph to 'Price Range' (ring 1.75, motion 1.95): tray shrinks 56 px (≈ 110 pt); at 1.95 the two titles overlap ~50/50 in one slot, the paragraph is ~60 % in, the gauge card ~40 %, both top-pinned; at 2.00 the gauge ghost is ~15 %; 2.05 clean. Uncovered page rows (Total Value, Send ETH, From) reappear already dimmed and in place. Back (ring 3.35, motion 3.55): the tray grows back; the gauge returns fully drawn on its first ghost frame (3.55) with no re-sweep. Scrim tap (ring 4.85–5.10, motion 5.15): tray 31 % down and page 33 % re-brightened on the same frame; 5.20: tray past the screen edge, page 78 %; 5.25: 94 %; 5.30: 99 %. The Confirm pill is back, untouched, at 5.20.

**Timing.** Ring → motion 200 ms (all four events). Entry: tray 100–150 ms (60, 97, 97, 100 %), scrim 200 ms (38, 79, 95, 99 %). Gauge sweep ~350 ms from the first tray frame. Forward morph: 18, 55, 84, 95, 100 % → 200–250 ms; back: 25, 67, 88, 96, 98, 100 % → 250 ms. Title/body crossfade 150 ms. Exit: tray ≤ 150 ms, scrim 200 ms, concurrent. Confidence: high for all edges (pixel rows); medium for the gauge fractions (read at 2×).

**Easing.** Entry tray is the most front-loaded move in clips 01–07 (60 % in the first 50 ms) and leads the scrim, which runs the ordinary 200 ms ease-out. Height morphs use the clip-01 spring-from-rest shape (18–25 % first frame, ~85 % by 150 ms, 1–2 px creep to 250 ms), no overshoot (tops repeat pixel-exact for 30+ frames). Gauge: ease-out. Crossfades: opacity only; overlapping titles stay crisp at 2×.

**Corrections vs the coarse pass.**
- Entry is ~150 ms and faster than the scrim; the coarse 'within one sample' left this open.
- Morphs are ~200–250 ms both ways (coarse: 300–350 ms; the '57 % / 40 % at mid' were single samples of the same S-curve).
- Missed: the gauge values count up while the arc draws; the gauge does not redraw on popping back; scrim-tap exit runs tray and scrim together in ~150–200 ms.
- Scrim measured at ~64 % black (page text at 36 % brightness): confirms the coarse ~65 %.

**In Wavlength.** Every tray on the dark Listen/Party screens: surface #1E1E1E over #000, inner cards one step lighter (~#2E2E2E), scrim ≈ 64 % black at 200 ms ease-out, tray slide-in 150 ms leading it. Sync/offset tray: draw the arc once over ~350 ms starting on the tray's first frame and let the confidence figure tick to its final value during the sweep; keep the drawn state through 'How live sync works' and back. Nested morphs: 200–250 ms bottom-anchored spring-from-rest, 150 ms same-slot title crossfade. Party-mode tint: darken the album colour to the same lightness as #1E1E1E so the scrim contrast holds.

## 08 — Button morphs into a confirmation tray: the slab is full-width from frame one, only the height grows; CTA slides right on the same curve; body then Cancel fade in last
*Essay section:* SIMPLICITY / trays for transient actions, confirmations and warnings (Remove Wallet 'Are you sure?') — keep

**What happens.** 0.60–0.75 (4 frames) the finger is down on Continue; the pill reads slightly lighter, no measurable width change. Release ≈0.78. At 0.80 a white rounded slab is ALREADY at full tray width (≈8 pt wider than the button per side) but only ~33 % of its final height, hugging the button; the scrim is ~10 %; Continue has slid ~28 % of the way into its right-half slot and risen ~5 pt. 0.85: height 72 %, scrim ~20 %, the '!' icon, title and body are at ~50 % and pinned to the tray TOP (they rise with the edge), Continue 70 % across, Cancel absent. 0.90: height 94 %, content ~90 % and ~8 pt low, Continue landed, Cancel first visible at ~30 %. 0.95: settled (scrim ~27 %, Cancel 100 %); the CTA ends ~15 pt above its page slot. Exit (scrim tap ≈2.52): 2.55 tray ~55 % tall and ~50 % translucent, content still top-pinned and clipped by the falling edge, Continue ~53 % back to full width over a fading 'Can…', scrim ~40 % of its value. 2.60: scrim and tray gone, Continue ~95 % wide and back at its page y, warning note back. 2.65 settled.

**Timing.** Entrance 0.80→0.95 = 150–200 ms (4 frames). Body content 0.85→0.95 (lags the shape by one frame); Cancel 0.90→0.95, last. Scrim in step with the shape. Exit 2.55→2.60(–2.65) = 100–150 ms, shape and opacity together. Confidence: high (±50 ms).

**Easing.** Height 33 / 72 / 94 / 100 % per 50 ms: heavy ease-out, ~2/3 of the travel in the first 100 ms, no overshoot (top edge identical 0.95→2.50). CTA x-travel 28 / 70 / 100 % on the same curve, slightly ahead. Exit ≈55 % in the first frame then done: same curve compressed, plus a fade.

**Corrections vs the coarse pass.**
- The tray does NOT grow in width from the button rect; it is full width in the first frame and only the top edge and the CTA's x animate.
- Entrance 150–200 ms (not 200–250); exit 100–150 ms (not 250–300).
- Arrival order: slab + scrim → body content (+50 ms) → Cancel (+100 ms); Cancel is not concurrent with the slab.
- The CTA rises ~15 pt into the tray, not "nearly the same y".
- On exit the tray body fades (~50 % at mid) as well as shrinking; content stays top-pinned and clipped both ways.
- Press feedback here is a tint over 200 ms; the 0.955 scale could not be confirmed.

**In Wavlength.** Destructive or committing actions ('Leave party', 'End party for everyone', 'Clear tonight's log', 'Stop listening'): show the slab at full width at once, animate only its height from the CTA up (≈180 ms, heavy ease-out), slide the CTA into the right half on the same curve, fade body 50 ms later and Cancel 100 ms later; dismiss in ≈120 ms with shape and opacity together.

## 09 — Tray-to-full-screen container transform: one ~250 ms spring drives top edge, inset, radius and shared rows (~110 pt glide); the background recedes early; all text crossfades at fixed origins
*Essay section:* SIMPLICITY / trays can start a flow that becomes full screen (New Wallet → Add Existing / Create New) — keep

**What happens.** Release on 'Add Existing' ≈0.82. 0.85: tray top up ~8 px (5 %). 0.90: top edge 38 % of the way to the status bar, side inset 24→13 pt, stacked-cards hero at ~20 % under the header, Wallets page behind starting to recede (~0.97). 0.95: top 86 %, inset ~5 pt, page behind at ~0.92 and dim; 'New Wallet' header ~40 % out, 'Add an Existing Wallet' ~40 % in; 'Add Existing'/'Import' and 'Create New'/'Restore' overlap at the same left origin while the two row containers glide up. 1.00: card at the status bar with the display-sized radius; close-x swaps right→left by crossfade (both ≈50 %); hero ~70 %. 1.05: shape final, content ~90 % and ~4 px low, scrim corners still visible. 1.10: scrim corners gone, content settled. Rows travel ≈110 pt (screen y ≈612→503 pt). Collapse (release ≈2.05): 2.10 card 49 % of the way down, inset ~13 pt, large corners, hero ~80 %, rows gliding with overlapping labels, left close-x fading over the returning header; page behind at ~0.92 and scaling up. 2.15 77 %, page at 1.0; 2.20 90 %, hero ~20 %; 2.25 97 %; 2.30 tray at rest, rows a frame later. Create New → Choose Wallet Group repeats it: expand 3.20 30 % / 3.25 74 % / 3.30 94 % / 3.35 99 % / 3.40 done (progress dashes and pale Continue fade in 3.30–3.45); collapse 4.45 11 % / 4.50 38 % / 4.55 73 % / 4.60 89 % / 4.65 96 % / 4.70 100 %.

**Timing.** Expand: shape 200–250 ms, content +50 ms, scrim removed ~50 ms after landing. Collapse 250–300 ms, rows lagging by ~1 frame. Background to 0.92 within the first ~100 ms of the expand and back to 1.0 within ~100–150 ms of the collapse — it leads the card both ways. Confidence: high (±50 ms), consistent across both legs.

**Easing.** Expand remaining distance 62 → 14 → 3 % (each frame removes ~75 % of what is left): hard ease-out, no overshoot on edge or insets. Collapse leg 2 has a soft start (11, 38, 73 %) then the same decay: a critically damped spring from rest, ~280 ms. Edge, inset, radius, row positions and background scale read as one curve; opacity crossfades are ~150 ms and finish before the shape.

**Corrections vs the coarse pass.**
- Expand 200–250 ms and collapse 250–300 ms, not 400–450 / 350–400.
- Rows glide ~110 pt, not ~40 pt.
- The background recede is not in step with the card: it leads (done in the first ~100 ms) and un-scales early on collapse.
- The side inset finishes slightly ahead of the top edge (tiny travel, same curve).
- Close-x side swap is a ~100 ms crossfade at 0.95–1.05; the hero fades in over ~150 ms from the first motion frame.
- "Square corners one sample later" is the scrim corners disappearing ~50 ms after landing, not a radius animation.

**In Wavlength.** Keep the coarse uses (Log track tray → full-screen lyrics; 'Join or start a room' → room setup; 'Your night is ready' → Recap story). One ≈250 ms critically damped spring drives top edge, inset, radius and shared-row position; text and controls crossfade ~150 ms at fixed origins; scale the page behind to 0.92 within 100 ms and lift the scrim right after landing.

## 11 — Context-preserving tray unfolds from the CTA in ~180 ms; top-pinned steps crossfade in ~150 ms with a persistent token; the fee counts up; ~120 ms collapse back into the button
*Essay section:* SIMPLICITY / trays preserve context (swap approval unfolds from the swap UI; first-use tutorial blended in) — keep

**What happens.** Press 0.35–0.55. At 0.60 the dark tray is already 61 % of its final height and ~97 % of its width (only ~10 pt wider than the button per side); scrim ~30 %; keypad rows still visible above; hero at ~40 %. 0.65: height 91 %, scrim ~60 %, title/body ~80 %. 0.70: 96 %, scrim full (~65 %). 0.75: settled, Continue ~8 pt above its page slot. Content is pinned to the tray top. Story: nothing moves until ~1.02 (a ~270 ms hold); the token slides right inside the pill 1.05 (55 %) / 1.10 (85 %) / 1.15 (88 %) / 1.20 (100 %, ≈90 pt) and the lock brightens/unlocks at ~1.50. Step 1→2 (release ≈2.22): 2.25 height 60 % of a ~27 pt growth, both titles at ~50 % at different y (new ~20 pt higher), pill/lock/plus-circles fading while the TOKEN persists and translates ~27 pt up to the ring centre; 2.30 height done, old title ~15 %; 2.35 clean. Continue never moves. Step 2→3 (release ≈4.22): 4.25 'Allow Access' layout ~50 % over old ~50 %, the single Continue already mid-split (white pill sliding right, 'Cancel' ghost left); 4.30 split done, old ghost ~30 %, top edge 27 % of ~29 pt; 4.35 old gone, 73 %; 4.45 settled. Loading: dim '$0.00' until 4.55, then the value COUNTS 0.01, 0.09, 0.28, 0.67, 1.95, 2.36, 2.55, 2.64, 2.65 (4.60→5.00) while brightening; spinner→check and Confirm turns white at 4.70–4.75, ~150 ms after the count starts. Cancel (release ≈6.27): 6.30 tray ~55 % tall, ~50 % opaque, scrim ~90 % lifted, label already 'Continue' with a faint Confirm ghost; 6.35 full-width Continue over a ~15 % remnant; 6.40 settled.

**Timing.** Unfold 150–200 ms (scrim in step). Step change: crossfade 100–150 ms, height 150–200 ms. Collapse 100–150 ms, scrim leading. Story: 270 ms hold, 200 ms slide, unlock +300 ms. Count-up 450 ms. Confidence: high (±50 ms).

**Easing.** Unfold 61 / 91 / 96 / 100 %: heavy ease-out, no overshoot (edge static 0.75→2.20). Token slide 55 / 85 / 88 / 100: ease-out. Count-up increments 0.01, 0.08, 0.19, 0.39, 1.28, 0.41, 0.19, 0.09, 0.01: symmetric ease-in-out. Old content leaves faster than new arrives (15 % vs 90 % at +100 ms).

**Corrections vs the coarse pass.**
- Unfold 150–200 ms (not 300–350); step changes 150–250 ms (not 300–350); collapse ~120 ms (not 300).
- Tray is ~97 % wide in the first frame; width does not progress with height.
- The fee is a 450 ms ease-in-out count-up, not $0.00→$1.95→$2.65 jumps; Confirm enables as the count starts.
- The token is a shared element across steps 1→2 (translates while everything else crossfades).
- The story animation begins only after a ~270 ms hold.
- On Cancel the scrim lifts ahead of the tray; the relabel is essentially done in the first frame.

**In Wavlength.** Keep the coarse mapping (first-mic tray from the Listen button; party-start tray from the CTA). ~180 ms unfold at full width from frame one; per step, 120 ms crossfade and ~180 ms height with content top-pinned; keep the waveform/room-code glyph alive between steps; count the chorus countdown up over ~450 ms ease-in-out and enable the CTA as the count starts; collapse in ~120 ms with the scrim leaving first.

## 12 — Button-anchored options tray: ~180 ms growth with content top-pinned behind a bottom-pinned CTA, ~120 ms collapse with the scrim leading, and a shared-prefix relabel that runs with the fee crossfade
*Essay section:* SIMPLICITY / tray takes the flow's theme; FLUIDITY / 'Continue → Confirm' label morph — keep

**What happens.** 0.00→0.20 the fee ticks $3.28→3.32 one cent per frame (linear, 200 ms), no layout shift. Press 'Options ⌄' 1.40–1.55. At 1.60 the #1E1E1E tray is ~45 % tall and already full width (~24 pt inset); its header, 'ENS Configuration' row and first checkbox are at ~90 % — content pinned to the tray top and clipped, with the Continue pill drawn OVER it (the first row's text is cut off behind the pill). Scrim ~20 %. 1.65: height 74 %, scrim ~50 %, three rows. 1.70: 96 %, scrim at its ~64 % final, Continue at its tray slot (~16 pt above the page slot). 1.75 settled. The CTA reads ~20 pt BELOW the page slot at 1.60–1.65 and then jumps up at 1.70: the tray's bottom edge (CTA attached) rises in the last 100 ms while the top edge does most of its travel in the first 50 ms. No page scale. Checkbox taps (2.60, 3.30, 4.10): blue fill + check between two frames, no bounce. Close (release ≈5.12): 5.15 tray ~42 % tall and ~50 % opaque hugging the button, page ~90 % bright, fee row already '$10.21 Suggested' at ~80 % with a 'Normal' ghost, pill reading 'Confirm' + Face ID glyph with a faint 'ue' tail ('Con' stays, 'tinue' fades, 'firm' + glyph fade in). 5.20: tray gone, Confirm at the page slot, fee clean. 6.75→6.85 (no visible tap) the reverse: fee and label crossfade back to '$3.28 Normal' / 'Continue' over 3 frames, both texts overlapping at 6.80.

**Timing.** Open 1.58→1.75 = 150–200 ms (45 / 74 / 96 / 100 %); scrim 150 ms in step. Close ~100–150 ms; scrim 90 % lifted at the first frame. Label morph and fee crossfade 100–150 ms, both times. Checkbox <50 ms. Confidence: high; the CTA's 20 pt dip medium (1–2 px at this scale).

**Easing.** Heavy ease-out on the top edge, no overshoot (identical 1.75→5.10). Collapse ~60 % gone in the first frame, exponential. Tray opacity and scrim run on a shorter curve than the shape.

**Corrections vs the coarse pass.**
- Open 150–200 ms, close 100–150 ms (coarse: 250–300 / 250–350).
- Tray is full width from frame one; only the top edge (and finally the bottom edge/CTA) moves.
- The CTA does not simply rise 16 pt: it sits ~20 pt lower while the tray grows, then lands 16 pt above — it rides the tray's bottom edge.
- Content does not fade in separately; it is top-pinned and clipped, CTA layered above.
- Scrim leaves ahead of the tray on close.
- '$3.28→$3.32' is a per-frame linear count, not one swap.

**In Wavlength.** Keep the coarse use ('Song options' tray from the now-playing '⋯' with the Listen CTA as its primary; #1E1E1E surface, 60–65 % scrim, no page scale). ~180 ms height animation, content top-pinned and clipped behind a bottom-pinned CTA; ~120 ms collapse with the scrim first; 120 ms shared-prefix label morph running together with any dependent value crossfade ('Resync' → 'Resynced' with the offset value updating in the same beat).

## 13 — Height-morphing tray stack: every step is a ~180 ms bottom-anchored height change; old content stays in screen space, scales ~1.05, blurs and fades while new content rides the top edge; CTA pinned; ghost values count up
*Essay section:* SIMPLICITY / dynamic tray system (Refuel flow, one tray per step, different heights) — keep

**What happens.** Bottom edge fixed in all 241 frames. Row checks (0.75→0.80, 1.15→1.20): the check scales in from a dot over 2 frames. Choose Chains → Choose Amount (release ≈1.88, +27 pt): 1.90 top edge 10 %, old rows ~60 %, new chips ~30 %; 1.95 top 60 %, old rows ~40 %, ~1.05× and soft, chips ~60 %; 2.00 top 90 %, old ~15 %, new ~90 %; 2.05 clean. 'Choose' stays solid while 'Chains'/'Amount' crossfade. Continue crossfades to pale in the same 150 ms. Chip select: ring in 2 frames; $2→$5 (3.80) is a ~100 ms crossfade of two rings, no slide; Continue re-enables over 100–150 ms. Custom (release ≈4.82, +200 pt): top edge 32 / 82 / 93 / 97 / 100 % (4.85→5.05). The OLD title stays at its screen y while the edge rises past it (offset from top grows 10→34 px); the NEW title sits 14 px under the moving edge every frame. Digit '1' (5.50–5.60): '0' rolls up and out, '1' rises from below, ~150 ms; '2' (5.90–5.95): new digit rises while '$1' shifts left, ~100 ms; Continue enables 100 ms later. Custom → Review (release ≈6.52, –75 pt): 6.55 top 28 %, 6.60 89 % with the '$12' ghost at its ORIGINAL screen y (22 px above a top-pinned position), ~40 %, 1.05×, Review content ~75 % riding the edge; 6.65 100 %. Review → Refuel Address (7.75–7.90, –69 pt): 12 / 50 / 80 / 100 %, 'Continue'→'Confirm' crossfading mid-way. Close-x pops one level (8.80–8.95: 15 / 81 / 92 / 100 %). Review → Refuel Gas (9.85–9.95, +29 pt): 36 / 91 / 100 %; Continue splits into Cancel + pale Confirm within 2 frames. Loading: ghost '$0.00 / Normal' at ~30 % held 9.90→10.55 (650 ms); then 0.14, 0.33, 0.99, 1.17, 1.30, 1.34, 1.35 (10.60→10.90) while brightening; Confirm turns blue at 10.60–10.65. Cancel (11.80–11.95) collapses the whole stack to Choose Chains: the vacated upper region fades (Settings shows through at ~40 % at 11.80) while Refuel Gas content leaves enlarged and Cancel/Confirm widen back into one Continue.

**Timing.** Every step change 150–200 ms (10 / 60 / 90 / 100 or 30 / 85 / 95 / 100 % per 50 ms) whether the delta is 27 or 200 pt; the crossfade ends with the height. Digit roll 100–150 ms; check/ring 100 ms; CTA enable 100–150 ms; ghost hold 650 ms, count-up 350 ms, Confirm ~100 ms after the count starts. Confidence: high (±50 ms).

**Easing.** Hard ease-out, no overshoot (settled offsets identical for 20+ frames). Old opacity leaves faster than new arrives (40 vs 60 % at mid). Count-up increments 0.14, 0.19, 0.66, 0.18, 0.13, 0.04, 0.01: ease-in-out.

**Corrections vs the coarse pass.**
- Step changes 150–200 ms, not 300–400; crossfade and height end together.
- Old content is NOT pinned to the tray top: it stays at its screen position, is clipped by the moving edge, scales ~1.05 and blurs; only new content rides the edge. This contradicts cross-clip rule 4.
- Fee: 650 ms ghost hold then a 350 ms count-up, not a ~1 s tick; CTA enables at the count's start.
- Titles use a shared-word morph, chip rings crossfade, checks scale in.
- Cancel on the last step pops to the first tray, not one level.

**In Wavlength.** Keep the party-setup / karaoke-assignment stacks and the ghost-value mapping for 'finding lyrics…' and 'CHORUS IN --s'. Each step: one ~180 ms ease-out on height, new content top-pinned, old content screen-fixed with 1.05× scale + blur + fade, CTA bottom-pinned crossfading enabled/disabled; hold skeletons dim, then count up over ~350 ms ease-in-out and enable the CTA as the count starts.

## 15 — Journey-map shared element: hero card → surface (~250 ms spring) → nav chip (~275 ms, size leads position) and back; neighbours are pushed by the card, not crossfaded; titles cross-slide ~160 pt
*Essay section:* FLUIDITY / onboarding journey map (card travels, becomes the surface, shrinks into a breadcrumb chip; close↔back glyph; directional title cross-slide) — keep

**What happens.** Step A (release ≈0.72). 0.75: nav already '×'; the card has moved ~10 px down and grown, ↓ badge ~50 %, 'Paste from Clipboard' inside at ~70 %; OLD title and rows ~40 % and pushed DOWN ~10 px; 'Import Wallet' ~40 % at its final left-aligned spot. 0.80: card 58 % of travel, ~60 % of size change; old content ~20 % and ~20 px lower; new title 80 %. 0.85: 87 %; 'Input Manually' and pale Import fade in. 0.90 95 %, 0.95 98 %, 1.00 rest. Step B (release ≈1.88): 1.90 card 87 % wide / 81 % tall, still green, centre barely moved; 'Enter Your Phrase' appears ~160 pt right of its slot while 'Import Wallet' starts left. 1.95: card 55 % size, fill already pale, centre 25 % to the nav; keyboard 28 % up; old 'Import' pill fades at the page slot while a pale 'Continue' pill is already above the keyboard's landing zone (two pills visible). 2.00: 31 % size, 59 % position, pill gone; titles ~48 pt offset at ~50/50; keyboard 60 %. 2.05: chip ~12 % size, 81 % position; keyboard 82 %. 2.10: chip in the nav (97 %), titles landed; 2.15 rest. Reverse ‹ (release ≈3.32): 3.35 chip 27 % size, 13 % down, keyboard static; 3.40 55 % / 42 %, keyboard 29 % down; 3.45 80 % / 67 %, paste pill re-forming ~60 %, keyboard 56 %; 3.50 card at rest, keyboard ~gone; a ≤1-frame ~5–8 px upward wobble reads at 3.55 (low confidence). Reverse × (release ≈4.47): 4.50 nav already '‹'; card still full width but 30 % of the way up, badge ~60 %, 'Add an Existing Wallet' and rows ~30 % about 200 pt BELOW their slots; 4.55 card 75 % width, 67 %, list 55 % there; 4.60 width final, 93 %, list 78 %; 4.65 rest.

**Timing.** Card → surface ~250 ms (18 / 58 / 87 / 95 / 98 / 100 %). Card → chip 250–300 ms (position 4 / 25 / 59 / 81 / 97 / 100; size 87 / 55 / 31 / 12 / 10 %). Title cross-slide 200–250 ms over ~160 pt. Keyboard 250 ms (28 / 60 / 82 / 98 / 100). Chip → card 200–250 ms; card → hero ~200 ms (30 / 67 / 93 / 100). Nav glyph ≤50 ms at the tap. Confidence: high; the two-pill CTA crossfade medium.

**Easing.** Card → surface: spring with a long tail (87 % at 100 ms, then 100 ms of settle). Card → chip starts from rest (4 → 25 → 59 → 81 → 97), size and colour leading position. Reverse legs plain ease-out. No clear overshoot except the doubtful 3.55 read.

**Corrections vs the coarse pass.**
- 250 ms (not 350–450) into the surface; 250–300 ms (not 400–500) to the chip; reverses 200–250 ms.
- Hero band and rows do not fade "without sliding": they are pushed ~50 pt down as the card grows and rise ~200 pt back as it shrinks.
- Title cross-slide is ~160 pt (≈40 % of width), not ~40 pt.
- Card→chip: size and fill change first (pale by +100 ms), then position; the chip arrives from larger and lower.
- CTA: 'Import' fades at the page slot while 'Continue' fades in above the keyboard's landing zone, rather than one pill gliding.
- Nav glyph swaps within one frame; no stroke rotation visible at 20 fps.

**In Wavlength.** Keep the wave-card journey (Sign in → mic surface → now-playing card → nav chip in Party/Log). One ~250 ms spring for the card, pushing neighbouring content instead of crossfading it; desaturate and shrink before translating to the chip; cross-slide screen titles ~40 % of the width over ~220 ms; swap the nav glyph instantly on tap.

## 16 — Card-to-stepper collapse: the whole card (words included) scales into the nav bar in ~280 ms with size leading position; text swaps sequentially in place; the second dash is added 200 ms after landing
*Essay section:* FLUIDITY / onboarding journey map, backup variant (hero card becomes the first stepper segment) — keep

**What happens.** Release ≈0.62. 0.65: card ~80 % size, ~15 % of the ~345 pt path to the nav bar, its 12 words still drawn inside (the card scales as one piece, nothing crossfades on it); title/body ~90 %; Continue and keyboard untouched. 0.70: size 41 %, travel 48 %, words legible; old text ~50 %; Continue starts rising and crossfades to pale; keyboard 15 % up. 0.75: size 18 %, travel 74 %; old text ~15 %; keyboard 45 %. 0.80: an 8 × 3 px pink pill, travel 86 %; old text gone; 'Choose Password' NOT yet visible (~50 ms gap); keyboard 76 %. 0.85: dash ~10 px low (92 %), new text ~50 %, field ~30 %, keyboard 95 %. 0.90: dash final at the nav-bar centre, new text ~80 %, keyboard and Continue final (Continue ≈250 pt above its page slot). 0.95 text 100 %. 1.10: a second grey dash appears to the right and the pink one shifts ~10 px left to centre the pair — within one frame. Reverse (release ≈2.52): 2.55 dash gone, card already 31 % size and 44 % of the way down with its word rows visible, 'Choose Password' ~50 %, keyboard 40 % down, Continue turning pink and dropping; 2.60 59 % / 70 %, old text ~15 %, keyboard 60 %; 2.65 80 % / 88 %, 'iCloud Backup' ~50 %, keyboard 80 %; 2.70 95 % / 95 %, keyboard gone, Continue at the page slot; 2.75 98 %; 2.80 rest. Nav glyph is '‹' in both states.

**Timing.** Forward 0.62→0.90 = ~280 ms (travel 15 / 48 / 74 / 86 / 92 / 100 %; size 80 / 41 / 18 / 9 / final). Old text out ~150 ms, ~50 ms gap, new text in ~150 ms: sequential, in place, no slide. Keyboard ~220–250 ms starting 60–80 ms after release; Continue glides with it and goes pale in the first 100 ms. Second dash +200 ms after landing. Reverse ~280 ms (44 / 70 / 88 / 95 / 98 / 100); keyboard ~220 ms; text again sequential (~120 out, ~150 in). Confidence: high (±50 ms).

**Easing.** Ease-out with a long tail both ways (≈75 % at 150 ms, then ~130 ms settle); size ahead of position on the same curve. No overshoot: the dash arrives from below, the card on return from smaller and higher. The first reverse frame already covers 44 %, so the return starts with velocity, unlike clip 15's from-rest chip flight.

**Corrections vs the coarse pass.**
- Nav bar reached in ~250–280 ms and settled by 0.90, not "350 ms / 500 ms"; reverse settles at +280 ms, not +520.
- The card is scaled whole, words visible down to ~18 %; no content crossfade inside it.
- Second dash at +200 ms (not 150); the pair re-centres within one frame.
- Text: ~150 ms out, ~50 ms gap, ~150 ms in.
- Keyboard starts 60–80 ms after the tap; Continue rides it as a single pill (unlike clip 15's two-pill crossfade).

**In Wavlength.** Keep the coarse uses (room card → first setup dash; Recap cover → header while stepping; now-playing card → header chip when lyrics go full screen). Scale the real card widget along a ~280 ms ease-out path with size leading position, swap page text sequentially in place (150 out / 150 in), and add the next stepper segment ~200 ms after landing.

## 17 — Stack-of-cards journey map: stack collapses to the chosen card in ~220 ms; the card becomes the surface (size first, then position) and dissolves into the input around a persistent label; rows are pushed in the navigation direction (80–220 pt); hero → stepper is a crossfade, not a scale
*Essay section:* FLUIDITY / onboarding stack-of-cards journey map — keep

**What happens.** Import (release ≈0.78). 0.80: the blue FRONT card drops ~8 px and shortens, old rows ~30 %, nav still ×. 0.85: green back card now in front and larger, yellow/blue peeking under its bottom edge; nav ‹; title fixed; subtitles crossfade; old rows ~15 % and ~35 pt UP; new rows ~40 % about 150 pt BELOW their slots. 0.90: yellow/blue gone, rows 66 pt low. 0.95: ↓ badge scales in (~60 %), rows 24 pt low. 1.00 rest. Private Key (release ≈1.52): 1.55 card widening and dropping, badge ~50 %, paste pill ghost; 1.60 card at full size but only 39 % of its ~190 pt descent, 'Import Wallet' 60 % in place, old title/rows ~40 % pushed ~37 pt DOWN; 1.65 75 %; 1.70 89 %; 1.75 96 %; 1.80 rest. Input Manually (release ≈2.32): 2.35 nav ×→‹ within one frame; card 84 % tall, fill ~70 %; keyboard 15 % with the pale Import riding it. 2.40 fill ~30 %, height 48 %, the dotted rows have risen out of the card (~185 pt) to the input slot with a cursor; 2.45 fill ~15 %, height 32 %, the white pill gone but its LABEL persists and lands as the 'Paste from Clipboard' link ~53 pt above its pill position; keyboard 74 %; 2.55 rest. Back ‹ (release ≈3.27): 3.30 nav ×, mint fill ~40 % re-forming around the label, height 49 %; 3.35 87 %; 3.40 card 100 %, keyboard 74 % down; 3.50 keyboard gone. Back × (release ≈3.97): 4.00 nav ‹; card 20 % up, badge ~60 %; 'Add an Existing Wallet' and rows ~220 pt BELOW at ~40 %, 'Import Wallet' fading in place; 4.05 63 %, content 120 pt low; 4.10 card home, content 55 pt low; 4.20 rest. Existing Index (release ≈4.77): 4.80 nav ×; 4.85 hero card ~85 % size, ~50 % opacity, ~55 pt higher, both titles overlapping at one y, new rows ~90 pt low; 4.90 card GONE, green stepper pill in the nav at ~70 %, a badge ghost fading; 4.95 pill + 3 dashes 100 %; 5.05 rest; pale Continue fades in 4.90–5.00. × (release ≈5.77): 5.80 nav ‹, stepper ~70 %; 5.85 card re-emerging at 55 % of its descent, title riding just under its bottom edge, rows ~35 pt low; 5.90 79 %; 5.95 93 %; 6.00 rest. ‹ (release ≈6.47): 6.50 nav ×, yellow band under the green card, old rows ~40 % and 140 pt DOWN; 6.55 blue front card grows up from the stack's bottom, new Import/Restore rows ~80 pt ABOVE their slots, old rows 250 pt down; 6.60 stack complete; 6.65 rest.

**Timing.** Stack→card 200–250 ms; card→surface 250–300 ms (39 / 75 / 89 / 96 / 100 %, size done by +100 ms); card→input 200–250 ms, keyboard 250 ms; back steps 150–250 ms (49 / 87 / 99 / 100 %). Card→stepper crossfade ~150 ms. Row push settles in ~250 ms (150 → 66 → 24 → 0 pt). Nav glyph ≤50 ms after release, every time. Confidence: high (±50 ms); push distances medium (±20 pt).

**Easing.** Ease-out everywhere, no overshoot (card rests on identical pixels for 20+ frames). Size and colour lead position on card morphs; the first frame carries 20–50 % of the travel on back steps.

**Corrections vs the coarse pass.**
- Incoming content does not arrive "10–16 pt low": it is pushed 80–220 pt in the navigation direction (forward: new from below, old exits up; back: new from above, old exits down).
- Hero → stepper is a crossfade with ~55 pt drift and slight shrink, not a shrink-to-dash morph (contrast clip 16).
- Card → input: the fill fades over ~200 ms while the height collapses around the persisting label; the dotted rows rise ~185 pt to become the entry lines.
- Steps 200–300 ms, not 300–400; nav glyph swaps in the first frame after release.
- The stack collapse starts with the FRONT card dropping; the badge is last (+150 ms).

**In Wavlength.** Keep the three-card onboarding stack and the room-card → code-slots → stepper chain. Card morphs with size/colour leading position (~250 ms); push sibling rows vertically in the navigation direction with an ease-out settle; keep a text label alive across a surface-to-input dissolve; hand off to a header stepper with a 150 ms crossfade rather than a scale-down.

## 18 — Container transform (row → sheet → row) with same-frame background blur, a 150 ms chart path morph, per-digit roll, and a scale-to-dismiss drag clamped at 0.90
*Essay section:* FLUIDITY: spatial continuity (keep); also the price-chart range morph and rolling number.

**What happens.** Ring on the Polygon row 0.30–0.50 s; nothing moves while pressed. At 0.55, in one frame: the row lifts into a white shadowed card (still showing row text), the list behind is already blurred and dimmed, the '+' FAB fades. 0.60: the card spans ~70 % of the screen, grown up and down from the row; the row text sits faded at its top while 'Polygon $0.89 ↓1.56%' fades in below (crossfade). 0.65: top edge at the top of the screen, bottom ~90 pt short, device-radius corners, tabs and Balance/Value in place, chart line a faint (~25 %) low-amplitude trace. 0.70: bottom ~40 pt short. 0.75: full height, Swap/Send visible, line ~40 %. 0.80: line ~85 %, near full amplitude. 0.85: line full, end dot + halo. Corners square by ~0.90.
Range 1D→1W: ring 1.80–1.90; at 1.95 the line is a point-by-point blend, 1D pill faded, 1W lit, percentage digits mid-roll; line settled 2.05; '↓10.82%' settled 2.15. 1W→1M: change 3.10, line done 3.20, roll done 3.30. 1M→1Y: change 4.00, line 4.15, roll 4.25 (only '68'→'50' rolls; '21.' stays).
Dismiss: finger rests on the chart 4.70–4.95 (no change). 5.00 sheet ~0.98 with rounded corners, 5.05 ~0.95, 5.10 ~0.92, 5.15 ~0.90; 5.15–5.45 the finger keeps moving but scale holds at ~0.90, centre barely moves, backdrop is the blurred list. Release ~5.45. 5.50: row text ghosting at the card top; 5.55: card ~½ height, row text ~60 %, header ~50 %; 5.60: ~¼ height near the row slot; 5.65: row-sized card, header ghost under it; 5.70: it is the row, list nearly sharp; 5.75 sharp.

**Timing.** Open: 0.55→0.70 = 150 ms for ~95 % of the growth, full at 0.75–0.80 (200–250 ms), corners square ~350 ms. Chart fade+grow 0.65→0.85 (200 ms), starting ~100 ms after the lift. Range: line 150 ms (3 frames), pill crossfade ≤100 ms, digit roll 200–250 ms ending ~100 ms after the line. Collapse: release→row 200–250 ms; blur clears in 250–300 ms. Confidence high (medium for the release frame).

**Easing.** Open is front-loaded: ~70 % of the height in the first frame, ~95 % by the third, 100 ms settle; the top edge lands a frame before the bottom. No overshoot. The path morph is a near-linear 3-frame blend. Dismiss scale is finger-driven with a hard floor at ~0.90; the collapse is ease-out (half the height in the first 100 ms).

**Corrections vs the coarse pass.**
- Open is ~250 ms, not 450–550; corners square at ~350 ms, not ~800.
- Blur+dim start in the same frame as the lift.
- Row text crossfades into the header over ~100 ms during growth.
- Range morph 150 ms (not 250–350); digit roll 200–250 ms (not 350–450).
- Drag scale is clamped at ~0.90; it does not keep following the finger. Collapse 200–250 ms, not 350–450.

**In Wavlength.** Now-playing card → full lyrics sheet: blur+dim Listen the frame it lifts, 250 ms open, lyric content fading in ~100 ms later; Log row → track detail the same way. Drag-down scales to a 0.90 floor then collapses back into its origin in ~220 ms. 'CHORUS IN 12s' per-digit roll ~220 ms, only changed digits moving; Recap range switch as a 150 ms path morph.

## 19 — Directional tab swap: a tiny cross-slide (outgoing ~10 pt, incoming ~5 pt) with fade under a pinned header, 100–150 ms; FAB scales to ~0.3; empty-state arrow
*Essay section:* FLUIDITY: directional tab switching (keep); also DELIGHT's animated arrow.

**What happens.** Tokens → Browser (right tab): ring 0.55–0.75, first change 0.70, settled 0.75. In the one mid frame the outgoing page ('Benji' header, 'Tokens Collectibles $623.58', list) is ~30 % opacity and shifted LEFT: sub-header ~10 pt, rows ~10–14 pt, header ~4 pt. The incoming Browser page (search pill, 'Suggested', grid, empty state) is ~65 % and shifted RIGHT: pill ~8 pt, grid ~5 pt. The compass icon is already filled black and the wallet icon outlined in that frame. The '+' FAB is a ~0.3-scale dot at its own centre at 0.70, gone at 0.75.
Browser → Tokens (centre tab): mid frame 1.80: outgoing Browser ~35 %, shifted RIGHT 10–18 pt; incoming Tokens ~70 %, only ~2 pt LEFT of final. '+' is a ~0.3 dot at 1.80, full at 1.85.
Tokens → Activity (left tab): mid 2.65: outgoing 'Tokens Collectibles' ~11 pt RIGHT, rows ~6 pt, ~35 %; incoming 'This Week' ~8 pt LEFT, rows ~2 pt, ~65 %. The shared 'Benji' header is crisp with no ghost: pinned, not slid. '+' ~0.8 and faded at 2.65, gone 2.70.
Activity → Tokens: mid 3.75: outgoing rows ~7 pt LEFT; incoming 'Tokens' ~15 pt RIGHT, rows ~2 pt. '+' ~0.3 at 3.75, ~0.9 at 3.80, full 3.85.
The empty-state arrow is drawn on progressively over ~0.5 s after the page lands and keeps cycling slowly (~1.5 s; low confidence).

**Timing.** Every switch has exactly one mid frame and is settled in the next: 100–150 ms (2–3 frames). FAB scale in/out: same 100–150 ms window. The tab icon flips at or before the first content frame. Confidence: high on the bound and direction; medium on distances (3× zoom, ±3 pt).

**Easing.** At the mid frame the incoming layer is ~80–90 % home while the outgoing is ~20 % into its travel and ~65 % faded: incoming runs a fast ease-out, outgoing mostly fades with a small drift. Sub-header text travels ~2× further than list rows (mild parallax). No overshoot.

**Corrections vs the coarse pass.**
- The directional slide IS there: tap right → content moves left, tap left → content moves right. It is tiny (5–18 pt) and ≤150 ms, which is why the 0.19 s step missed it.
- Duration 100–150 ms, not an unknown '<190 ms'; FAB shrinks to ~0.3 in 100–150 ms, not to a 6 pt dot in 200–250 ms.
- Headers that differ (Benji row vs search pill) slide and fade with the page; the shared header is pinned.
- Rows slide 2–14 pt; the coarse 24–40 pt recommendation is ~3× too far.

**In Wavlength.** Shell bottom nav (Listen / Party / Log): 120 ms switch, incoming from the tapped side at ~8 pt with fast ease-out, outgoing drifting ~10 pt the other way and fading in the first 100 ms, room header pinned. Floating mic button scales to 0.3 + fades in the same 120 ms where it doesn't apply. Keep the drawn-on arrow for the Log empty state pointing at Listen.

## 20 — Symmetric cross-slide between steps (~120 pt each way on one shared curve, outgoing fades first), a ≤100 ms × ↔ ‹ glyph morph, a 100 ms stepper handoff, and a button that rides the keyboard
*Essay section:* FLUIDITY: the close/chevron → back-arrow morph between steps (keep). Also the stepper and the button gliding with the keyboard.

**What happens.** Forward (ring on Continue 0.55–0.75, first change 0.70). 0.70: outgoing page (title, subtitle, wallet rows) ~20 pt left at ~85 %; incoming ('Name Your Wallet', 'Test' field with caret) ~110 pt right at ~20 %; glyph still ×. 0.75: outgoing −70 pt / ~30 %, incoming +58 pt / ~60 %; glyph already a clean ‹; stepper segments 1 AND 2 both blue. 0.80: −105 / ~15 % vs +21 / ~90 %; only segment 2 lit. 0.85: −115 / ~8 % vs +8. 0.90: settled (~5 % ghost far left). Both layers overlap unclipped; total travel ~120–140 pt each (≈0.3 width).
The Continue button never slides. From 0.70 it rises with the keyboard: −53 pt (0.75), −140 (0.80), −200 (0.85), −235 (0.90), −270 settled at ~1.05; the button–keyboard gap stays ~50 pt.
Back (ring on ‹ 2.05–2.20 and 5.05–5.20): mirrored. 2.25: incoming 'Choose Wallet Group' ~65 pt LEFT (C clipped at the edge) at ~40 %, outgoing +44 pt at ~50 %, glyph already ×; 2.30: −50 vs +107 / ~25 %; 2.35: −9 vs +120 / ~15 %; 2.40 settled with a +145 pt ~5 % ghost. Keyboard drops 2.20→2.45 with the button following. The second forward (3.65–3.85) and back (5.20–5.40) repeat these numbers within one frame.

**Timing.** Cross-slide 200–250 ms (4–5 frames) both ways. Glyph morph ≤100 ms (× at 0.70, finished ‹ at 0.75; already × in the first changed frame on back). Stepper handoff ~100 ms with a one-frame double-lit state. Keyboard + button 300–350 ms, ~50 % in the first 100 ms. Confidence: high on durations, ±8 pt on offsets.

**Easing.** Progress per 50 ms ≈ 15 %, 55 %, 85 %, 95 %, 100 % for BOTH layers: one ease-out / critically damped curve, no overshoot. Opacity is asymmetric: outgoing 85→30→15→8→5 % (gone in ~100 ms), incoming 20→60→90→100 % over 150 ms.

**Corrections vs the coarse pass.**
- No parallax: outgoing travels as far as incoming (~120–145 vs ~110–130 pt) on the same curve; the coarse mid-frame caught the outgoing early. Drop the '+100 in / −30 out' recipe.
- 200–250 ms, not 300–400.
- Glyph morph is ≤100 ms and done before content is halfway, not 'together' with it.
- Button–keyboard glide is 300–350 ms, front-loaded, constant gap.

**In Wavlength.** Multi-step flows (Sign-in, Party setup, karaoke assignment): both layers ±120 pt over 220 ms on one ease-out, outgoing opacity to 0 in ~100 ms, incoming in over 150 ms; × → ‹ as a ≤100 ms stroke morph on tap; pinned WavButton rides the keyboard inset with a constant gap and never slides sideways.

## 21 — Shared-value handoff in ~200 ms: the hero number scales 1.0→0.28 while flying to its row slot; the layer it replaces (keypad) vanishes first, header rows leave last; the anchored button morphs its label in ~120 ms
*Essay section:* FLUIDITY: 'Continue' → 'Confirm' shared-letter morph on the amount → confirm step (keep).

**What happens.** Forward (ring on Continue 0.50–0.70; 0.60–0.65 unchanged). 0.70: '$1.00' is ~50 % along its path (+70 of +132 pt x, +50 of +93 pt y) at ~0.6 scale; '♦ 0.00030067' is ~50 % along its own path to the 'Send ETH' slot on the same curve. The keypad is ALREADY gone (≤10 %). 'Send ×', 'To James' and the Ethereum row are still 100 %. Confirm content fades in under it: title ~25 %, flame avatar ~15 %, row labels ~15 %. Button: Face ID glyph ~50 % in on the left, label shifted ~8 pt right, 'tinue'/'firm' overlapping 50/50 ('Confinue'). 0.75: value ~88 % at ~0.4 scale; confirm content ~65 %; 'Send' ghost ~20 % with '‹' ~25 % over it; 'To James' ~15 %; Ethereum row ~30 % with 'From … Benji' ~50 % over it; label 'Confirm' ~90 % with a faint 'e' ghost. 0.80: value in slot (~0.28 of hero size), '‹ ?' full, Ethereum row gone, label clean. 0.85 settled. The pill's y and width never change.
Back (ring on ‹ 2.40–2.60). 2.60: value ~40 % of the way back at ~0.6 scale while the confirm title, rows and avatar are still 100 %; ~10 % keypad ghost. 2.65: value ~75 %, ~0.85 scale; outgoing ~40 %; incoming 'Send ×' ~50 %, Ethereum row ~40 %, keypad ~50 %; label 'Contirue'. 2.70: value ~95 %; outgoing gone bar a ~15 % 'Review the above' ghost; incoming ~90 %. 2.75: value settled; the '↑↓' after the ETH amount fades in last (full at 2.80).

**Timing.** Forward ~200 ms: value flight ≈150 ms (50 → 88 → 98 → 100 %); keypad out ≤100 ms; header/To/Ethereum rows out 0.70→0.80, starting ~50 ms after the value; confirm content in 0.70→0.80; label morph 100–150 ms. Back 200–250 ms: value 2.60→2.75; outgoing holds ~50 ms then fades in 100 ms; incoming over 150 ms. Confidence: high.

**Easing.** Value flight 50 %, 88 %, 98 %, 100 % per frame: strong ease-out, no overshoot, position and scale on one curve; the ETH sub-value tracks it exactly. Fades ~linear over 2–3 frames. Label re-centres ~20 pt on the same ease-out.

**Corrections vs the coarse pass.**
- Forward is ~200 ms, not 300–350; the value is halfway in the first frame after the tap.
- Mid-frame scale ~0.6 and final ~0.28 of hero size, not 'shrunk to ~0.7'.
- The keypad (the layer the value flies over) disappears first (≤100 ms); header rows hold 100 % for one frame then fade in 100 ms. Context does not fade uniformly.
- Reverse: nothing takes 300 ms; the value lands ~50 ms before the context finishes.
- 'Send/×' → '‹/?' is a 100 ms in-place crossfade, not a morph.

**In Wavlength.** First recognition on Listen: hero title flies into the now-playing title slot in ~150 ms (scale on the same curve as position), the layer under it (mic prompt) drops out in the first 100 ms, surrounding chrome crossfades in 100 ms starting one frame later; CTA pill anchored, 'Listen' → 'Listening' → 'Resync' morphed in ~120 ms with the icon fading in from the left. Recap totals flying into story cards use the same 200 ms envelope.

## 22 — Shared-letter morph: fades start one frame before the slide, shared glyphs then travel in ~150 ms on an S-curve, entering glyphs fade in over ~200 ms with no scale, exiting glyphs leave a 5–15 % ghost tail for ~150 ms after the word has settled
*Essay section:* FLUIDITY: the shared-letter text-morph component (keep).

**What happens.** Four runs measured at 4× zoom; both forward runs (0.55, 3.30) and both reverse runs (2.05, 4.70) agree within one frame.
Craft → Creative (tap ~0.55): 0.60 (+50 ms): no shared glyph has moved (C still at its Craft x), but the exiting 'f' is already ~50 % and the entering 'v','e' are ~30 % at their FINAL x; 'e','i' not yet visible. 0.65: C and r are at their Creative x (each ~27 pt LEFT of where they were), 'a' and 't' are mid-travel, 'e' ~50 % between r and a, 'f' ~30 %, 'ive' ~65 %. 0.70: positions ~98 %, entering glyphs ~85 %, 'f' gone. 0.75: settled. Because the longer word stays centred, EVERY shared glyph moves left: C, r ≈ 27 pt, a ≈ 7 pt, t ≈ 27 pt (t loses 'f' and gains 'e' ahead of it). Nothing moves vertically; entering glyphs do not visibly scale.
Creative → Craft (Reverse, tap ~2.05): 2.10 (+50): no movement; 'e','i','v','e' dimmed to ~80 %, 'f' ~20 % in. 2.15: C ~45 % of its rightward travel, 'f' ~50 %, exiting 'e/ive' ~40 %. 2.20: positions ~85 %, exits ~25 %. 2.25: 'Craft' settled; 've' ghost ~15 %. 2.30: 'e' ghost ~10 %. 2.35: ~5 %, then gone. Run 4 (4.70–5.00) is identical frame for frame.

**Timing.** Slide: ~150 ms of travel, ending 200 ms after the tap frame (0 % at +50, 45–85 % at +100, 85–98 % at +150, 100 % at +200). Fades start at +0–50 ms, i.e. ~50 ms BEFORE the slide. Enter fade ~200 ms (30 → 65 → 85 → 100 %). Exit fade: to ~50 % in 50 ms, ~25 % at 150 ms, then a 15 → 10 → 5 % tail until ~+300 ms, i.e. ghosts persist ~100–150 ms after the word is legible as settled. Confidence: high on frame counts, medium on pt distances (±4 pt).

**Easing.** Position is S-shaped (nothing in the first 50 ms, most of the travel in the next 50), which reads as a spring with a slow first frame or an ease-in-out of ~120–150 ms; no overshoot in any run. Enter opacity is near-linear; exit opacity is ease-out with a long tail. Because fades lead the slide, the word starts to 'change' before it starts to 'move'.

**Corrections vs the coarse pass.**
- 'a and t shift right' is wrong: all four shared glyphs shift LEFT when the word grows (mirrored when it shrinks), by 7–27 pt.
- The slide is ~150 ms, not 200–300; fades begin ~50 ms before it, not with it.
- Exit ghosts trail ~100–150 ms after the slide, not 50–100 ms; enter fades are ~200 ms, longer than the slide, not 'similar'.
- No visible scale on entering glyphs.

**In Wavlength.** morph_text.dart for short labels ('Listen' → 'Listening' → 'Resync', status line, 'CHORUS IN 12s' → 'CHORUS NOW', 'Invite' → 'Invite 3'): opacity tweens start immediately (enter 200 ms linear, exit fast to 25 % by 150 ms with a soft tail), position tween delayed ~50 ms and ~150 ms long with an ease-in-out/spring, no scale, word kept centred so shared glyphs re-flow around the inserted ones. Long song titles still get a crossfade.

## 23 — Count-aware CTA (only the changed word crossfades, shared words slide a few pt), a row that resets by pushing a same-geometry skeleton up from below, a 100–150 ms skeleton→real crossfade, and a toast that blur-crossfades INTO the nav bar in place of the stepper
*Essay section:* FLUIDITY: wallet-count button text (keep). Also the in-place skeleton row and the toast.

**What happens.** (1) 0–0.85 s: CTA disabled, pale 'Add Wallet'. (2) Ring on the row's 'Add' pill 0.85–1.05. 0.95–1.00: pill fill lightens (pressed). 1.05: pill widened, pale tint, 'Added' ~40 % over 'Add'; the CTA is still pale but its label is already re-spaced ('Add  Wallet') with a '1' at ~30 %. 1.10: 'Added' ~90 %; CTA ~80 % saturated, '1' full. 1.15: settled. The pill leads; the CTA follows ~100 ms behind.
(3) Row reset 1.85→2.05: at 1.90 the 'Added' content has moved UP ~10 pt at ~60 % while a same-size skeleton card ('#' tile, two bars) rises from ~25 pt BELOW at ~50 %; a small green tally dash appears in the left gutter in this frame. 1.95: old ~25 % at −15 pt, skeleton ~80 % at +5 pt. 2.00: settled. (4) '3' typed ~2.3: tile shows '3' at once; ring spinner in the trailing slot 2.55→3.90. 3.95: address and '0 ETH' ~50 % over the bars, pale 'Add' ~40 % over the spinner; 4.00 ~90 %; 4.05 full; zero layout shift. (5) Second add (ring 4.35–4.50): 4.50 'Added' ~50 %, CTA reads 'Add 2 Wallets' with only '2' and 's' at ~60 %; 4.55 full. (6) CTA pressed 6.55 (scale ~0.97). 6.65: incoming '2 Wallets Added' ~25 % at +75 pt, outgoing title ~80 % at −5 pt, 'Im' ghost left of 'Add 2 Wallets', stepper segment 3 lighting. 6.70: +20 pt / ~80 % vs −25 pt / ~40 %, keypad ~50 %, 'Im/Add' overlapping. 6.75: +3 pt / ~95 %, keypad ~20 %. 6.80: settled; '2 Wallets' has slid ~17 pt right to re-centre. (7) Toast 'Added 2 Wallets': 6.95 nothing; 7.00 blurred pill ~40 % centred in the NAV BAR row where the stepper was; 7.05 ~85 %; 7.15 crisp. It stays ~1.5 s; on back (8.50–8.65) it blurs out (8.55 ~80 %, 8.60 ~40 %, 8.65 gone, stepper back) while the page cross-slides back in 150–200 ms and the CTA crossfades to pale 'Add Wallet'.

**Timing.** Pill tint 150 ms, width 100 ms, text 150 ms. CTA enable colour 100–150 ms starting ~100 ms after the pill. '1' insert ~100 ms; '1'→'2'+'s' ~100 ms. Row reset 150 ms vertical push, ~0.8 s after 'Added'. Skeleton→real 100–150 ms. Step change ~200 ms; label morph ~150 ms. Toast in ~150 ms (~150 ms after the step lands), out ~150 ms. Confidence: high.

**Easing.** Step cross-slide ease-out (+75 → +20 → +3 → 0; outgoing fades faster than it moves). Fades near-linear over 2–3 frames. Skeleton rises ease-out (25 → 5 → 0 pt). No overshoot; pressed CTA scales ~3 %.

**Corrections vs the coarse pass.**
- 'Add'→'Added' is not instant: 150 ms tint + width + text crossfade.
- CTA enable fade 100–150 ms, not 300–400.
- The row does not reset in place: old content pushes up ~15 pt and fades while the skeleton rises from ~25 pt below; the tally mark appears in that frame ('filed left' holds, medium confidence).
- Step change is a ~200 ms clip-20-style cross-slide (~80–100 pt); the label's shared '2 Wallets' slides ~17 pt, it does not stay put.
- The toast lives in the nav bar and replaces the stepper via blur-crossfade; it is not a layer under the Dynamic Island.

**In Wavlength.** Now-playing skeleton (art glyph, two bars, trailing spinner) with a 120 ms in-place crossfade to real metadata; 'Assign 1 line' → 'Assign 2 lines' crossfading only the changed glyphs (~100 ms) with shared words sliding via AnimatedSize; moment banner as a blur-crossfaded pill that takes over the header row for ~1.5 s rather than stacking above it.

## 24 — One persistent card glides ~130 pt vertically on the same 250 ms ease-out that pushes both text layers ±120 pt horizontally; CTA and nav glyphs crossfade in place
*Essay section:* FLUIDITY: elements travel between screens without duplicating (keep); also the directional push.

**What happens.** Forward, iCloud Backup (ring 0.50–0.70; first change 0.65). Card top edge per frame: +47 pt, +86, +110, +124, +127, final ~+130; no width or scale change. In the same frames the OUTGOING page (title, subtitle, both option rows, footnote) slides LEFT as one layer: −39 pt at ~90 %, −70 at ~50 %, ~−90 at ~25 %, ~−100 at ~15 %, ~−120 at ~8 %. The INCOMING page ('iCloud Backup' + subtitle, 'Copy to Clipboard', shield note) arrives from the RIGHT on the same curve: +87 pt at ~30 %, +39 at ~75 %, +14 at ~90 %, +2, 0. Nav '‹' and '?' fade in without moving (~40 %, ~80 %, full). The purple 'Continue' pill is at its final position and size from 0.65: ~35 %, ~70 %, ~90 %, full at 0.80, while the footnote fades out under it (50 %, 15 %, 0).
Back (ring on ‹ 1.55–1.75; first change 1.65): card −8 pt (8 %), −62 (57 %), −84 (78 %), −97 (90 %), −102 (95 %), settled ~1.90. Outgoing 'iCloud Backup' goes RIGHT +14 → +77 → +108 → +120 pt at 100 → 50 → 25 → 10 %; incoming title from the LEFT −47 → −20 → −6 → 0 at 40 → 70 → 90 → 100 %. 'Continue' fades out in place while the footnote returns.
Manual Backup (first change 2.70) is identical; its first frame is a slow start (card +8 pt, incoming ghost at +123 pt / 15 %), then 50 %, 77 %, 90 %, 95 %, 100 % over 2.75–2.95. Back at 3.90–4.10 mirrors it, with a ~5 % 'Manual Backup' ghost lingering at +105 pt until ~4.10.

**Timing.** 250 ms (5 frames) from first change to settled, every direction. Nav glyph fade ~150 ms. CTA/footnote crossfade ~150 ms, starting in the first frame. Confidence: high (card edge measured at 3× zoom, ±3 pt).

**Easing.** Card and both text layers share one curve: ≈35 %, 65 %, 85 %, 96 %, 100 % per 50 ms (the two 7–8 % first frames are tap-phase, not ease-in). Ease-out / critically damped, monotonic, no overshoot. Outgoing opacity falls ~2× faster than incoming rises (100→50→25→10 vs 30→75→90→100).

**Corrections vs the coarse pass.**
- The first frame after a tap shows the card at 35–50 %, not 90–95 %.
- Outgoing content travels ~120 pt, the same as incoming, not 'about 20 pt'; it only looks short because it is ~25 % opaque by 90 pt.
- Card travel ~130 pt (coarse 110–120), width unchanged: confirmed. CTA and nav glyphs never move: confirmed, fade ~150 ms.

**In Wavlength.** Now-playing card → lyrics/song view: the art + title block is the one persistent element (AnimatedPositioned, 250 ms ease-out); step copy in a Stack cross-slides ±120 pt (≈0.3 width) on the SAME curve, outgoing opacity to 0 in ~100 ms, incoming in ~150 ms; WavButton and header glyphs crossfade in place over 150 ms. Same recipe for Sign-in → mic-permission → mode-pick with the mic orb persisting.

## 25 — Direction-aware tab cross-slide: each tab's content is one layer that travels ~100–120 pt on a shared 200–250 ms ease-out, outgoing fading 2× faster than incoming; the CTA and footer link stay in place; the tab label colour flips instantly
*Essay section:* FLUIDITY: directional tab switching and constant-vs-changing empty states (keep).

**What happens.** Tokens → Collectibles (ring 0.65–0.90; first change 0.85): in that first frame 'Collectibles' is already black and 'Tokens' grey (no colour tween). Outgoing Tokens layer (Ethereum row, two skeleton rows, 'There's nothing here, yet' + body): 0.85 ≈ −22 pt at ~90 %; 0.90 ≈ −90 pt at ~35 %; 0.95 ≈ −110 pt at ~10 %; 1.00 gone. Incoming Collectibles layer (two skeleton tiles, 'Nothing to see here, for now' + body): 0.85 ≈ +100 pt at ~20 %; 0.90 ≈ +53 pt at ~75 %; 0.95 ≈ +20 pt at ~95 %; 1.00 at 0. Tiles and text carry identical offsets, so each tab is a single sliding layer. 'Learn more about tokens' → 'about collectibles' crossfades in place (both visible at 0.95). The 'Receive' pill, '$0.00', header, FAB and bottom nav are pixel-identical in every frame.
Collectibles → Tokens (ring 2.10–2.30; first change 2.30): mirrored. 2.30: incoming row + text ≈ −72 pt at ~35 %, outgoing text ≈ +57 pt at ~70 %, tiles ≈ +37 pt at ~50 %; 2.35: incoming ≈ −30 pt at ~85 %, outgoing ≈ +100 pt at ~25 %; 2.40: incoming ≈ −12 pt, outgoing ghost ≈ +120 pt at ~10 %; 2.45 settled.
Second forward (first change 4.05): outgoing ≈ −41 pt at ~65 %, incoming ≈ +97 pt at ~40 %; 4.10: −93 pt / ~15 % vs +27 pt / ~85 %; 4.20 settled. Second back (first change 5.50): outgoing +10 pt / ~90 %, incoming −80 pt / ~25 %; 5.55: +70 / ~40 % vs −55 / ~50 %; 5.60: +100 / ~15 % vs −22 / ~90 %; 5.65: incoming −9 pt; 5.70 settled.

**Timing.** 200–250 ms from first changed frame to settled (4–5 frames) in all four runs; where the first frame shows little travel it is tap-phase, not a delay. Tab label colour: instant. Footer link crossfade ≈150 ms. Confidence: high on duration and direction; medium on distances (±8 pt; start offset inferred as ~110–120 pt).

**Easing.** Both layers on one ease-out: ≈20 %, 55–75 %, 85–95 %, 100 % per 50 ms. Opacity is asymmetric: outgoing 90 → 35 → 10 → 0, incoming 20 → 75 → 95 → 100. No overshoot; nothing scales.

**Corrections vs the coarse pass.**
- Travel is ~100–120 pt for BOTH layers, not 40–80 pt with the outgoing 'travelling further'; the outgoing merely fades sooner.
- Duration 200–250 ms, not 250–300.
- The skeleton tiles/rows move with their text as one layer (no stagger).
- The 'Learn more…' link is also constant-position: it crossfades in place, like the Receive pill.

**In Wavlength.** Party tabs (People | Moments | Lines), Log (Tonight | All nights), and the Normal/Party segmented control: AnimatedSwitcher keyed by tab with direction = sign(new − old); both children slide 0.3 × width on one 220 ms ease-out; outgoing opacity 1→0 over the first ~120 ms, incoming 0→1 over ~150 ms; the constant CTA ('Record a moment', 'Start listening') and footer help link live outside the switcher; tab label colour swaps with no tween.

## 26 — Dark bottom-anchored tray whose height morphs in 150–200 ms; the page's button row is absorbed into it (up ~13 pt, outer edges in ~15 pt, Confirm→Continue), buttons pinned to the tray's bottom edge; info sub-trays crossfade content and X returns to the parent; scrim ~65–70 %, no blur
*Essay section:* SIMPLICITY dynamic tray system (keep); also FLUIDITY's buttons gliding across trays.

**What happens.** Open (ring on 'Transaction Request ⓘ' 0.60–0.80; first change 0.80). 0.80: a dark-grey tray already ~200 pt tall stands behind the button row, exactly as wide as the page's cards and buttons (~22 pt side inset, bottom edge ~36–40 pt above the screen bottom); it shows 'Transaction Preview ×', the verified banner and the buttons, whose label still reads 'Confirm' with the scan icon; page ~80 % bright. 0.85: ~400 pt, content ~90 % with the bottom rows still clipped above the buttons; label 'Continue' ~80 % with an icon ghost; page ~45 %. 0.90: ~485 pt, all rows visible; page ~35 %. 1.00: settled (~505 pt), page ~30 %, status bar undimmed, no blur. The buttons moved up ~13 pt and their outer edges in ~15 pt (inner gap unchanged) over 0.80–0.90; the tray's width never changes.
Estimated Time (ring 2.10–2.30; first change 2.30): top edge +30 pt (16 % of the ~180 pt shrink), old rows ~70 % with the paragraph ghost ~20 % over them, buttons ~80 %. 2.35: 68 %, titles crossfading 50/50, buttons GONE, the dimmed mint.fun card appearing above. 2.40: 97 %. 2.45: settled; bottom edge and width unchanged.
X back (first change 3.90): 21 %, 63 %, 89 %, 98 %, 100 % over 3.90–4.10; rows fade in at their final positions; buttons fade in during the last ~100 ms.
Verified banner (first change 5.10): 47 %, 81 %, 96 %, 100 % over 5.10–5.25 (shrink ~310 pt); the paragraph fades in AT the banner's position while the blue pill fades out; buttons gone in the first frame. X back (6.80–7.10): 10 %, 56 %, 84 %, 95 %, 98 %, 100 %; buttons ~60 % at 6.90, full at 6.95.
Scrim tap (ring 8.25–8.50; first change 8.45): tray height −35 %, page ~60 % bright, 'Continue' → 'Confirm' begun (icon ~30 %); 8.50: tray is a ~125 pt strip (title + buttons), page ~90 %; 8.55: tray gone, buttons back at their page x/y with the scan icon, page 100 %.

**Timing.** Open 150–200 ms (46 % at the first frame). Tray→info-tray morphs 150–200 ms. X-back 200–250 ms with a ~100 ms settle tail. Dismiss 150 ms. Button glide + label morph 100–150 ms. Scrim in/out in step with the tray (~150 ms). Buttons on info trays vanish within ~100 ms of the tap and return in the last ~100 ms of the parent's growth. Confidence: high.

**Easing.** Height per 50 ms ≈ 45 %, 75 %, 95 %, 99 %, 100 % (open) and 16–21 %, 63–68 %, 89–97 %, 100 % (morphs): ease-out, no overshoot; only the TOP edge moves. Content is a pure ~150 ms crossfade; scrim opacity tracks the height curve.

**Corrections vs the coarse pass.**
- Open 150–200 ms, morphs 150–200 ms, dismiss 150 ms — not 300–450 ms.
- The tray is exactly the page card/button-row width (~22 pt inset); it neither floats '8 pt from the sides' nor grows '7 % wider'.
- Buttons shrink from their OUTER edges and rise ~13 pt; they are pinned to the tray's bottom edge, fade out within ~100 ms on info trays and back in during the last ~100 ms of growth.
- On the Verified Domain tray the banner is replaced in place by the paragraph, a positional handoff.
- Scrim ~65–70 %, status bar undimmed, no blur: confirmed.

**In Wavlength.** 'Song details' tray on dark Listen: same width as the now-playing card, bottom edge fixed ~36 pt up, AnimatedSize height on a 180 ms ease-out with only the top edge moving; 'Resync'/'Wrong song?' absorbed from the page in 120 ms (rise + outer-edge inset + label morph); sub-trays crossfade content in 150 ms, hide the action row within 100 ms, X returns to the parent; barrier Colors.black ~0.68, no BackdropFilter.

## 27 — Button-to-tray morph: the tray grows up from the CTA with opaque content pinned to its top edge (no fade-in); the CTA lifts ~15 pt and its label gains a word
*Essay section:* FLUIDITY: buttons morph into trays (and trays collapse back into the button). Keep.

**What happens.** Two identical cycles (tap 0.25 s / X 1.35 s; tap 2.65 s / X 3.95 s). Open: the touch ring sits on Confirm for 3 idle frames with no press-scale (pill width identical 0.15–0.40 s). At 0.45 s a dark-grey tray already exists at 50 % of its final height (top edge 0.76 of screen height, final 0.56) with the "Max Slippage ×" header *pinned to the moving top edge*, the stepper at its final offset below the header and therefore partly hidden behind the white pill, and the caption clipped. Content is fully opaque from this first frame; nothing fades in. 0.50 s: 85 %. 0.55 s: 98 %. 0.60 s: settled. Width grows 0.865 → 0.915 of screen (≈ 10 pt per side) on the same frames. The pill does not stay put: its top rises 0.901 → 0.884 (≈ 15 pt) over 0.45–0.55 s and it widens ≈ 6 pt to sit inside the tray inset. Label: 0.45 s "Confirm" still centred with a low-alpha "Slippage" overlapping its right end; 0.50 s both words at final positions, scan icon ~30 %; 0.55 s icon gone. Scrim: page-title brightness 24.5 → 18.2 → 11.9 → 9.4 → 9.0 (0.40 → 0.60 s) – dims to 36 % on the tray's curve.
Close: tray untouched until 1.45 s; 1.50 s top edge at 0.66 (76 % height), caption already covered by the pill riding up; 1.55 s 36 %; 1.60 s 18 %; 1.65 s gone. The label is slower: scan icon back over 1.50–1.55; "Slippage" ghosts 100 → 50 → 30 → 15 → 5 % from 1.50 to 1.70 s while "Confirm" slides right to re-centre. Scrim lifts 1.50–1.65 s.

**Timing.** Open 4 frames = 150–200 ms (height 50–60 / 85–89 / 98 / 100 % in both cycles). Close 4 frames = 200 ms (76 / 36 / 18 / 0 % and 60 / 28 / 17 / 0 %). Label morph 150 ms on open, ≈ 250 ms on close, outlasting the tray by 1–2 frames. Scrim 200 ms both ways. Confidence: high (two cycles agree to one frame).

**Easing.** Open is strongly front-loaded (≥ 50 % in the first 50 ms, 85–90 % by 100 ms) – critically damped spring / easeOutQuart, no overshoot (top edge never passes 0.561). Close is flatter (25–40 % first frame, 32–40 % second) – a spring from rest, not a mirror of the open. Scrim shares the open curve exactly (40 / 40 / 16 / 3 %).

**Corrections vs the coarse pass.**
- Content does not crossfade in: it is opaque from frame one and is *revealed* by the growing clip (header pinned to the top edge, pill covering the middle). The coarse "fade content in from 30 % progress" is wrong.
- The pill is not "constant to within 1 pt": it lifts ≈ 15 pt and widens ≈ 6 pt.
- Open is 150–200 ms, not 210–250; close is 200 ms on a flatter curve, and the label ghost lingers to ~250 ms.
- No press-scale during the ~150 ms hold; width animates too (86 → 92 % of screen).

**In Wavlength.** Resync → offset tray and "Next song" → skip-confirm tray: one bottom-anchored RRect springing from the pill's rect to the tray's (height and width), header pinned to the top edge, CTA pinned to the bottom with a ~15 pt lift, content opaque and clipped rather than faded; open ~180 ms front-loaded, close ~200 ms, word-diff label with the added word fading 150 ms in / 250 ms out.

## 28 — Baseline modal sheet: a rigid, opaque block slides up from below the screen on the same 4-frame curve as the "with" take; the trigger pill is covered and pops back with no transition
*Essay section:* FLUIDITY with/without comparison: swap approval, the "without" take. Keep (now high confidence: 28 and 29 share tap frame, scrim curve and settle frame, so they were shot as a matched pair).

**What happens.** Ring on Continue from 0.20 s; 3 idle frames. 0.40 s: the "Allow Access" tray is on screen as one rigid piece, top edge at 0.69 of screen height (final 0.32), content opaque and at its final offsets from the top edge, Cancel/Confirm still below the screen. 0.45 s: 0.43. 0.50 s: 0.34. 0.55 s: 0.32, settled. Nothing inside the tray moves relative to it. The Continue pill is never seen after 0.35 s – covered, not morphed. Scrim: "Swap" title brightness 63.8 → 46.7 → 28.7 → 23.7 → 22.4 → 20.5 (0.35 → 0.60 s), so the page ends at 32 % brightness (≈ 68 % black), dimming on the slide's frames.
Loading: the pill's ring spinner turns 0.60–1.00 s, blurs/fills over 1.05–1.10 s and is a check at 1.15 s (2-frame crossfade). In the same 100 ms the fee row brightens from ~30 % and counts $0.00 (1.00) → 0.05 → 0.15 → 0.39 → 0.98 → 1.11 → 2.04 → 2.27 → 2.41 → 2.46 → 2.47 (1.65 s), decelerating. Confirm goes grey → mid-grey (1.10) → white (1.15), starting one frame after the fee.
Dismiss: ring on the scrim at 1.85 s; tray unmoved through 2.05 s. 2.10 s: top at 0.65 (48 % off). 2.15 s: 0.89 (83 %). 2.20 s: 0.975 (96 %) – and the Continue pill is already fully drawn above that last sliver. 2.25 s: clean. Scrim 20.5 → 42.3 → 56.1 → 61.7 → 63 over 2.05–2.25 s.

**Timing.** Open 4 frames = 150–200 ms (45 / 84 / 97 / 100 %). Dismiss 4 frames = 200 ms (48 / 83 / 96 / 100 %). Spinner → check 100 ms; fee brighten 100 ms; count-up 600 ms; Confirm enable 100–150 ms; loading resolves 0.65 s after settle. Confidence: high for tray and scrim, medium for the count values.

**Easing.** Strong ease-out / critically damped spring both ways (≈ 45–50 % in the first 50 ms, ≈ 85 % by 100 ms), no overshoot (top edge never passes 0.318). Scrim follows the same curve (39 / 42 / 12 / 3 % in, 51 / 32 / 13 / 3 % out). The count-up is ease-out on the value, not linear.

**Corrections vs the coarse pass.**
- Open is 150–200 ms, not 200–250; the coarse "85 % at 0.45 s" was the second frame – the first is already 45 %.
- The pill is back at 2.20 s while the tray's last 4 % is still visible: an instant show, not sequenced after the tray.
- Scrim ≈ 68 % black (not 65 %), and it animates on the tray's frames.
- Spinner → check is a 2-frame crossfade; fee-brighten, count-start and Confirm-enable fall inside one 150 ms window.
- The curve is identical to clip 29, so the "without" take is not slower or cheaper – only the anchor differs.

**In Wavlength.** Not the tray to ship, but the loading choreography is exact and reusable: pending values at ~30 %, brighten over 100 ms, count up 400–600 ms with ease-out, spinner → check over 100 ms in the same slot, CTA enabled 50 ms later with a 100–150 ms fill fade. Fits the Join-party tray while the room lookup runs.

## 29 — Tray unfolds from the trigger pill on exactly the modal sheet's 4-frame height curve, but its content fades in while it grows and the pill narrows to the right half as Cancel appears; it folds back through a one-frame wrapper capsule
*Essay section:* FLUIDITY with/without comparison: swap approval, the "with" take. Keep.

**What happens.** Ring on Continue from 0.20 s; 3 idle frames. 0.40 s: a dark tray already wraps the button, top edge at 0.66 of screen height (47 % of final; final top 0.32). The "…"/"?" header is pinned to the moving top edge; the unlock icon, title and body sit below it at ~30 % opacity; the Approval card is hidden behind the button row; the pill has narrowed from 0.10–0.90 to 0.27–0.90 with "Continue" and "Confirm" cross-fading in place (no shared-letter slide). 0.45 s: top 0.42 (84 %); content ~70 %; pill at its final right-half rect (0.52–0.92) with the scan icon; "Cancel" ~30 % in the left half. 0.50 s: 97 %; content ~90 %; Cancel ~80 %. 0.55 s: settled, all opaque. Scrim: 63.8 → 47.8 → 29.7 → 23.0 → 22.1 → 20.1 – frame-for-frame identical to clip 28.
Loading: spinner 0.55–0.85 s, fills 0.90, check 1.00 s. Fee counts $0.03 (0.90) → 0.18 → 0.45 → 1.18 → 2.19 → 2.55 → 2.67 → 2.74 (1.30 s). Confirm grey → mid (0.95) → white (1.00).
Dismiss: ring on the scrim 1.85 s. 2.05 s: top edge 0.35 (5 % down – a frame earlier than clip 28). 2.10 s: 0.65 (52 %); content ~40 %; Cancel ghost; pill re-widened to 0.27–0.90 with "Continue" over a fading "Confirm". 2.15 s: 0.84 – a short dark capsule around a full-width white Continue (pill top 0.904 vs 0.899 at rest). 2.20 s: only a dark rim above the pill. 2.25 s: clean. Scrim 20 → 46.7 → 60 → 63 over 2.05–2.20 s.

**Timing.** Open 4 frames = 150–200 ms (47 / 84 / 97 / 100 %); content fade on the same 4 frames (30 / 70 / 90 / 100 %), not delayed; pill split + Cancel fade done in 150 ms. Collapse 200 ms (5 / 52 / 80 / 95 / 100 % from 2.05 s); wrapper capsule visible 1–2 frames. Loading resolves 0.4 s after settle; count-up 400 ms. Confidence: high.

**Easing.** Height curve = clip 28's critically damped spring (≈ 47 % first frame, 84 % second). Content opacity is slightly less front-loaded than the height, so the tray runs ahead of its content. No overshoot on tray top or pill width. Collapse starts slow (5 %, then 47 / 28 / 15 %) – a spring from rest, not a mirror of the open.

**Corrections vs the coarse pass.**
- The pill label is an in-place crossfade "Continue" → "Confirm", not a "Con" shared-letter morph.
- Content fades in during growth (30 → 100 % over 150 ms) – the opposite of clip 27's opaque reveal. Two behaviours exist: opaque-reveal for a short tray (27), fade-in for a tall one (29).
- Cancel fades in from the second frame (0.45 s), not "during the second half".
- Open is 150–200 ms, settled at 0.55 s (not 0.57).
- "With" and "without" share tap frame, height curve and scrim curve exactly; the loading is not "smoother", just different live numbers.

**In Wavlength.** Mic-permission tray from the big mic button, and Join-party pill → join tray: grow from the pill's rect (spring ~180 ms, no overshoot), fade the body 30 → 100 % across the same window, shrink the pill to the right half over 150 ms with Cancel fading in from frame two; on collapse let the pill re-widen inside a one-frame dark capsule before the wrapper dissolves.

## 30 — FLIP re-layout in ~275 ms: every card flies simultaneously on a straight line, the selected card rides on top, headers and the icon↔"Hide Groups" label crossfade on the same clock, and the section below reflows with it
*Essay section:* FLUIDITY with/without comparison: wallet grouping, the "with" take. Keep.

**What happens.** Touch ring on the group icon from 0.85 s; four idle frames. 1.05 s: every card is already ~30 % along its straight path (Family Wallet down-right, Benji down, NFT Vault and Spending down two rows, Fees down one, BFF and Rainy Day up two rows and still hidden under the descending cards); the "Wallet Group 1" header is visible at ~30 %, and the trailing icon is crossfading in place into "Hide Groups" (both visible). The Watching header has dropped ~15 pt. 1.10 s: ~65 %; BFF and Rainy Day have emerged at the top, Benji (selected, blue ring) is drawn over BFF and Rainy Day; Family Wallet is over Fees, NFT Vault over Spending; headers ~60 %. 1.15 s: ~88 %; "Wallet Group 3" visible, Group 6 faint; the label swap is done. 1.20 s: ~95 %, only edge overlaps left (Family Wallet still touching Fees); headers full. 1.25 s: ~99 %. 1.30 s: settled; Watching is off-screen. Cards keep size, no rotation, no blur, no scale, no stagger between cards (all are mid-path in the same frame).
Reverse (ring on "Hide Groups" from 2.45 s): 2.70 s ~35 % (Benji up-right and on top of BFF; BFF and Rainy Day moving down under the black cards; headers ~50 %; "Hide Groups" fading, icon returning); 2.75 s ~65 % (Fees over Lunch Money, NFT Vault over Spending); 2.80 s ~85 %; 2.85 s ~95 %, Watching row rising in from below; 2.90 s ~99 %; 2.95 s settled.
Z-order: the selected card is on top in both directions. For the rest, the forward pass keeps the source list order (earlier card on top); the reverse pass does not mirror it exactly (low confidence – overlaps are brief).

**Timing.** Each re-layout: first moved frame to settled = 5 frames after a ≤ 50 ms start gap → 250–300 ms (progress ≈ 30 / 65 / 88 / 95 / 99 / 100 %). Header fade ≈ 200 ms (30 → 100 % over 1.05–1.20 s), starting with the flight. Icon ↔ "Hide Groups" crossfade ≈ 150 ms in place. Watching row moves on the same clock. Settle tail ≈ 100 ms (95 → 100 %). Confidence: high on duration, medium on per-frame percentages (estimated from card centres).

**Easing.** One shared curve for all cards, headers and the pushed section: front-loaded (≈ 65 % by 100 ms, 88 % by 150 ms) with a soft 100 ms tail and no overshoot – a spring with damping ratio ≈ 0.9–1.0, or easeOutQuart. The header opacity ramp is closer to linear than the position curve.

**Corrections vs the coarse pass.**
- Duration is 250–300 ms, not 350–450 ms; the coarse "settle by 1.43 s" was a whole frame late (settled at 1.30 s).
- The "small 5 pt settle" is the last 1–5 % of the same curve, not a separate phase.
- Z-order is not simply "selected on top of everything mid-flight": the selected card is on top, but non-selected overlaps follow list order forward and are inconsistent in reverse.
- The header icon → "Hide Groups" is an in-place crossfade (~150 ms), not a swap.
- Headers start fading in the *first* motion frame, not after the cards land.

**In Wavlength.** Log grouping (by hour / artist / who added), Party regroup by karaoke part, Recap chapters. Drive all rects, header opacity and the pushed content from one ~275 ms spring (damping ≈ 0.9), no stagger, raise the selected card's z, crossfade the toggle label in place over 150 ms.

## 31 — Hard re-layout (counter-example): confirmed as a true one-frame cut (< 50 ms), with no crossfade of any kind
*Essay section:* FLUIDITY with/without comparison: wallet grouping, the "without" take. Keep.

**What happens.** Same grid, same taps as clip 30. Touch ring on the group icon from 0.30 s; the grid is untouched through 0.50 s. At 0.55 s the grouped layout is fully drawn: three group headers at full opacity, "Hide Groups" at full opacity with the icon gone, Watching already pushed off-screen. There is no frame with any card between slots, no partial header opacity, no partial label. Reverse: ring on "Hide Groups" from 2.40 s; 2.55 s still grouped; 2.60 s fully ungrouped with Watching back in place. Frames 0.60–2.35 s and 2.65–4.10 s are static.
Both cuts land 4–5 frames (200–250 ms) after the touch ring first appears, the same latency as the animated version in clip 30 (ring 0.85 s → first motion 1.05 s), so the latency is touch-up, not animation.

**Timing.** Layout change: < 50 ms (no intermediate frame at 20 fps) in both directions. Confidence: high.

**Easing.** None – a cut.

**Corrections vs the coarse pass.**
- Tighter bound: "instant or a crossfade under 150 ms" becomes "under 50 ms, and no crossfade at all" – the header labels, group headers and Watching row all go 0 → 100 % between consecutive frames.
- Tap times were 0.30 s and 2.40 s (ring first visible), cuts at 0.55 s and 2.60 s.

**In Wavlength.** Still nothing to build; it is exactly what a plain setState on a GridView produces. Its one useful number: the 200–250 ms ring-to-change latency in every clip is release timing, so Wavlength should fire tray/regroup animations on tap-up and not add its own delay.

## 32 — Hard-cut step navigation (counter-example): confirmed as a one-frame cut in both directions, < 50 ms, no fade, no shared element
*Essay section:* FLUIDITY with/without comparison: send flow, amount → confirm, the "without" take. Keep.

**What happens.** Touch ring on Continue from 0.90 s (three frames, 0.90–1.00 s). At 1.05 s the "Confirm transaction to James" screen is complete: chevron and "?" in the nav, green flame icon, Total Value / Send ETH / From rows, fee row already reading $0.77, disclaimer and the "Confirm" pill with its scan icon – all at full opacity, all in final position. Nothing from the Send screen (title, X, "To James" chip, $1.00 hero, keypad) survives even one frame; no ghost of "$1.00" moves toward the Total Value row. The CTA pill stays at the same rect and its label goes "Continue" → "Confirm" in the same cut with no crossfade frame. The fee row updates live while resting ($0.77 → 0.79 at 3.35 s → 0.80 at 3.50 s), so the data is loaded before the cut, not after.
Back: ring on the chevron from 3.45 s (two frames). 3.55 s: the Send screen is complete – "Send" title, X, chip, hero, keypad, "Continue" – with the ring now sitting on "Send". No intermediate frame. The rest of the clip (3.60–5.05 s) is static.
Latency ring → cut: 3 frames forward (150 ms), 2 frames back (100 ms).

**Timing.** Both transitions: < 50 ms (no intermediate frame at 20 fps). Confidence: high.

**Easing.** None – a cut.

**Corrections vs the coarse pass.**
- Bound tightened from "under ~150 ms" to "< 50 ms and no crossfade": the outgoing and incoming screens never coexist in a frame.
- Tap times: 0.90 s and 3.45 s (ring first visible), cuts at 1.05 s and 3.55 s.
- The fee value is present at full opacity in the first confirm frame, so the "without" version also skips any loading choreography – it is a pure route push.

**In Wavlength.** Nothing to build; it is the baseline for the clip 33 shared-value flight. One reusable observation: the CTA rect is identical on both screens even in the "without" take, so a fixed bottom pill across steps is the floor, not the ceiling.

## 33 — Shared value flight in ~175 ms: the hero number shrinks and travels on a straight diagonal, leading an in-place crossfade of everything else by one frame; nav title and chevron swap by opacity at the same x; the CTA keeps "Con" and crossfades its tail
*Essay section:* FLUIDITY with/without comparison: send flow, amount → confirm, the "with" take. Keep.

**What happens.** Forward: ring on Continue from 0.55 s; 3 idle frames. 0.70 s: "$1.00" is ~25 % along its path at ~75 % of its 48 pt size, drifting right and down, the ETH sub-value shrinking with it; the flame icon and "Confirm transaction to James" are ~15 % opaque *in their final positions* (no slide); "Send", the "To James" chip and the keypad still ~100 %; the CTA shows "Continue" with a faint scan icon appearing to its left. 0.75 s: hero ~50 % size, right-aligned above the Total Value row; outgoing ~50 % (keypad ~35 %), incoming ~40 %; the nav reads "‹end" – the chevron fading in exactly where the "S" was while "Send" fades out in place; CTA "Confirm" over a ghost "Continue", the shared "Con" stable, tails crossfading, label shifted ~8 pt right for the icon. 0.80 s: hero at 15 pt, ~5 pt above its slot; incoming ~80 %, outgoing ~10 %. 0.85 s: ~95 %. 0.90 s: done. Keypad digits only fade – no scale, slide or blur.
Back: ring on the chevron 2.70–2.90 s. 2.95 s: hero ~30 % along the return path (55 % size) while the confirm content is still ~90 % and the Send content ~10 % – the hero leads; nav "‹end" again with "S" fading in at the chevron's x. 3.00 s: hero ~85 % size near centre; outgoing ~40 %; chip ~40 %, keypad ~30 %; CTA "Continue" ~80 % over a "Confirm" ghost. 3.05 s: hero ~97 %; keypad ~70 %; outgoing ~10 %. 3.10 s: ~95 %. 3.15 s: done.

**Timing.** Forward 4 frames = 150–200 ms (hero 25 / 50 / 95 / 100 %). Back 4–5 frames = 200–250 ms (30 / 75 / 97 / 100 %). Fades trail the hero by ≈ 1 frame (50 ms), not 50–100 ms. Nav swap and CTA morph occupy the middle 3 frames (150 ms). Confidence: high on frame counts, medium on per-frame percentages.

**Easing.** Ease-out on position and font size together (≈ 50 % by 100 ms, ≈ 95 % by 150 ms), no overshoot in either direction. The two content layers are a plain overlapping crossfade, slightly lagging the hero. Back starts a little slower in its first frame.

**Corrections vs the coarse pass.**
- Forward 150–200 ms and back 200–250 ms, not 300 / 350 ms; the coarse "already at full opacity by 0.82" saw the third frame.
- The hero leads the fades by ≈ 50 ms and everything settles in the same frame; it does not "land first" by 50–100 ms.
- Chevron ↔ "Send" is an in-place opacity swap at a shared x, not a morph of the chevron into the "S".
- The CTA keeps "Con" anchored and crossfades the tails with an ~8 pt shift for the icon; the coarse "blurred" label was low-alpha overlap.
- No blur or scale on leaving content: pure opacity.

**In Wavlength.** Song switch on Listen (outgoing title/artist shrink and fly into the Log mini-row while the new title fades up in place), the "CHORUS IN 12 s" chip flying into the lyrics panel at zero, Log row → track detail: rect + TextStyle tween ~180 ms forward / ~220 ms back with easeOutCubic, surrounding crossfade starting ~50 ms later, nav leading slot swapped by opacity at a fixed x, CTA word-diffed keeping the shared prefix.

## 34 — CTA collapses into a spinner in 150 ms while the recipient avatar flies a straight 250 ms diagonal and becomes the status glyph; later the spinner slides into the tab slot *during* a 250 ms whole-screen crossfade
*Essay section:* FLUIDITY: "a spinner flies into the bottom nav to show where the pending transaction lives". Keep.

**What happens.** Ring on Confirm 0.60–0.85 s; Face ID opens in the island at 0.95 s (system). Nothing moves until 1.25 s, when three things start in the same frame:
(a) Button: 1.25 s fill white → light grey, width 100 → 88 %, label intact. 1.30 s: width 41 %, darker, label ghost, centre lifted ≈ 7 pt. 1.35 s: a ~30 pt ring spinner at the old button centre with a faint capsule ghost. 1.40 s: spinner only. Fill leads width by one frame.
(b) Avatar (60 pt purple, centre 0.20/0.25 of screen): 1.25 s 10 % toward centre, still purple with the face; its check badge stays at the origin and fades. 1.30 s: 43 % along and already the blue paper-plane glyph (recolour + icon swap within ≤ 50 ms), ~68 pt. 1.35 s: 73 %. 1.40 s: 90 %. 1.45 s: 98 %. 1.50 s: landed at 0.50/0.43, 76 pt. x and y progress match frame by frame – a straight path.
(c) Title, rows, fee, disclaimer: 100 % at 1.30, ~50 % at 1.35, ~10 % at 1.40, gone at 1.45 s – a 150 ms fade starting 50 ms after (a)/(b), no slide.
"Starting Your Transaction" fades in 1.40 → 1.50 s. At 1.80–1.95 s "Just a moment." fades in (≈ 40 / 80 / 100 %) while glyph + title lift 8 pt (glyph y 0.383 → 0.374). Face ID check 1.85 s. Spinner holds at bottom-centre until 3.30 s.
Home crossfade: 3.35 s light Home ~45 % with the dark screen (glyph, title, spinner) ~55 %; 3.40 s ~80 %; 3.45 s ~92 %; 3.50 s ~97 %; 3.55 s clean. The plane glyph simply fades with the dark layer. In the same frames the spinner moves from x = 0.50 to the left tab slot at 0.27 (0.47 / 0.38 / 0.29 / 0.27 at 3.35–3.50 s) and drops ≈ 15 pt into the tab-bar row, then spins there for the remaining 3.6 s. Header, list and tab bar never move.

**Timing.** Button → spinner 150 ms. Avatar flight 250 ms (10 / 43 / 73 / 90 / 98 / 100 %). Content fade 150 ms, +50 ms offset. Title fade 100–150 ms. Subtitle fade + 8 pt lift 150 ms, 350 ms after the title. Dark → light crossfade 250 ms (45 / 80 / 92 / 97 / 100 %). Spinner dock 200 ms (13 / 52 / 91 / 100 %), fully inside the crossfade. Confidence: high (bounding boxes and row brightness).

**Easing.** Avatar: spring from rest – slow first frame, ≈ 45 % by 100 ms, long 98 → 100 % tail, no overshoot in position or size. Crossfade: strong ease-out (80 % by 100 ms). Spinner dock: ease-in-out. Button width front-loaded (12 % then 47 % per frame). (a), (b), (c) share a start frame.

**Corrections vs the coarse pass.**
- Button → spinner is 150 ms (not 300–400); the avatar flight is 250 ms (not 350–400); both start at 1.25 s.
- The check badge does not travel; it fades at the origin. Recolour and icon swap happen in one frame early in the flight.
- The spinner docks *during* frames 2–5 of the 250 ms crossfade, landing as the crossfade hits 97 % – not before it.
- Crossfade is 250 ms, not ~400; glyph/title do not linger as a ghost.
- Subtitle appears 350 ms after the title with an 8 pt (not 16 pt) lift.

**In Wavlength.** Post a Moment / Start party: collapse the pill into a spinner in 150 ms (fill first, then width), fly the thumbnail on a straight 250 ms spring to centre, fade the rest 50 ms later over 150 ms, then dock the spinner into the Party tab over 200 ms inside a 250 ms crossfade to the destination. Overlay flight between GlobalKey rects, no route Hero.

## 35 — In-place tray step swap: 200 ms height morph with new content pinned to the moving top edge and old content fading where it was; a 150 ms frosted menu from its anchor; Confirm shrinks into a spinner in 150 ms and the spinner flies back into the status pill in 150 ms, ahead of a 250 ms height morph
*Essay section:* FLUIDITY: "speed-up spinner moves back to the pending tray" (plus SIMPLICITY: trays keep context at different heights). Keep.

**What happens.** Ring on ⋯ from 0.35 s. 0.60 s: the frosted menu is ~60 % scale / ~50 % opacity growing from the ⋯ anchor, with its own backdrop blur from the first frame. 0.65 s: ~90 %. 0.70 s: full. Tray height unchanged (top edge 0.452).
Ring on "Speed Up" 1.20–1.35 s. 1.40 s: menu shrinking (~85 %, ~60 %); rocket + "Try to Speed Up" already ~40 % *in final positions*; "$100.00"/Pending ~60 %; Cancel/Confirm ghosts; top edge 0.456 (27 % of its 19 pt drop). 1.45 s: menu ~30 %; new ~75 %, old ~30 %; edge 0.463 (59 %). 1.50 s: new ~95 %, old ~10 %; edge 0.470 (91 %). 1.55 s: settled at 0.472. Fee shows a faded "$0.00" and pale Confirm until 1.75 s, then counts $0.06 → 0.15 → 0.66 → 0.85 → 0.98 → 1.04 → 1.07 (1.80–2.10 s) as the text turns black and Confirm goes solid blue (1.85 s).
Ring on Confirm 2.60–2.75 s. 2.80 s: labels dimming. 2.85 s: Cancel ~30 % in place; Confirm ~35 % width, pale, sliding to the tray centre with a spinner ghost inside. 2.90 s: a lone spinner at bottom-centre. Face ID 3.95–4.85 s (system).
Return: 4.75 s edge 0.467 (6 % of the 71 pt rise), old content full, spinner still bottom-centre. 4.80 s: edge 0.432 (50 %); "Sending to Alex" header and "$99.97" ~50 % pinned to the *new* top edge; the old rocket/title/body ~50 % *at their old y*; spinner mid-flight near the fee row, moving up-left. 4.85 s: edge 0.405 (84 %); spinner seated in the pill's leading slot, pill reads "Trying to Speed Up"; old ~15 %. 4.90 s: 98 %. 5.00 s: 0.389 – taller than the start (caption added). The list row behind the scrim updates in the same window.
Not in the coarse pass: at 8.20–8.30 s the tray reverts ($99.97 → $100.00, pill → "Pending", caption removed, edge 0.392 → 0.450) with the same pinned-new / fading-old crossfade in 3 frames.

**Timing.** Menu open 100–150 ms; close 150 ms concurrent with the swap. Step swap: height 200 ms (27 / 59 / 91 / 100 %), crossfade 150–200 ms. Fee placeholder → value 300 ms after the step lands, counting 300 ms. Buttons → spinner 100–150 ms. Spinner → pill 100–150 ms (lands at 84 % of the height morph). Return height 250 ms (6 / 50 / 84 / 98 / 100 %). Revert 150 ms. Confidence: high for edges, medium for opacities.

**Easing.** Height morphs are springs from rest: small first frame, ≈ 50 % by 100 ms, ≈ 85 % by 150 ms, no overshoot (edge never passes 0.389). Content crossfade is overlapping and near-linear. Menu: scale + opacity from the anchor, ease-out. Fee count-up decelerates.

**Corrections vs the coarse pass.**
- Everything is faster: menu ≤ 150 ms (not ≤ 340), swap 200 ms (not 300–350), buttons → spinner 150 ms (not ≤ 350), return 250 ms (not 350–400).
- Old content does not ride the top edge; new content is pinned to the new edge while old content fades at its old offset.
- Confirm collapses in width and slides to centre to become the spinner (as in clip 34); Cancel only fades.
- The spinner reaches the pill *before* the tray finishes growing.
- Blur is the menu's own backdrop, not applied to the tray content.
- Missed: the revert morph at 8.20 s.

**In Wavlength.** Now-playing ⋯ → frosted menu (150 ms scale from anchor) → Tray push to a "Re-listen" step: 200 ms height spring, new content pinned to the moving top edge, old fading in place; Confirm shrinks into a spinner (150 ms) which flies into the status pill (150 ms) while the tray springs back (250 ms). Placeholder digits for "CHORUS IN --s" fill in place, no layout shift.

## 36 — Self-drawing skeleton → circular-reveal into the hero card; card ↔ tray container transform; 150 ms directional step slides; 3D flip into a staggered text decode
*Essay section:* DELIGHT: new wallet creation animation (plus the backup-education tray flow: SIMPLICITY/FLUIDITY). Keep.

**What happens.** Tap "I Understand, Continue" (ripple 0.85 s). At 1.00–1.20 s the whole terms screen fades while sliding ~30 pt left (200 ms); the screen is blank white 1.20–1.35 s; at 1.40–1.80 s "Creating Your Wallet" fades in and rises ~100 pt into place with the caption fading in below (400 ms). 1.80–2.25 s: the graph-paper skeleton is not faded in, it *draws* itself — hairline segments extend outward from the centre and join into the rounded-rect grid (450 ms). Hold to 2.55 s. 2.55–3.10 s: purple light *travels along the grid lines* as comet-like traces that accumulate and brighten (550 ms), then 3.10–3.60 s they dim to faint intersection dots (500 ms). 3.75–3.95 s: the finished card (rainbow gradient, bear, address, "Test / 0 ETH" all already rendered) is revealed by a **circular mask expanding from the card's bottom-centre** (200 ms, 4 frames), then 3.95–4.15 s the gradient hue sweeps to the final purple. 4.25–4.45 s: title crossfades to "Your wallet is ready." (underline finishes ~4.50 s), caption fades out and the white "Back Up Now" chip fades in on the card, all together. 4.85–5.00 s: the tooltip pops in (fade + ~90→100 % scale). Card never moves from 3.95 s on.

Tap chip (pressed 6.20–6.40 s). 6.45–6.70 s: **container transform** — the card itself scales up (1.3× at 6.45, tray-width at 6.50 with its address text still legible inside) and its face crossfades into the tray's illustration header; tray title/body fade in from 6.50 s, Continue from 6.60 s; scrim ramps 6.45→6.65 s. Steps: outgoing text slides left ~40 pt while fading, incoming enters from ~30 pt right already ~50 % opaque; illustration crossfades; the tray top moves (height change) while the Continue pill stays pinned at the bottom. Illustrations have their own secondary motion after landing (coins appear 9.40–9.60 s; eye-slash draws 12.45–12.60 s). Label morph 13.45–13.55 s: "Continue" slides left while "To Back Up" fades in, text and illustration changing in the same frames. Tap (14.50–14.70 s) → 14.75–14.90 s **reverse container transform**: the tray shrinks back into the card, scrim fades, and the page underneath has already lost its title/tooltip. 15.45–15.75 s: the card does a **Y-axis 3D flip** (edge-on at 15.55 s) revealing the 12-slot grid; the title "Your Secret Recovery Phrase" fades in during the first half. 15.75–16.95 s: all 12 slots scramble at ~40 % opacity and lock to white one at a time in order 1→12 (down the left column, then the right), ~100 ms stagger, each word's letters locking left-to-right. 17.25–17.60 s: title+card rise ~110 pt; subtitle and the two backup options fade in 17.50–17.70 s, overlapping the rise.

**Timing.** Creation total 1.40→4.45 s (3.0 s). Grid draw 450 ms; traces 550 ms up / 500 ms down; circular reveal 200 ms; hue sweep 200 ms; title swap 150–200 ms; tooltip 150 ms. Container transform 250 ms open, 150–200 ms close. Every step slide 150–200 ms (8.00–8.15, 9.25–9.40, 10.65–10.80, 12.10–12.25, 13.45–13.55 s), starting ~150–200 ms after touch-down (on release). Flip 300 ms. Decode 1.2 s total. Rise 350 ms. High confidence on all (each is ≥3 frames).

**Easing.** Circular reveal front-loaded: radius ≈ 15 → 55 → 85 → 100 % per frame. Container transform: ~90 % of the scale change in the first 100 ms, then settles. Step slides: incoming text covers ~70 % of its travel in the first frame; no overshoot anywhere. The rise is the one ease-in-out-like curve (7, 13, 11, 9, 4, 3, 2 px per frame). Scrim and card share the transform's curve.

**Corrections vs the coarse pass.**
- The skeleton draws itself line by line; the dots are traces travelling along grid lines, not static intersection glows.
- The card is revealed by a circular wipe from its bottom-centre, not a "fill"; content is present from the first frame; a rainbow→purple hue sweep follows.
- Tray open/close is a container transform of the card, not a plain sheet over a scrim.
- Step slides are 150–200 ms, not 300–400 ms; the incoming text starts ~50 % opaque, not 25 %.
- The word grid appears via a 300 ms 3D flip, which the coarse pass missed entirely.
- Decode stagger measured (~100 ms/word, 1.2 s total); unresolved words are dimmed.
- No visible pulse on the iCloud border across 2 s of frames.

**In Wavlength.** First recognition of the night: the now-playing skeleton draws its grid, mic-amplitude traces run along the lines, then the real card is circle-revealed from its bottom-centre with a hue sweep to the album palette; keep the 3D flip for revealing the first lyric card, and decode lyric lines at ~100 ms/line with dimmed unresolved text. Trays that open from a card (song details from the now-playing card) should be container transforms at 250 ms open / 175 ms close; multi-step onboarding trays use 150–200 ms slides with the CTA pinned and "Continue" → "Continue to Party" morphing in the same frames.

## 37 — Radial sequin ripple: a constant-speed shrink-to-nothing front (~550 pt/s) with blue regrowth one frame behind, a black-restoring front 250 ms later, a logo that spins 1.5 turns in 300 ms, and finders that hold blue ~700 ms before a 250 ms fade
*Essay section:* DELIGHT: QR code tap ripple. Keep.

**What happens.** Ring on the centre logo at 0.60 s; the logo greys to ~50 % in that frame (press state) and holds through 0.75 s. Release ≈ 0.80 s: logo tints blue-grey. 0.85 s edge-on (thin vertical sliver); 0.90 face-on blue with a grey ghost; 0.95 edge-on; 1.00 face-on; 1.05 edge-on; 1.10 face-on blue and static thereafter – three half-turns at 100 ms each, one continuous spin.
Dot wave: at 1.00 s the dots within ~40 pt of the logo have shrunk to nothing (a clean white hole). The hole edge is at ~60 pt (1.05), ~75 (1.10), ~100 (1.15), ~130 (1.20) and reaches the card corners (~190 pt) at 1.25–1.30 s: ~150 pt in 250–300 ms ≈ 550 pt/s, constant. Blue dots regrow one frame (50 ms) behind the hole edge, small and light at the front, full-size further in, so each dot's flip (shrink → 0 → regrow blue) takes ~100 ms. At 1.25 s a second front leaves the centre turning blue dots black (radius ~40 pt at 1.30, ~80 at 1.35, ~120 at 1.40, corners at 1.50 s) at the same speed, so each dot holds blue ~250 ms; on the return the dots look full-size in every frame, so it is a colour change rather than a second flip (medium confidence). 1.55 s: all black.
Finders: recoloured as the front passes (1.30–1.35 s) – top two bright blue, bottom-left indigo – hold until 2.05 s, then darken (navy 2.10–2.15, near-black 2.25, black 2.30 s). The logo fades blue → black on the same schedule. Card, labels and Share Address never move.

**Timing.** Press → release 200 ms. Logo spin 300 ms (edge-on at 0.85 / 0.95 / 1.05 s). Outward front 250–300 ms to the corners from 1.00 s; per-dot flip ~100 ms; blue hold ~250 ms; restoring front 250 ms; dots clean 1.55 s. Finder/logo hold ~700 ms then a 250 ms fade; clean 2.30 s. Total ≈ 1.5 s from release. Confidence: high on frame counts, medium on radii.

**Easing.** Fronts move at constant speed (equal radius increments per frame): delay = distance / speed. Dot flips are short and symmetric. Finder and logo colour return is a ~250 ms ease-out. The logo spin has uniform angular velocity (edge-on frames equally spaced), no wobble.

**Corrections vs the coarse pass.**
- The logo spins 1.5 turns continuously over 0.80–1.10 s; there is no second flip "at 1.31 s".
- The wave reaches the corners in 250–300 ms from 1.00 s, not ~450 ms; the restoring wave trails by 250 ms at the same speed.
- Dots hold blue ~250 ms; finders hold ~700 ms and fade over 250 ms (not 600 ms).
- Total ≈ 1.5 s from release (~1.7 s from touch-down), not 1.9 s.
- The grey press state is instant on touch-down; the animation fires on release.

**In Wavlength.** Party invite QR: on release, spin the mark 1.5 turns in 300 ms, run a constant-speed shrink-and-regrow front at ~550 pt/s in the album colour, restore black 250 ms behind it, and let finders and mark hold the colour ~700 ms before a 250 ms fade. CustomPainter with per-dot delay = d / 550, scaleX = |cos(πt)| over 100 ms, colour swap at t = 0.5.

## 38 — Finger-trail sequin flip: pale under the finger, colour on release, decay in drawing order after a ~1.5–2 s lag
*Essay section:* DELIGHT: swipe across the QR → sequin-like dot flip. Keep.

**What happens.** A faint red residue at the bottom-left finder in 0.00–0.35 s is the loop point, not gesture. The finger lands top-centre at 0.40 s. For three frames (0.40–0.55 s) the dots inside the ~60 pt touch radius only go **pale grey and slightly smaller** — the pressed face; no colour. Colour appears at 0.60 s in the dots the finger has just *left*: orange at the top. Down the left edge (0.65–1.45 s) the wake is orange near the top, red-orange mid-height, red low down; the bottom-left finder and centre logo take dark maroon. Along the bottom to centre (1.50–1.75 s), lift. Stroke 2: top-centre at 2.40 s, right and down the right side (2.70–3.25 s), ends bottom-right ~3.75 s with the same top-orange → bottom-red mapping. Decay follows drawing order: left-mid dots (touched ~1.0 s) still red at 2.70 s, half black at 3.30 s, black by 3.60 s; top-right (touched ~2.55 s) orange at 4.05 s, mostly black at 4.20 s; bottom-right (touched ~3.70 s) red at 4.80 s, maroon at 5.20 s, black at 5.40 s. Each dot darkens through its own hue (orange → brown → black, red → maroon → black); nothing fades in opacity; card, finders and logo never move.

**Timing.** Touch-down 0.40 s → first colour 0.60 s: the flip lags the finger by 100–150 ms (colour lands as it leaves). Lifetime ≈ 1.5–2.0 s at full colour, then 300–500 ms darkening (3.00 → 3.50 s left-mid; 4.05 → 4.25 s top-right). Last touch ~3.75 s → clean 5.40 s = 1.65 s. Confidence medium-high for lag and total, medium for per-dot lifetime (strokes overlap at top-centre).

**Easing.** Direct manipulation; no easing on the trail. Darkening is a slow colour ramp with a flatter tail (the maroon stage outlasts orange → brown). The pale pressed state is instant.

**Corrections vs the coarse pass.**
- Pressed state is a distinct phase: pale grey and shrunk under the finger; colour applied only as the finger leaves (~100–150 ms lag), not "within one frame of contact".
- Hold ~1.5–2 s, not 1–1.5 s; darkening 300–500 ms, not 0.6–1 s.
- Decay is a queue in drawing order, so the first dots clear while stroke 2 is still being drawn and the last clear ~1.6 s after lift.
- The red at 0.00 s is loop residue.

**In Wavlength.** Party QR: a swipe paints the song's palette through the dots — pale under the finger, colour on release, 1.5 s hold, 400 ms darken through the hue, cleared in stroke order. Same recipe for a "scratch" Recap cover. Stay off Listen.

## 39 — Per-glyph rolling number, 150 ms per keystroke, fired on touch-up; separators roll rather than slide
*Essay section:* DELIGHT: commas shifting as you type an amount. Keep.

**What happens.** Every key shows a grey circle on touch-down (ring first frame, filled while held ~150–200 ms, fading over 100 ms). The amount does not change while the key is held: "0" pressed at 0.55 s, motion starts at 0.80 s — the app fires on touch-up. $100 → $1,000: at 0.80 s the new "0" is rising at the right end, lower half clipped, existing digits not yet moved; at 0.85 s the string has re-centred, the comma is present and the digit ~90 % up; 0.90 s settled. $10,000 → $100,000 (1.80–1.95 s): 1.85 s new digit half-risen, comma still after "10"; 1.90 s **no comma visible anywhere** and the glyphs spread wider than final ("$100 000"); 1.95 s comma after "100", tracking closed. $100,000 → $1,000,000 (2.40–2.50 s): at 2.45 s the new comma after "1" is already full-size while the old one is gone. The conversion line rolls only the digits that changed. Over-balance (3.30–3.45 s): conversion line and red "Not enough ETH" both visible at 3.40 s (crossfade); Continue already grey at 3.40 s. Delete (4.40–4.45 s): the last "0" drops out through the bottom of the clip, commas vanish mid-frame and reappear in new slots, the red line crossfades back and Continue is white at 4.45 s. $1,000 → $100 (6.60–6.70 s): a comma glyph is caught dropping below the baseline at 6.65 s — separators leave through the bottom clip like digits. Font size steps down per added group within the same frames.

**Timing.** Keystroke transition 100–200 ms; 8 of 10 take 2–3 frames (0.80–0.90, 1.85–1.95, 2.40–2.50, 3.35–3.45, 4.40–4.45, 4.80–4.90, 5.65–5.70, 6.60–6.70 s), the longest 4 frames (5.20–5.35 s). Error crossfade ≤ 100 ms. Continue enable/disable ≤ 100 ms. Touch-down → motion 200–250 ms every time (the press, not latency). High confidence.

**Easing.** Front-loaded: entering digit ~50 % risen in frame one, ~90 % in frame two. The mid-frame over-wide tracking (glyphs re-positioned before the size step catches up) closes in the last frame — a small apparent overshoot in spacing, none in position. All glyphs share one curve.

**Corrections vs the coarse pass.**
- ~150 ms per transition, not 250–300 ms.
- Separators are not seen sliding or dipping: absent in the mid-frame, then in the new slot (roll/crossfade); on delete they drop through the bottom clip.
- The new comma is full-size in its first visible frame, not "tiny then scaling".
- Order is enter → re-centre/shrink → settle; digits move only after the new one has begun rising.
- Fires on touch-up; the coarse pass read the press as animation latency.

**In Wavlength.** RollingNumber for "CHORUS IN 12s", head-count, Log count and Recap stats: 150 ms per change, new digit ~50 % in frame one, departing digit clipped through the bottom, width change animated in the same window (AnimatedSize, same curve). Key from the right for the countdown; for typed room codes key from the left and let separators roll, not slide.

## 40 — Escalating helper copy via shared-word label morph (not an in-place swap), plus long-press clear as a whole-string crossfade
*Essay section:* DELIGHT: easter egg when the amount exceeds the balance. Keep.

**What happens.** ETH mode, "0", "$0", Continue grey. First key "1" (held 0.70–0.85 s): at 0.90–0.95 s the old "0" rolls **up and out** while "1" rises from below (odometer direction), conversion digits roll individually, and Continue crossfades grey → white 0.90–1.05 s. Later zeros behave as in clip 39: new digit rising at the right end, glyphs re-spread and shrink, commas absent in the mid-frame (1.45–1.50, 1.85–1.95, 2.85–2.95, 3.60–3.70, 4.85–5.00, 5.40–5.50, 5.95–6.05 s). Crossing the balance (2.55–2.60 s): conversion line and red "Not enough ETH" overlap for one frame (a crossfade — no shared words) and Continue goes grey in the same frames. Reaching 1,000,000 (3.90–4.00 s) the helper does **not** swap in place: "not enough ETH" slides right and "Still" fades in on the left, the line re-centring — the same shared-word morph as "Continue" → "Continue To Back Up" in clip 36; at 3.95 s "Still" is ~40 % opaque mid-slide. Reaching 1,000,000,000 (5.95–6.05 s) the text slides left and "😅" fades in at the right end in the same frame the ninth zero rises. Long-press delete: key held 7.20–7.65 s; at 7.70 s the whole "1,000,000,000" is a ~50 % ghost with a full-size "0" already centred over it and "$0" over the fading red line; 7.75 s ghost ~20 %; 7.80 s clean. Continue stays grey from 2.55 s to the end.

**Timing.** Keystroke roll 100–150 ms (2–3 frames), as in clip 39. Helper morph 100–150 ms, simultaneous with the roll. Error crossfade ≤ 100 ms. Continue enable/disable ~150 ms. Long-press: ~450–500 ms hold, then a 100–150 ms whole-string crossfade with no per-digit motion. High confidence.

**Easing.** Front-loaded like clip 39: entering digit half-risen in its first frame; sliding words cover most of their travel in frame one while the fading word/emoji is ~40 % then full. The clear's fade looks linear (50 → 20 → 0 %). No overshoot.

**Corrections vs the coarse pass.**
- "In-place text swap" is wrong: escalation is a shared-word morph (existing words slide, new word/emoji fades in at the edge, line re-centres). Only conversion → "Not enough ETH" is a crossfade.
- The emoji is appended by slide + fade in the same frame as the digit roll.
- Long-press clear is a ~500 ms hold then a whole-string crossfade; not described before.
- The first digit replaces "0" by rolling upward, the opposite direction to deletes.

**In Wavlength.** Escalating no-match copy ("No match yet" → "Still no match yet" → "Still no match yet 🫠") and "Synced" → "Still synced" use MorphText's shared-word path: keep common words, slide them, fade the new word in at the edge, 150 ms, in the same tick as the trigger. Plain crossfade only for lines sharing no words. A long-press clear holds ~500 ms then crossfades the whole value.

## 41 — Selected items lift out of a blur-and-fade screen swap and fly into a skeuomorphic bin (250 ms); the confirm drop is 100–150 ms; edit-mode floating action bar
*Essay section:* DELIGHT: tokens tumble into a skeuomorphic trash can (with sound). Keep.

**What happens.** Edit mode: tiles with empty circular marks, a greyed floating action bar (Back / Trash / Report), header "5 ⌄". Tap tile 1 (ring 0.60 s): "5" crossfades to "Select All" at 0.60–0.65 s; the mark fills and grows a tick over 0.65–0.75 s; the action bar turns active in the same frames. Tiles 2 and 3 (1.10 s, 1.60 s) fill in the same 100–150 ms. Tap Trash (2.30 s). At 2.40 s the grid is already enlarging slightly and softening, unselected tiles losing opacity, while the three selected tiles are lifted out as separate layers at ~1.2×. At 2.45 s the outgoing grid is blurred at ~30 %, the confirm screen (red trash glyph, "Trash Collectibles", red pill, Cancel) is ~60 % and sharp, and the tiles overlap large in the centre-left, converging. 2.50 s: confirm fully in, tiles ~0.5× above the bin rim; 2.55 s: at the rim, tilted, ~0.35×; 2.60 s: in the bin, fractionally larger than final; 2.65 s: settled as a fanned stack behind the front lip. Tap the pill (ring 3.60–3.75 s): 3.80 s the stack is half in, 3.85 s only its top edge shows, 3.90 s gone. Hold to 4.00 s. 4.05–4.20 s: the confirm screen blurs and fades out while the grid fades in sharp, already reflowed to two tiles with "2 ⌄"; no reflow motion. 5.40–5.60 s is the video loop; ignore.

**Timing.** Mark fill, "Select All" swap and bar enable all 100–150 ms and simultaneous. Screen swap + tile flight 2.40→2.65 s = 250 ms; the layer crossfade is 150 ms (2.40–2.55 s), the tiles land 100 ms later. Final drop 100–150 ms (3.75→3.90 s). Return crossfade 150 ms (4.05→4.20 s) after a 150 ms hold. High confidence.

**Easing.** Tile flight is front-loaded: most of the travel and shrink in 2.45→2.55 s, then a 100 ms settle with a slight scale overshoot (none in position); rotation accumulates through the flight. The drop reads as accelerating. Both screen swaps share one recipe: outgoing layer blurs + fades (+ slight scale-up), incoming fades in sharp, ~150 ms.

**Corrections vs the coarse pass.**
- Flight is 250 ms, not 400–450 ms; the drop is 100–150 ms, not "≤ 240 ms".
- The screen swap blurs (and slightly enlarges) the outgoing layer, going in and coming back; it is not a plain crossfade.
- The tiles lead: they are lifted and moving in the first frame, before the confirm screen is visible.
- Small scale settle at landing; selection micro-interactions timed (100–150 ms).

**In Wavlength.** Log edit mode → "Remove 3 tracks": covers lift out of their rows in the first frame, the Log blurs and fades while the confirm view fades in sharp (150 ms), covers converge into the crate over 250 ms with a scale settle, and the confirm drop is a ~120 ms accelerating fall with haptic + thunk on landing. Return with the same blur-fade swap after a 150 ms hold; floating action bar replaces the tab bar in edit mode. Same for deleting Moments.

## 42 — Self-drawing hand-drawn arrow in an empty state (500 ms) after a 100–150 ms tab crossfade with a fixed shared avatar
*Essay section:* DELIGHT: animated arrow in the browser empty state. Keep.

**What happens.** Tokens list; the compass tab is pressed 0.65–0.80 s (ring). At 0.85 s both screens are visible at roughly half opacity: the "Benji" name, ⋯/chat/scan icons and the + FAB are fading, the grey search pill, "Suggested" icon grid and the bottom browser toolbar (‹ › search tabs ⋯) are fading in, and the compass tab icon is already filled. The avatar at the left of the header does not move or fade. At 0.90 s the token list is a ~10 % ghost; 0.95 s clean. No slide, no scale. The empty state then arrives in two staggered fade-ups: "Start Exploring Ethereum" from 1.30 s (rising ~15–20 pt, settled ~1.50 s), the two-line body from 1.45 s (settled ~1.60 s). Both end as very light grey. The arrow starts at 1.75 s as a dot under the body, then a short vertical stroke (1.80 s), the small curl (1.85–1.95 s), the descending stem (2.00–2.10 s) and the arrowhead last (2.15–2.25 s), pointing at the toolbar's search button. From 2.25 s to 4.15 s nothing moves. The wallet tab is pressed 4.10–4.25 s; at 4.30 s the token list is ~70 % over a 30 % browser ghost, and 4.35 s is clean, wallet tab icon filled.

**Timing.** Tab crossfade 100–150 ms each way (0.85→0.95 s; 4.25→4.35 s). Title fade-up ~200 ms (1.30→1.50 s), body ~150 ms starting 150 ms later. Arrow stroke 500 ms (1.75→2.25 s), beginning ~150 ms after the body settles. Total from tap to finished empty state: 0.80 → 2.25 s. High confidence.

**Easing.** The crossfade is two frames, so effectively linear. The text fade-ups are front-loaded (most of the rise in the first frame). The stroke advances at a near-constant rate (roughly equal path length per 50 ms), with the head drawn as the final 20 % of the path; no overshoot, no bounce.

**Corrections vs the coarse pass.**
- Tab crossfade is 100–150 ms, not 250–400 ms; return is ~100 ms, not 220 ms.
- Empty-state copy is staggered (title, then body 150 ms later), not one fade.
- The arrow takes ~500 ms, not ~900 ms; the coarse 0.22 s sampling put its start 200 ms early and its end 200 ms late.
- The tab icon fills in the first frame of the crossfade, not after it.

**In Wavlength.** Log empty state ("Nothing logged yet tonight") and Party empty state ("Just you so far"): tab crossfade 120 ms with the header avatar/room chip as the fixed shared element, title fade-up, body 150 ms later, then a 500 ms constant-rate PathMetric stroke ending in the arrowhead that points at the mic or invite button. Draw it once per session. Also the empty Moments strip.

## 43 — Multi-select drag: selected rows gather into a stack in 200 ms while the list closes the gaps on the same clock, fan out in 150 ms on drop, and the edit chrome swaps in/out as one 150–200 ms crossfade with the FAB scaling in on the same frames
*Essay section:* DELIGHT: drag-reorder with stacking. Keep.

**What happens.** Ring on the Ethereum row from 0.35 s. 0.55 s: light-blue highlight ~40 %, no movement. 0.60 s: row content slid ~15 pt left, blue drag-handle capsule fully drawn at the right; holds while the finger stays (to 1.05 s). 1.10 s, all at once: "⇅ Custom" / "Done" crossfade over "Tokens / Collectibles" / "$589.00" (~50 % at 1.10, done 1.20); avatar and name dim; the row slides back while the handle becomes a check (1.10 → 1.15); selection circles and star badges fade in (~40 % at 1.15, full 1.20); the tab bar fades out as the floating action bar rises from below it (~50 % at 1.15, ~90 % at 1.20, settled 1.25); the FAB shrinks and greys (small 1.10, gone 1.15). Tapping Aave (2.05 s) and Optimism (2.35 s) toggles check + tint within one frame.
Gather: ring on Aave from 2.80 s; 2.95 s Aave lifts (light-blue card, no visible scale). 3.00 s: Ethereum has dropped ~1.5 rows toward Aave and Optimism risen; Tether has already moved up into Ethereum's slot. 3.05 s: both peek ~8 pt above/below Aave. 3.10 s: ~3 pt. 3.15 s: tucked; Polygon has closed the last gap. 3.20 s: single stack. Gap-closing and stacking share frames.
Drag 3.25–4.10 s: the stack follows the finger; Tether passes underneath at 3.90–4.05 s to open the top slot. Drop ≈ 4.15 s. 4.20 s: stack at top, Tether pushed down. 4.25 s: Optimism peeks below Aave; Ethereum emerges from *between* them. 4.30 s: three rows at ~90 % spacing. 4.35 s: settled.
Done: ring 5.20–5.35 s. 5.40 s: tabs over "Custom" ~50 %, header brightening, checks ghosting, action bar ~60 % with the tab bar ~40 % beneath, FAB ~50 % size and grey. 5.45 s: tab bar ~80 %, action bar ~20 %, FAB ~80 %, tints gone. 5.50 s: FAB full, action bar ~5 %. 5.55 s: clean.
Missed before: at 6.05–6.15 s the rows crossfade back to the server order in place (100 ms, no flight).

**Timing.** Highlight +50 ms, handle +100 ms after the ring; hold ≈ 500 ms to edit mode. Edit entry 150–200 ms, all layers concurrent; FAB out 100 ms. Gather 200 ms. Unfurl 150 ms. Exit 150 ms; FAB scale-in 150 ms on the same frames (50 / 80 / 100 %). Confidence: high on frame counts, medium on peek offsets.

**Easing.** Gather is front-loaded (≈ 60 % in the first 50 ms, then 8 → 3 → 0 pt), critically damped, no bounce. Unfurl the same, slightly faster. FAB scale-in 50 / 80 / 100 % – ease-out, no overshoot frame. Chrome crossfades near-linear over 3 frames. Selection toggles instant.

**Corrections vs the coarse pass.**
- Gather 200 ms (not ~300), unfurl 150 ms (not ≤ 250).
- Leaving edit mode is 150 ms (not 400–500); the FAB scales in during the same 150 ms and merely finishes on the last frame – no overshoot, not a separate stage.
- The long-press preview is two steps (tint +50 ms, 15 pt slide + handle +100 ms), then a ~500 ms hold.
- Ethereum re-emerges between Aave and Optimism: stack order = list order.
- No visible lift scale on the dragged row; the lift is tint + shadow.
- Missed: the 100 ms in-place row crossfade at 6.10 s.

**In Wavlength.** Party karaoke line assignment and Recap chapter reorder: tint at 50 ms, handle at 100 ms, edit chrome as one 150–200 ms crossfade (header row, floating action bar replacing the tab bar, FAB scaling out/in), gather selected rows into the dragged one over 200 ms while the list closes gaps on the same spring, fan out over 150 ms on drop preserving order.

## 44 — Masked values: a 150 ms in-place crossfade to asterisks (row quantities collapse their digits leftward instead of fading), then a periodic per-glyph highlight sweep – 100 ms per glyph, ~10 % lighter, 3-glyph-wide band, one pass every 1.7 s
*Essay section:* DELIGHT: stealth mode shimmer. Keep.

**What happens.** Ring on "$588.04" from 0.85 s. 0.95 s: unchanged. 1.00 s: the digits are ~60 % grey and five large asterisks are ~20 % visible *in the same centred slot* (both layers drawn at once); "−$1.91" is fading, "−0.32 %" stays. In every row the fiat value crossfades to a small "*****" (~30 % at 1.00, ~80 % at 1.05) while the quantity loses its number by *collapsing its width*: "0.1061 ETH" → "1061 ETH" (1.00) → "61 ETH" (1.05) → "ETH" (1.10) with the unit sliding left; names, icons and % changes stay. 1.05 s: digits ~30 %, asterisks ~70 %. 1.10 s: done. Layout never shifts.
Shimmer (measured ink per glyph; base luminance 198, peak 217): pass 1 starts on glyph 1 at 1.15 s, peaks glyph 1 at 1.20, glyph 2 at 1.30, glyph 3 at 1.40, glyph 4 at 1.45–1.50, glyph 5 at 1.55 and fades out by 1.80 s. Each glyph ramps up over ~150 ms and down over ~150 ms, so at any instant about three glyphs are lit with the middle one brightest. Pass 2 is identical from 2.80 s (peaks 3.00 / 3.10 / 3.20 / 3.25 / 3.35, clean by 3.65). Nothing between passes (1.85–2.75 s flat at 198). No third pass before the reveal. The row-level asterisks show no measurable sweep at this size.
Reveal: ring on the asterisks from 4.10 s. 4.30 s: "$588.04" ~40 % over asterisks at ~60 %; row values ~40 %, quantities widening back ("1061 ETH"). 4.35 s: digits ~75 % (ink 74), asterisks ~10 %; "−$1.91" half in. 4.40 s: digits full black (ink 0), asterisks gone, everything back.

**Timing.** Hide 150 ms (3 frames). Reveal 150 ms (3 frames), ~50 ms after release. Shimmer: 100 ms glyph-to-glyph, ~400 ms for the band's centre to cross five glyphs, ~650 ms from first rise to last fall; period 1.65–1.70 s (pass starts 1.15 s and 2.80 s), i.e. ~1 s of rest between passes; the first pass starts as soon as the mask lands. Confidence: high (all from pixel measurements).

**Easing.** Crossfades are near-linear over 3 frames (0 → 60 → 30 → 0 % old; 20 → 70 → 100 % new), both layers on the same clock. The quantity collapse is a width tween, not a fade. The shimmer profile per glyph is a symmetric ~300 ms bump (198 → 217 → 198), a gaussian/sine band moving at constant speed (peaks equally spaced at 100 ms). Highlight amplitude is small: +19 luminance ≈ #C6C6CB → #D9D9DC.

**Corrections vs the coarse pass.**
- Hide is 150 ms, not ≤ 230; reveal is 150 ms, not 250–400 ms.
- The quantity "0.1061 ETH → ETH" is a width collapse with the unit sliding left, not a fade or swap.
- Shimmer is regular, not "irregular every 1–1.5 s": period 1.7 s, 100 ms per glyph, a 3-glyph-wide soft band, and it only runs on the large asterisks.
- Highlight is ~10 % lighter (≈ #C6→#D9), subtler than "#E5E5EA over #C7C7CC".
- The first pass fires immediately after the mask lands (1.15 s), so the shimmer is the mask's "settled" state, not a delayed idle.

**In Wavlength.** Skeleton/ShimmerScope spec: mask in place over 150 ms with the real layout kept, collapse only the varying digits (width tween, unit slides), and run a soft 3-cell-wide highlight band at 100 ms per cell, +10 % lightness, one pass every ~1.7 s on one shared clock. Applies to "Finding lyrics…", "CHORUS IN ••s" (mask the number only), Party guess-the-song masks, and the Log privacy toggle.

## 45 — Success check flies into the progress dot; confetti for a rare moment; the nav badge grows into the wallet card, which then travels and relabels itself
*Essay section:* DELIGHT 'confetti after backup' (keep). Second half is FLUIDITY 'wallet cards travel between screens without duplicating' (keep), and the card's entrance is the reverse of the clip 49/50 'phrase card shrinks into the nav lock badge'.

**What happens.** Touch highlight on '11' from 0.85 to 1.10. Response starts at 1.05: the faint grey status ring at the pill's right end tints pale green. 1.10: the ring is a solid pale-green blob (visibly larger than the final check, ~1.2×), the pill fill goes pale green, and green dots start emerging *through* the helper text (blurred, ~30 %). 1.15: '11' is in place, 'eager' has shifted right ~20 pt to make room, the check badge is final (white tick), the dashed border is on, helper text is at ~30 % with the 4-dot row at ~80 %, the keypad is dimming. 1.20: settled (keypad ~30 %). Check flight: the badge leaves the pill at 1.55–1.60 and lands in the 4th dot at 1.75, shrinking from ~14 pt to ~8 pt on the way; its path is close to a straight diagonal, not an arc. Confetti starts at 1.60 (first shards inside the status bar), i.e. the same frame the check leaves; it fills the header by 1.75 and reaches the bottom of the screen by ~2.6–2.7, thinning out until ~3.15 with no fade. Completion swap: at 3.15 the page is intact; at 3.20 the nav lock badge is gone and a translucent teal card (~44 % width) sits just below where the badge was, horizontally centred. It grows and moves down: width 64 % at 3.25, 86 % at 3.30, 95 % at 3.35, 98 % at 3.40, 100 % at 3.50; card top edge 58→82→113→138→143→146→147 frame-px. Meanwhile the old page slides left (~25 % of the width by 3.35) and fades, gone by 3.40; ‹ and ? fade out 3.20–3.35; the Done pill fades in in place 3.20→3.30. Title 'Manual Backup Completed' fades in 3.70→3.85, subtitle and disclaimer 3.75→3.90, no drift. Done → Backup: touch highlight 4.95–5.10; at 5.15 the nav ('‹ Backup ?') starts fading in and the address label crossfades to 'Copy Address' while the card has moved only ~2 %; 5.20: card 39 % of the way, old title gone, Customize ~40 %; 5.25: 64 %, nav full; 5.30: 87 %, Done gone; 5.35: 94 %, Recovery Methods rows ~90 %; 5.40: 96 %; creeping to rest until 5.55–5.60.

**Timing.** Success state 1.05→1.20 = 150 ms (3 frames); tap→response latency 200 ms (probably touch-up). Check flight 1.55→1.75 = 200 ms. Confetti ~1.0–1.1 s top→bottom, ~1.5 s total. Card entrance 3.15→3.50 = 300–350 ms (scale 86 % done at 150 ms). Page-out slide/fade ~200 ms (3.20→3.40). Text follows the card by 200 ms and fades in over 150 ms. Done→Backup card travel 5.15→5.55 = 400 ms (64 % at 100 ms after it really starts moving). Confidence: high for durations, medium for percentages (measured at ~2 px per frame-px).

**Easing.** Card entrance: scale is front-loaded (36 %, 38 %, 15 %, 5 %, 2 % of the growth per frame = strong ease-out), but the translate is sigmoidal (18, 24, 31, 25, 5, 3, 1 px) — peak velocity in the middle frames, spring-like tail. Card travel on Done: 2 %, 37 %, 25 %, 23 %, 7 %, 3 %, 1 % — a near-zero first frame (start latency), then ease-out with a ~150 ms tail. No overshoot on any position. The only possible overshoot is the check blob at 1.10 (~1.2× then settles), low confidence. Confetti: gravity plus spin. Layers do not share a curve: opacity crossfades (nav, Done, rows) are ~100–150 ms linear, while position runs 300–400 ms.

**Corrections vs the coarse pass.**
- The card does NOT enter 'centred at 0.88 scale, ~25 pt above'. It emerges from the nav lock badge's position at ~0.44 scale, translucent, and grows/drops ~90 frame-px (≈170 pt) into place. The badge disappears on the same frame (3.20): the badge → card is a continuation of the phrase-card → badge morph in clips 49/50.
- Confetti begins at 1.60, simultaneous with the check leaving the pill (not after the dots fill), and lasts ~1.5 s, not 1.4 s top-to-bottom.
- Success state is 150 ms, not 250 ms; 'eager' shifts right ~20 pt to admit '11'; the dots emerge through the helper text with a blur, not a plain crossfade.
- Check flight is 200 ms and shrinks in flight; path is straight, not curved.
- Done→Backup: the label crossfade inside the card starts one frame BEFORE the card moves, and the first movement frame is nearly zero (start latency / soft start).
- Completion text follows the card by 200 ms (measured), consistent with the guess.

**In Wavlength.** Keep (1)–(4) from the coarse pass: fly a check from the now-playing card into the Log tab (200 ms, shrinking, straight path), confetti only for Recap reveal/first room, the now-playing card travelling into Log/Recap and relabelling in-card with the label crossfade starting a frame early. Add: when the mic badge in the header 'becomes' the now-playing card, grow it from the badge position (scale ease-out, translate spring-tail), and fade in the surrounding text ~200 ms after the card settles.

## 46 — Selection collapses into a summary chip (stacked shared elements) over a pure in-place crossfade; CTA label morph that keeps 'Con' but re-centres the whole label
*Essay section:* FLUIDITY: send flow → confirm with/without comparison, plus the 'Continue' → 'Confirm' label morph (keep).

**What happens.** Forward: touch highlight on Continue 0.80–1.00 (held ~250 ms), page untouched through 0.95. 1.00: everything is already moving. The two selected tiles have shrunk to ~30 % of their size, tilted (left one ~-8°, right one ~+4°), and sit at the destination row's y at ~75 % of the x-path; the old page (header 'Send ×', tabs, collection rows) is at ~70 % opacity, the new page (avatar, 'Confirm transaction to Alex', rows, fee) at ~35 %, both without any translation. The CTA already reads 'Confirm' with the scan glyph at ~90 % and a faint 'e' ghost of 'Continue' to the right. 1.05: pile is at its final x/y but still ~4× the final icon size (position leads scale); old page ~25 %, new ~85 %; label clean except a faint tail ghost. 1.10: pile is the small row icon; pages at ~95 %. 1.15: settled. The header swaps 'Send ×' → '‹ ?' by crossfade in the same frames. Reverse: touch highlight on ‹ 2.45–2.65 (held ~200 ms). 2.70: tiles have separated and grown to ~30 % of full size, still at the row's y, sliding left; 'Send' header ~50 %, confirm content ~65 %; CTA shows 'Confirm' with a tail ghost. 2.75: tiles ~85 % size, overlapping and tilted, within a few pt of their grid slots; 'Continue' text is in, the scan glyph is ~30 % on its left. 2.80: tiles full size in their slots, page ~95 %, glyph still faintly visible. 2.85: clean. In both directions the white pill's frame does not move a pixel; the label group (glyph + text) re-centres, which shifts the shared 'Con' by ~15 pt (right going forward, left coming back).

**Timing.** Forward 0.95→1.15 = 150–200 ms (3–4 frames), reverse 2.65→2.85 = 200 ms. The travelling pile reaches its final position by +100 ms (~75 % at +50 ms) and its final size by +150 ms. Page crossfade ~150 ms, roughly linear (35 → 85 → 95 %). Label morph: text ~90 % swapped in the first frame (~50–100 ms); the glyph fade trails by ~50–100 ms. Confidence: high on durations (every transition spans 3–4 frames), medium on the percentages.

**Easing.** Position: ~75 % of the path in the first 50 ms, then settle = strong ease-out, no overshoot frame in either direction. Scale lags position by ~1 frame (the pile is still large when it arrives, then shrinks; growing back it separates and scales before it has travelled). Tilt is present on every mid frame and gone on arrival. Opacity is closer to linear over the same 150 ms. No layer shares a curve with another: position (ease-out, 100 ms) < scale (150 ms) ≈ opacity (150 ms) < glyph fade (200 ms).

**Corrections vs the coarse pass.**
- Duration is 150–200 ms each way, not ~300 ms; the coarse 0.161 s step blurred a 3–4 frame move.
- The pile is not '~90 % there at mid-transition' in one uniform sense: position is ~75 % after 1 frame and 100 % at 2, but scale is only ~80 % at 2 frames. Position leads scale.
- 'Con stays' is only half right: the three letters are shared (no double ghost) but the whole label re-centres by ~15 pt because the glyph is added/removed on the left.
- The glyph fades slower than the text (still visible at 2.80 on the way back) — a small stagger the coarse pass missed.
- Touch highlight is held 200–250 ms before the transition starts (touch-up trigger), so the felt latency from finger-down is ~250 ms + 200 ms.
- Reverse is genuinely symmetric in duration; the coarse '2.58→2.9' was a guess.

**In Wavlength.** Keep the karaoke line-assignment and Recap-share ideas: selected avatars/Moment thumbnails shrink, tilt and stack into a '3 singers' / '2 Moments' chip while the page crossfades in place (no push). Budget 180 ms, not 300: position ease-out over ~100 ms, scale over ~150 ms, opacity linear over 150 ms; keep the CTA frame fixed and morph only the label group, accepting the ~15 pt re-centre when an icon is added.

## 47 — List row lifts into the selected-token field (shared-element picker) while everything else crossfades in place
*Essay section:* FLUIDITY: send flow, token selection → amount (keep).

**What happens.** Four transitions, all with the same choreography. Forward (Uniswap): touch ring at 0.25, dark press highlight 0.30–0.45, first change at 0.50. At 0.50 the Uniswap row has already travelled ~48 % of its ~185 frame-px path upward, it is already wearing its dark rounded surface (~#1A1A1A) with the 'Use Max' chip at ~80 %, the list behind is still ~80 % opaque, and the incoming '$0', conversion line and keypad are at ~30–40 %. 0.55: row at 83 %, list ~25 %, incoming ~60 %. 0.60: row at 96 %, list gone, incoming ~85 %. 0.65: settled. Header and 'To Jacques' never move. Forward (Tether, 2.60→2.80): 37 %, 78 %, 95 %, 100 % on successive frames, same opacity pattern. Reverse (tap the field, highlight 1.40–1.55; motion 1.60→1.75): row at 37 %, 74 %, 95 %, 100 % of the downward path; the dark surface is still full at 1.60, faint at 1.65, gone at 1.70; 'Use Max' fades a frame slower (still ~20 % at 1.70); the list fades in 35 → 60 → 90 → 100 %, the '$0'/keypad fade out 80 → 40 → 0 %. Tether reverse (3.80→3.95) matches. Icon and text keep their size throughout; the incoming and outgoing content have no translation at all, only opacity. Nothing else in the list moves — the other rows do not close the gap.

**Timing.** Every transition is 4 frames = 200 ms from first motion to rest (forward 0.50→0.65, 2.65→2.80; reverse 1.60→1.75, 3.80→3.95). The row is ~40 % of the way at 50 ms, ~80 % at 100 ms, ~95 % at 150 ms. Outgoing layer fades in ~100–150 ms (starts ~1 frame late), incoming layer fades in ~150–200 ms. Press hold before motion ~200–250 ms (touch-up trigger). Confidence: high.

**Easing.** Row travel per frame ≈ 40 / 40 / 15 / 5 % — a fast ease-out (close to cubic ease-out or a critically damped spring), no overshoot frame in any of the four moves. Forward and reverse use the same curve and duration (symmetric). Opacity layers are ~linear over 150 ms; the outgoing list starts one frame after the row (stagger ~50 ms), so on the first frame the lifted row is briefly seen over a still-bright list. The surface + Use Max chip appear with the row on frame 1 (no separate grow), and on the way back the chip outlives the surface by ~1 frame.

**Corrections vs the coarse pass.**
- Duration is 200 ms flat, not 250–300 ms; '84 % at +190 ms' was a phase artefact — it is ~80 % at +100 ms.
- The dark surface does not 'grow behind the row during the move'; it is fully present on the first motion frame. Only its opacity changes on the way back.
- Reverse is symmetric with forward (same 4 frames, same per-frame fractions), not merely 'the same way'.
- New detail: the list is still ~80 % visible on the first motion frame, i.e. the lifted row leads the crossfade by one frame; the Use Max chip trails the surface by one frame on dismiss.
- Press latency (~200–250 ms of highlight) is a real part of the felt response and should be reproduced (react on touch-up with the pressed state shown).

**In Wavlength.** Keep the song-disambiguation idea: tapping a candidate row lifts it ~200 ms (ease-out, 40/80/95) into the now-playing slot; the list fades out starting one frame later over ~120 ms, the lyrics skeleton fades in over ~180 ms without translation. Tapping the now-playing title drops it back with the identical curve. Do not animate the other rows closing the gap, and give the lifted row its card surface immediately rather than growing it.

## 48 — Grid card ↔ detail hero over a blur-crossfade; camera-zoom level changes (both layers scale the same way); live count with an avatar sliding out from behind the stack
*Essay section:* FLUIDITY 'wallet cards travel between screens without duplicating' (keep); the counter is the 'wallet-count text adjusting' idea (keep).

**What happens.** (a) Home → Wallets: touch ring on the avatar 0.80–0.90; 0.95: the grid is visible at ~35 %, washed toward white, and *larger* than final (Rainy Day tile 150 px vs 140 final ≈ 1.07×); home still ~90 %. 1.00: grid ~65 % at 1.04×, home ~50 % and its rows have crept ~2 % toward the centre (scale ≈ 0.97). 1.05: grid ~90 % at 1.0×, home ~20 %. 1.10: grid full, faint home ghost. 1.15: clean. Both layers shrink together — a camera pull-back, not 'one scales down while the other stays'. (b) '…' on Rainy Day: press 2.10–2.25. 2.30: the whole grid and nav are already blurred (~8 pt) while the card stays sharp at 1.12× and has barely moved (top edge 4 % of its travel); × is appearing. 2.35: card 1.5×, top edge 36 % of the way, blur ~20 pt and the backdrop ~50 % washed to white, 'Copy Address' faint, '…' gone. 2.40: card 1.79×, 70 %; menu rows appear at ~30 % *and blurred*. 2.45: 1.96×, 90 %; rows ~70 %, nearly sharp; selection ring fading. 2.50: 2.04× (final), rows sharp, ring gone. (c) Counter: 3.35 '3 related wallets'; 3.40 the text already reads '5' (≤ 1 frame, no roll visible) while the stack is unchanged; 3.45–3.60 a 4th avatar slides out from behind the 3rd (25 → 50 → 75 → 100 %) and the stack re-centres ~7 pt left. It stays at 5 for the rest of the clip; no '6'. (d) Close: press × 4.10–4.25. 4.30: the card has shrunk to 0.94 and dropped a little while the menu rows are still full and sharp. 4.35: card 0.83, rows blurring at ~60 %, grid visible blurred at ~40 %. 4.40: 0.67; rows ~25 %; grid ~70 %. 4.45: 0.59, ring back on, '…' back, grid ~90 % almost sharp. 4.50: 0.53, grid sharp. 4.55: 0.47 (final) in its slot. (e) Tap the card: press 5.55–5.70. 5.75: grid blurred, ~1.04×, ~50 % washed; home list ~60 % sharp. 5.80: grid ~25 % at ~1.06×, home ~90 %. 5.85: ~10 % ghost. 5.90: clean.

**Timing.** Up a level (a) 0.95→1.10 = 150–200 ms. Card expand (b) 2.30→2.50 = 200–250 ms; blur is at full strength within the first 100 ms. Card close (d) 4.30→4.55 = 250 ms — the same as, or slightly longer than, opening. Into the child (e) 5.75→5.90 = 150–200 ms. Avatar slide 200 ms, count text ≤ 50 ms. Confidence: high (every move spans 3–5 frames).

**Easing.** Expand scale per frame: 12, 36, 28, 16, 8 % — soft first frame, then ease-out; the card's translate lags scale by one frame (4 → 36 → 70 → 90 → 100 %). Close: 11, 22, 30, 15, 10, 12 % — noticeably ease-in-out with a slow start; the menu starts fading one frame after the card starts moving. No overshoot in any of the five moves. Blur is a crossfade tool: the outgoing layer blurs *and* fades, the incoming layer arrives blurred and sharpens as it fades in (menu rows in (b), grid in (d)); nothing stays blurred once settled. Level changes: opacity ~linear over 3 frames; scale 1.07 → 1.0 (incoming) and 1.0 → 0.97 (outgoing) share the same direction and duration.

**Corrections vs the coarse pass.**
- Close is not faster than open: expand 200–250 ms, close 250 ms, with a slower start.
- Going up a level, the incoming grid arrives at ~1.07× and shrinks to 1.0 while the outgoing home shrinks to ~0.97 — both shrink (camera pull-back). The coarse '0.95 for the outgoing only' is half the story. Going into a child, the outgoing grid blurs and grows to ~1.06 while the incoming list is essentially at 1.0.
- The blur reaches full strength on the first frame of the expand; the wash to white then increases over 3 frames.
- Incoming menu rows are themselves blurred when they appear (2.40) and sharpen as they fade in; on close the rows blur out. Blur-crossfade, both directions.
- The count text changes in ≤ 50 ms with no visible roll; the new avatar is *revealed sliding out from behind* the last one over 200 ms, and the stack re-centres by half an avatar. The '3 → 5 → 6' sequence is wrong: it goes 3 → 5 once.
- Press-to-response latency is long here (150–200 ms of pressed state before motion) on every tap.

**In Wavlength.** Keep the Log card-grid → hero idea and the zoom-level rule for Listen ↔ Party and Log ↔ Recap, with corrected values: up a level = incoming 1.07→1.0 and outgoing 1.0→0.97 over ~180 ms; into a child = outgoing blur + 1.0→1.06 over ~180 ms. Hero expand ~220 ms (soft-start ease-out) with the backdrop blurred on frame 1; close ~250 ms ease-in-out, with the hero's controls swapping back mid-way. Incoming secondary content (menu rows) should fade in from blurred. 'People heard this' stack: text hard-swaps, the new avatar slides out from behind the stack over 200 ms.

## 49 — Button-to-tray grow (CTA anchored, content top-pinned and clipped by the CTA) + phrase card shrinks into the nav lock badge; back is a pure in-place crossfade (even the keyboard fades)
*Essay section:* SIMPLICITY/FLUIDITY 'trays emerge from buttons' and 'trays preserve context' (keep).

**What happens.** Tray enter: Continue pressed 0.10–0.25. 0.30: the scrim is already at (or near) full strength and the tray's top edge has risen 38 % of its ~237 frame-px travel; icon, × and the first title line are visible pinned to the moving top edge, and the body text is hidden *behind* the CTA (the button acts as a clip, so text appears to slide out from under it). 0.35: 81 %, two paragraphs peeking above the CTA. 0.40: 97 %. 0.45: at rest (top edge 108). The CTA rises ~10 pt and widens ~8 pt (page inset 40 → tray inset 16 + padding 20 = 36) over the same frames; its label never changes. Tray exit: CTA pressed 1.35–1.45. 1.50: top edge has dropped 32 % and the scrim is about half lifted; 1.55: 79 %, scrim ~gone, only icon and × still visible above the CTA; 1.60: tray gone, page text back (disclaimer ~70 %); 1.65: clean. Step to 'Enter Password' (starts between 1.80 and 1.85, i.e. ~200 ms after the tray closed): old title slides left ~26 pt and fades (50 % at 1.85, 20 % at 1.90, gone 1.95); new title arrives from ~+110 pt: offset 67 → 41 → 25 → 11 → 4 → 0 pt at 1.85…2.10 with opacity 50 → 80 → 100 %. The phrase card shrinks toward the nav: 0.62× at 1.85 (the lock glyph is already drawn at its centre), 0.41× at 1.90, 0.20× at 1.95, badge size and position at 2.00. Password field and 'Forgot Password?' fade in 1.85→1.95. Keyboard rises 10/44/69/87/97/100 % (1.85→2.10) and the CTA rides exactly above it with the same fractions, turning lavender-disabled by 1.90. Back (‹ at ~3.00): 3.05 the full-size phrase card is already at its final position at ~98 % scale and ~40 % opacity while the badge is ~70 %; 'iCloud Backup' fades in *over* 'Enter Password' at the same x (no slide); the two CTAs (disabled one above the keyboard, purple one at the bottom) crossfade in place at ~50 % each; 3.10 card ~75 %, keyboard ~50 % **fading in place, not sliding down**; 3.15 card full, keyboard ~15 % ghost; 3.20 clean.

**Timing.** Tray enter 0.30→0.45 = 150–200 ms (97 % at 150 ms); scrim ≤ 100 ms. Tray exit 1.50→1.60 = 100–150 ms (faster than enter). Step transition ~300 ms (title travel and keyboard both settle at 2.10), card→badge 200 ms (done at 2.00, ahead of everything else). Back ~150–200 ms, all opacity. Confidence: high.

**Easing.** Tray top edge per frame: 38, 43, 16, 3 % — ease-out, near critically damped, no overshoot frame. Exit 32, 47, 21 % — closer to ease-in-out/linear over 3 frames. Card→badge scale 43, 24, 24, 9 % — front-loaded. Incoming title 39, 24, 14, 13, 6, 4 % — long ease-out tail (~300 ms), and the outgoing title fades faster (gone in 2 frames) than the incoming arrives (4–5 frames). Keyboard/CTA 10, 34, 25, 18, 10, 3 % — soft start (iOS keyboard curve). The back transition has no positional easing to speak of; layers crossfade linearly over ~3 frames.

**Corrections vs the coarse pass.**
- Tray enter is 150–200 ms, not 250; the top edge is 97 % home at +150 ms.
- Body text is clipped behind the CTA as the tray grows (the button reveals it), not just 'riding the top edge'.
- The CTA also widens ~8 pt, not only rises.
- Scrim is at full strength on the first tray frame (≤ 50–100 ms), not tweened with the tray.
- The card→badge morph is the fastest layer (200 ms) and the lock glyph appears on the card while it is still ~0.6×; the badge is at rest 100 ms before the titles finish.
- The incoming title starts ~110 pt to the right, not 75, and its travel tails to 300 ms; the outgoing title only moves ~26 pt.
- Back: no travel at all — the card does not fly out of the badge, it fades in at ~98 % scale where it belongs; the keyboard fades out in place instead of sliding down; the two CTAs crossfade in place.

**In Wavlength.** Keep the mic-permission tray grown from 'Start listening' and the mic hero collapsing into a header badge. Numbers: tray in 180 ms with 40/80/97 fractions, scrim on in ≤ 100 ms, text hidden behind the CTA until revealed; tray out 120 ms; hero→badge 200 ms front-loaded with the badge glyph fading in on the hero at ~0.6×. Forward step: titles slide (out 26 pt / in 110 pt with a 300 ms tail); back step: everything crossfades in place, including any keyboard, in ~180 ms.

## 50 — Content-height warning tray (same 4-frame grow as the short tray, so taller = faster) + directional step slide with a shared offset for title and content; back is an in-place crossfade
*Essay section:* SIMPLICITY 'each subsequent tray varies in height' + FLUIDITY directional step transition (keep). Sibling of clip 49.

**What happens.** Tray enter: 'I Understand, Continue' pressed 0.10–0.25. 0.30: scrim ~40 % of its final strength, tray top edge 33 % of its ~330 pt travel (this tray's top edge ends ~45 frame-px below the subtitle, vs ~108 for clip 49's), icon/×/first title line pinned to the moving top edge, everything below the title hidden behind the CTA. 0.35: scrim full, top edge 78 %, three paragraphs revealed from under the CTA. 0.40: 98 %. 0.45: at rest. The CTA rises ~13 pt and widens ~8 pt, label unchanged. Exit: CTA pressed 1.40–1.45. 1.50: top edge has dropped 44 %, scrim ~half, body text clipped by the CTA again. 1.55: 96 %, only icon and × left above the CTA, scrim gone. 1.60: tray gone; disclaimer back at ~80 %. 1.65: clean. Step to Confirm Backup (starts 1.80–1.85, ~200 ms after the tray closed): at 1.85 'Manual Backup' has moved ~27 pt left at ~50 %, 'Confirm Backup' is +77 pt right at ~50 %, and the word pill 'butter' and the number grid are at +65…+84 pt at ~35 % — the same horizontal offset as the title, i.e. one shared slide, not a stagger. 1.90: title +41, grid +39, pill +38 (identical); opacities 85 / 70 %. 1.95: +22, ~100 / 90 %. 2.00: +11. 2.05: +6. 2.10: +3, settled. The phrase card shrinks into the nav badge: 0.62× at 1.85 (lock glyph already visible on it), 0.38× at 1.90, 0.21× at 1.95, badge at 2.00. The old CTA fades in place (70 → 40 → 15 → 0 % over 1.85–2.00), with the grid's '10 11 12' drawn through it. Back (‹ at ~3.00): 3.05 faint card ghost (~10 %) at full size and final position; 3.10 card ~45 %, badge ~60 %, numbers ~70 %, 'Manual Backup' ~20 % *over* 'Confirm Backup' at the same x, bottom CTA ~50 %; 3.15 card ~80 %, titles ~50/50, badge ~25 %; 3.20 clean. Nothing translates on the way back.

**Timing.** Tray enter 0.30→0.45 = 150–200 ms (98 % at 150 ms) — the same frame count as the 390 pt tray in clip 49 although this one is ~530 pt tall, so the top edge simply moves faster. Scrim ~100 ms (two frames). Tray exit 1.50→1.60 = 100–150 ms. Step: card→badge 200 ms; title/content slide ~300 ms with the last 20 % spread over 150 ms; old CTA fade 150 ms. Back ~150–200 ms. Confidence: high.

**Easing.** Tray in 33, 45, 20, 2 % per frame — ease-out, no overshoot; tray out 44, 52, 4 % — faster and closer to linear. Slide-in offsets 77 → 41 → 22 → 11 → 6 → 3 pt: each frame roughly halves the remainder (exponential / critically damped, ~50 ms time constant). Card→badge scale 38, 24, 17, 21 % of the shrink per frame — front-loaded and finished ahead of the slide. Opacity layers ~linear over 2–3 frames. The taller tray and the shorter one share duration and curve, not speed.

**Corrections vs the coarse pass.**
- 'Top edge drops ~40 pt in the first exit frame' is wrong: it drops ~44 % of ~330 pt (≈145 pt) in the first frame; exit is 100–150 ms, not 150–200.
- The step transition has no positional stagger: title, pill and grid share one x-offset per frame. Any lag is ≤ 15 % in opacity, which may just be contrast. Drop the '~30–50 ms stagger' rule.
- The incoming content starts ~+75–85 pt, not +50/+75 split, and takes ~300 ms to fully settle (long tail), not 250.
- Tray enter is 150–200 ms, not 250, and the scrim ramps over ~100 ms rather than appearing with the tray.
- Back is a pure in-place crossfade (card fades in at final size; titles stack; CTA crossfades) — no travel, no badge→card flight.
- New: the taller tray grows in the same 4 frames as the short one — duration is fixed, velocity scales with height.

**In Wavlength.** Keep the taller 'Turn on Party mode?' vs shorter 'Join room?' trays; both must use the same 180 ms / 33-78-98 curve so the taller one reads heavier by height, not by slowness. Sign-in → Party onboarding steps: slide title and content together from +80 pt with a half-life of ~50 ms (settles ~300 ms), fade the outgoing title over 100 ms with a 27 pt drift left, and crossfade the CTA in place; the back step is a 180 ms in-place crossfade with no motion.

## 51 — Dark tray grown from the CTA with a label that extends past the pill's edge; chip state morph 'Use Max' → 'Using Max' anchored on 'Us'; all-digits-change amount uses a scale-crossfade, not a roll
*Essay section:* SIMPLICITY 'tray theme adapts (dark flow → dark tray)' + FLUIDITY 'buttons morph into trays' and the label morph (keep).

**What happens.** Use Max on: press ring on the chip 0.35–0.60 (held ~250 ms). 0.65: '$0' still ~70 % and a grey, slightly blurred '$299.52' at ~25 % is drawn centred *through* it at ~0.93 scale; the ETH line likewise shows both '0' and '0.08946143'. The chip reads 'Us e Max' — 'Us' has stayed put (≤ 2 pt drift), a gap has opened for 'ing' and 'e Max' has shifted right ~12 pt; the grey fill is still there. 0.70: '$299.52' ~80 %, full size, faint '$0' ghost; chip is 'Using Max' in amber with the outline on and the fill ~gone; Continue has begun to lighten. 0.75: amount clean; Continue ~near-white. 0.80: Continue white. Tray: press on Continue 1.45–1.65. 1.70: scrim already ~half (amount dimmed), no tray yet. 1.75: tray top edge 31 % of its ~400 pt travel; 'Max ●' pill and the first title line ride the top edge; the CTA label already reads 'Continue with Adjustmen' — 'Continue' has shifted ~20 pt left and 'with Adjustments' (~50 %) is clipped by the pill's right edge as it extends. 1.80: 77 %; scrim full (~60 % black); label complete and centred. 1.85: 96 %. 1.90: 99 %. 1.95: at rest. Dismiss: scrim pressed 3.75–4.00 (held 250 ms). 4.05: scrim ~half lifted, top edge 18 % down, 'with Adjustments' dimming to ~50 % while 'Continue' stays bright; the 'Ethereum / Using Max' row is revealed above the shrinking tray. 4.10: 56 %, scrim gone, label tail ~40 % and clipped. 4.15: 74 %, tray a sliver above the CTA. 4.20: tray gone, faint label ghost. 4.25: clean. Use Max off: 4.75 chip starts 'Usi ng Max' collapse; 4.80 amount ~60 % with a '$0' ghost and the chip's grey fill returning; 4.85 '$0' ~80 %, '299.52' ~30 % ghost, chip 'Use Max'; 4.90 clean; Continue greys out 4.85–4.95.

**Timing.** Amount swap 150 ms (0.65→0.75) both ways; chip morph 100–150 ms; CTA enable fill 150 ms, starting one frame after the amount. Tray enter 1.75→1.90 = 150–200 ms (96 % at 100 ms after the first visible frame); scrim ramps ~100 ms and starts a frame *before* the tray. Label extension ≤ 100 ms. Dismiss 4.05→4.20 = 150–200 ms; scrim lifts in ~100 ms from the tap. Confidence: high.

**Easing.** Tray in 31, 46, 19, 3, 1 % — the same front-loaded 4-frame curve as the light trays (49/50), no overshoot. Tray out 18, 38, 18, 26 % — softer start than the light-tray exits, closer to ease-in-out, and 50 ms longer. Amount: opacity crossfade with a ~0.93→1.0 scale on the incoming string and a touch of blur — a whole-string swap because every digit changes; nothing rolls. Chip: the shared 'Us' is anchored; inserted letters fade in while the tail translates — the chip grows ~10 pt left and ~5 pt right, so it is not strictly right-anchored.

**Corrections vs the coarse pass.**
- The amount does *not* roll digits; when every digit changes Family crossfades the whole string with a small scale (0.93→1) and blur. Rolls are reserved for partial changes (see 53/55).
- Tray enter is 150–200 ms, not 250; the scrim leads the tray by a frame rather than appearing with it.
- The label morph is not 'in step with the tray': it completes in ≤ 100 ms while the tray takes 200, and the extension is visibly clipped by the pill's edge mid-morph (the pill widens at the same time).
- Dismiss is 150–200 ms and eases in-out, not '200–250 ms, a little faster'. The label shrinks back by fading the tail ('with Adjustments') while 'Continue' re-centres, and the tail ghost outlives the tray by ~50 ms.
- Chip morph: 'Us' is anchored on the left and the chip grows mostly leftward (~10 pt) — the coarse pass had the prefix but not the growth direction.
- Press-hold before any response is ~250 ms on all three taps.

**In Wavlength.** Keep the dark Resync tray with the 'Continue with adjustment' extension and the 'Auto-sync' → 'Syncing' chip morph, 60 % scrim in Party mode. Numbers: scrim 100 ms leading, tray 180 ms (31/77/96), label extension 100 ms clipped by the pill while the pill widens; dismiss 180 ms ease-in-out with the label tail fading. When the whole value changes (song title, full offset reset) use a 150 ms crossfade with 0.93→1 scale, not RollingNumber; roll only partial digit changes.

## 52 — Anchored pop-menu, then tray→tray morph: height tween with a top-pinned crossfade where the menu fades slowest; explainer illustration wobbles then spins on Y
*Essay section:* SIMPLICITY 'each subsequent tray varies in height' and 'trays preserve context' (keep). The arrow is a small Delight touch (keep).

**What happens.** Menu: '…' pressed 1.00–1.10. 1.15: the dropdown is present at ~0.5 scale and ~30 % opacity, anchored to the '…' at its top-right corner, its rows already laid out (not a growing clip); tray content underneath begins to lighten. 1.20: ~0.8 scale, ~60 %. 1.25: ~0.95, ~85 %. 1.30: full — opaque white, radius ~14 pt, soft shadow. There is no extra scrim; the tray content simply sits behind it. Morph to explainer: 'Learn More' pressed 1.85–2.00. 2.05: the tray's top edge has risen 13 % of its ~140 pt growth; the detail content dims to ~85 %, a faint green wash and the explainer's 'Reviewing received transactions' line are already visible, × appears top-right. 2.10: top edge 65 %; green header ~50 %, old header/'$1.05' ~50 % and slightly blurred, menu still ~60 % and pinned where it was; both content stacks ride the moving top edge. 2.15: 91 %; green ~85 %, old content ~15 %, menu ghost ~30 %. 2.20: 97 %, only a menu ghost remains. 2.25: settled, 'Got It' sits where the bottom of the old tray was (bottom anchored). Illustration: still until ~2.55, then tilts anticlockwise to ~-20° by 3.00 with a small secondary fragment peeking from the bottom-right (2.60–2.80), holds the tilt to ~3.30, then spins about the Y axis: edge-on at 3.60 and again at 3.80 (a 180° turn every ~200 ms → one full turn 3.40→3.95, the back face visibly wider at 3.70), upright and at rest by 4.00. Back: 'Got It' pressed 4.70–4.90. 4.95: top edge dropped 30 %; the green header is ~70 % with 'Received from / $1.05' drawn over it at ~50 %. 5.00: 65 %, green ~35 %, '$1.05' ~85 %, 'Completed' arriving. 5.05: 88 %, green ~10 %. 5.10: 97 %. 5.15: settled at the original height.

**Timing.** Menu pop 1.15→1.30 = 150–200 ms (scale 0.5→0.95 in 100 ms). Tray→explainer 2.05→2.25 = 200 ms (65 % of the height at 100 ms). Explainer→detail 4.95→5.15 = 200–250 ms (65 % at 100 ms) — the same as forward, not longer. Crossfade midpoint ≈ +100 ms in both directions; the menu ghost lingers ~100 ms past the old tray content. Illustration: ~300 ms idle after the tray settles, ~750 ms tilt-and-hold, ~550 ms spin, then still. Press-holds 100–200 ms. Confidence: high for the tray morphs, medium for the illustration phases (sampled every 4 frames).

**Easing.** Height forward 13, 52, 26, 6, 3 % — soft first frame then ease-out; back 30, 35, 23, 9, 3 % — slightly more linear. No overshoot either way. Opacity of the two content stacks crosses at ~50/50 one frame after the height's fastest frame, so the crossfade runs ~50 ms behind the geometry. Menu: scale ease-out (0.5 → 0.8 → 0.95 → 1.0) with a linear fade — no bounce. Illustration is the only non-monotonic motion: the tilt has a small anticipation, and the spin is constant-velocity.

**Corrections vs the coarse pass.**
- The menu does not just 'appear': it scales up from its '…' anchor 0.5→1.0 over ~150 ms with a fade.
- Tray→explainer is 200 ms and *was* caught mid-way (65 % at +100 ms); explainer→detail is 200–250 ms, not 350–400. The two directions are near-symmetric.
- The old menu survives into the morph as the slowest-fading layer (~30 % at 2.15), while the old tray content is nearly gone; the coarse pass assumed the menu vanished on tap.
- Content is pinned to the top edge in *both* directions (coarse had this only for the shrink), and the crossfade lags the height by ~50 ms.
- Illustration choreography: ~300 ms idle, tilt to ~-20° with a hold, then a single Y-axis spin with edge-on frames 200 ms apart; total ~1.5 s (matches), but it is tilt→hold→spin, not a wobble throughout.

**In Wavlength.** Keep: now-playing '…' → menu → 'How sync works' grows the same tray into a coloured explainer; 'Got it' shrinks it back. Numbers: menu pops from its anchor 150 ms (scale 0.5→1, ease-out, linear fade); tray height tween 200 ms (13/65/91/97) with both content stacks pinned to the top edge and a 50/50 crossfade at +100 ms; let the menu fade out ~100 ms slower than the rest. The waveform illustration should wait ~300 ms after the tray lands, animate once for ≤ 1.5 s, then hold still.

## 53 — Chart line MORPHS between series (y-values tween) while the change label counts through intermediate values with odometer digits, the arrow rotates and the colour follows
*Essay section:* FLUIDITY: the with/without 'price charts vs Cash App' comparison, Family side (keep).

**What happens.** Five range taps, all reacting ~50 ms after touch-up (press ring 150 ms, e.g. 0.50–0.65, response at 0.70). Chart: the line does not swap, it tweens. 1H→1D: 0.70 shows the old plateau with the new jitter superimposed (points half-way), 0.75 mostly new, 0.80 settled — a 100–150 ms shape morph with the end dot and halo present throughout. 1D→1W (1.60→1.75) and 1Y→1H (4.30→4.40) do the same: 3 frames, amplitude growing into the new shape. The range pill highlight moves in ≤ 1 frame. Label: 1H→1D, 0.11→0.16: the last digit is a scrolling strip that passes *through* 3, 4, 5 (0.70 '0.1[3]', 0.75 '0.14', 0.80 '0.1[5→6]', 0.90 '0.16') — ~1.2 digits per 50 ms. 1D→1W, ↓0.16 → ↑0.10: 1.60 arrow ~20° turned, digits 0.15; 1.65 arrow at ~135° (↖) and already green, digits 0.12; 1.70 ↑ 0.1[1]; 1.75 ↑0.10 — the value counts down 6→5→2→1→0 while the arrow turns 180° in 150 ms. 1W→1M, ↑0.10 → ↓0.23: 2.45 arrow starts, tenths and hundredths roll together; 2.50 arrow horizontal (90°), '0.21'; 2.55 ↙ '0.22'; 2.60 ↓0.23 still green; 2.65–2.75 green fades to grey; 2.80 grey. 1M→1Y, 0.23 → 0.0007: 3.30 both digits rolling; 3.35 the string has become '0.120%' — an extra digit is inserted and the arrow moves left (right edge anchored); 3.40 '0.0006' (five digits); 3.45 '0.000[7]'; 3.50 done. The number is interpolated, not just re-rendered, so it counts down through 0.12 and 0.0006. 1Y→1H, 0.0007 → 0.11: 4.35 digits rolling with a gap where the surplus digits are collapsing; 4.40 '0.11 %' with the gap still open; 4.45 '0.11%' — width collapses one frame after the digits settle. '$1.000' never changes.

**Timing.** Chart morph 100–150 ms (3 frames), starting the same frame as the label. Label roll 200–250 ms for 5 digit-steps, ~150 ms for 2–3 steps — duration scales with the count distance. Arrow 180° = 150 ms (3 frames), starting with the digits. Colour: to green ≤ 100 ms after the arrow starts; to grey starts ~150 ms after the arrow and takes ~150–200 ms (asymmetric, or green just reads longer). Width change ~150 ms, one frame behind the digits. Confidence: high on frame counts; medium on whether the roll is a true value tween vs a per-digit strip (both fit; the inserted-digit case favours a value tween).

**Easing.** Chart y-tween ~40/40/20 % per frame — ease-out, no overshoot. Digit strip moves at roughly constant speed (≈1 digit per frame) then stops; the last step is slightly slower (the '6' and '0' are still half a row off one frame before rest). Arrow rotation ≈ 20°, 115°, 45° — ease-in-out. Colour is a plain linear crossfade.

**Corrections vs the coarse pass.**
- The chart is not an instant swap: it morphs (y-values interpolate) over 100–150 ms. That is the actual 'no loader' trick — old shape becomes new shape.
- Digits count through intermediate values (0.11→0.13→0.14→0.15→0.16), they do not roll directly from old digit to new. With 0.23→0.0007 the value passes through 0.12 and 0.0006 and gains digits mid-roll.
- Arrow rotation is 150 ms, not 250–300; numbers do *not* 'deliberately trail the chart' — they start on the same frame and finish ~100 ms later only because the roll is longer.
- Colour lag is direction-dependent: grey→green is immediate with the arrow, green→grey lags ~150 ms.
- Right-aligned width changes settle one frame after the digits (the gap is visible), so width and digit animations are separate tweens.

**In Wavlength.** 'CHORUS IN 12s' and the sync offset use an odometer that counts through intermediate values at ~1 digit per 50 ms (so 12→9 takes 150 ms, 0.4→1.2 takes ~250 ms), right-aligned with tabular figures and a width tween that lags ~50 ms. Recap stat tabs: tween the energy/BPM line's y-values over 120 ms rather than swapping. The ahead/behind arrow rotates 180° in 150 ms with ease-in-out, and its green/grey crossfade starts with the arrow.

## 54 — Anti-pattern: dip-to-white crossfade with a spinner and a hard-cut label (Cash App)
*Essay section:* FLUIDITY: the with/without 'price charts vs Cash App' comparison, Cash App side (keep).

**What happens.** Five range taps (1D→1W, 1W→1M, 1M→1Y, 1Y→ALL, ALL→1D), all the same sequence. Press ring on the pill ~200 ms (0.70–0.90). 0.80: the old red line drops to ~70 % and a small red arc spinner (~16 pt) appears at the chart's left-centre; the grey pill highlight has already jumped to the new range. 0.85: ~45 %. 0.90: ~25 %, spinner still turning. 0.95: the label hard-cuts '↑3.08%' → '↑4.93%', the spinner is gone, and the NEW line appears at ~30 % — the shape changes on this frame, at the bottom of the opacity dip. 1.00: ~50 %. 1.05: ~75 %. 1.10: ~90 %. 1.15: full red. The other taps match: 1W→1M dips 1.90→1.95, label + new line at 2.00, full at 2.20; 1M→1Y dips 2.95→3.05, label 3.10, full 3.25; 1Y→ALL dips 3.80→3.95 (spinner visible for 4 frames — the fetch took longer), label 4.00, full 4.15; ALL→1D dips 5.40→5.50, label 5.55, full 5.65. Nothing in the header moves; the '%' string just re-renders, including width changes (5.79% → 87.66% → 53,360.50%), with no roll and no arrow motion (always ↑). The y-scale re-fits instantly with the new line.

**Timing.** Fade-out 100–150 ms (2–3 frames), spinner visible 100–200 ms depending on the fetch, fade-in 150–200 ms (3–4 frames). Total 300–400 ms after touch-up, plus the ~200 ms press-hold — about twice the felt duration of Family's 150–250 ms morph in clip 53. Label 0 ms. Pill highlight 0 ms. Confidence: high.

**Easing.** Opacity out ≈ 30/25/20 % per frame (roughly linear), in ≈ 20/25/25/15 % (linear with a soft end). No positional or shape easing exists: the shape is swapped at ~25 % opacity so the jump is partly hidden, but it is still a jump, and the spinner announces 'loading' for every tap even when the data arrives within one frame.

**Corrections vs the coarse pass.**
- The label cut is not 'sometimes before, sometimes after' the line: in all five changes it lands on the exact frame the new line first appears (the bottom of the dip).
- The old line does not sit at 30 % 'while data loads'; it fades continuously to ~25 % over 100–150 ms and the new line fades up from there — a dip-to-white crossfade with the spinner overlaid during the dip.
- Per-change total is ~300–400 ms after touch-up (450–500 in the coarse pass included the press-hold); the ALL fetch shows the spinner phase stretching when data is slow, which is the real cost: duration is unpredictable.
- The pill highlight jumps on the first fade frame, before the data — the only thing that responds immediately.

**In Wavlength.** Unchanged in spirit: on a song switch or resync never dip the lyrics panel, never overlay a spinner, never hard-cut the title. Keep the current lines on screen at full opacity, morph the title/artist with MorphText, and count numbers through with the odometer. If new data has not arrived, keep showing the old data unchanged (Family) rather than fading it (Cash App); skeleton lines are only for a truly empty first state.

## 55 — Chart scrub: contracting touch halo, dimmed future segment, odometer readout, arrow rotates before colour
*Essay section:* DELIGHT: 'chart scrub flips the up/down arrow with the numbers' (keep).

**What happens.** Static until 0.70 s. Touch-down 0.75 s: a soft double ring (~2× final size) appears at the finger, no dot yet; the same frame the header starts rolling from '$0.89 ↓21.68%' with the arrow already diagonal. 0.80 s: ring at ~1.3×, purple dot with white stroke on the line inside it, arrow ~↑, text turning green; line still fully purple. 0.85 s: ring at its final ~40 pt translucent grey-stroked disc, 'Mar 13 9:00pm' pill fades in above it, right-hand segment starts lightening. 0.90 s: guideline visible, segment ~50 % dimmed. 0.95 s: digits settle on '$1.25 ↑10.94%'. 1.00 s: segment at ~20 % lavender; left of the dot stays saturated. The roll shows intermediate numerals ('$1.36', '10.85') with the finger still, so each column spins like an odometer. While dragging (1.30–2.65 s) values change per frame with at most one ghost frame; the leading '1' of '10.94' grows in from the left. Arrow flip 1.45→1.55 s: ↑ → ↖ → ↓ with the text still green; grey arrives 1.65–1.70 s. Release 3.50 s: digits and arrow start; 3.55 s ring, dot, pill gone (plain fade), segment ~50 % restored; 3.60 s line fully purple, arrow ↓; 3.70 s digits settled on '$0.89 ↓21.68%' but still green; 3.70→3.85 s green fades to grey.

**Timing.** Touch-down 0.75→1.00 s = 250 ms: halo contract 150 ms, dot +50 ms, dim 0.85→1.00 = 150 ms, readout roll 200 ms, arrow 100 ms. Scrub rolls ≤50–100 ms. Release: cursor/pill fade ≤100 ms, segment restore 100 ms, roll 200 ms, arrow 100 ms, colour 150 ms starting after the digits land; settled by ~350 ms. Confidence: high.

**Easing.** Halo contraction front-loaded (~70 % in the first frame). Digit columns roll near-linearly (odometer). Dim/restore are 2–3 frame fades, no overshoot anywhere. Layers do not share a curve: staggered starts (halo and digits at 0, dot +50, dim +100 ms) and lengths (arrow 100 < dim 150 < digits 200, colour a further 100–150 behind).

**Corrections vs the coarse pass.**
- Missed the touch halo: a ~40 pt translucent disc that appears at 2×, contracts, and persists under the finger; the date pill sits above it.
- Dot appears one frame after the halo; dimming two frames after.
- Scrub rolls are ≤100 ms, not 150–250; 200 ms applies only to the first jump and the release roll-back.
- Rolls spin through intermediate numerals, not a straight old→new slide.
- Release roll-back is 200 ms, not 350–400; 350 ms is when colour finishes. Segment restore is 100 ms.
- Fixed order arrow → digits → colour; colour lags the arrow 100–150 ms and on release waits for the digits.

**In Wavlength.** Sync-rail drag: contracting halo under the finger (150 ms), dim lyric lines past it 100 ms later, roll the offset in ≤100 ms odometer steps, rotate the ahead/behind arrow in 100 ms with colour following 100–150 ms later. On release: fade cursor and restore dimming in 100 ms, roll the value in 200 ms, then drift the colour. Same recipe for scrubbing the Recap timeline.
