# Wavlength motion and craft rulebook for Flutter on iOS

Built from the nine installed skills, with every web mechanism translated to Flutter 3.47.5 (the SDK installed at `/opt/homebrew/share/flutter`). I checked each Flutter API claim against that SDK's source.

## How to read this

**Files read, all 13:**
- `~/.claude/skills/emil-design-eng/SKILL.md`
- `~/.claude/skills/apple-design/SKILL.md`
- `~/.claude/skills/web-animation-design/SKILL.md`, `PRACTICAL-TIPS.md`
- `~/.claude/skills/animation-vocabulary/SKILL.md`
- `~/.claude/skills/review-animations/SKILL.md`, `STANDARDS.md`
- `~/.claude/skills/improve-animations/SKILL.md`, `AUDIT.md`, `PLAN-TEMPLATE.md`
- `~/.claude/skills/find-animation-opportunities/SKILL.md`
- `~/.claude/skills/prototype/SKILL.md`, `PICKER.md`
- `~/.claude/skills/pick-ui-library/SKILL.md`

**Source tags used below:**
- **[S:skill]** means the value or rule is stated in that skill. Short names: emil, apple, wad (web-animation-design), std (review-animations STANDARDS), audit, find, vocab, proto, lib.
- **[F]** means a Flutter fact I checked in the SDK source.
- **[P]** means my proposal for wavlength. The skills do not state it.

**What the skills do not cover.** For these the values here are marked [P]:
- Shimmer speed, direction and width.
- How to build an odometer or a shared-letter morph. vocab only names "Text morph", "Number ticker" and "Tabular numbers"; lib only names the web libraries NumberFlow and torph.
- Spotify's Encore design system. Nothing in the skills mentions it.
- Anything about Family beyond emil's note on Family's drawer: getting opacity and height to work together "is trial and error, there is no formula."
- Which haptic to use for which event.

**Where the skills disagree, and the rule I chose:**

| Conflict | Chosen rule |
|---|---|
| Modal and drawer duration: emil and std say 200–500 ms; wad says 200–300 ms | Taps that open a tray: ≤ 400 ms. Everything else: ≤ 300 ms. |
| Reduced motion: wad says disable everything, "no exceptions for opacity or color". emil, apple, std and audit say "gentler, not zero". | Keep opacity and color changes at ≤ 200 ms; remove all movement. Four skills against one, and it matches iOS's own behavior. |
| Spring example: emil and wad use `{duration 0.5, bounce 0.2}`. apple says the default is critically damped and bounce belongs only after momentum. | Default bounce is 0. Use bounce 0.2 only after a flick or drag release, or for a rare delight moment. |
| Sonner's toasts use 400 ms `ease` ("slightly slower, more elegant") against the ≤ 300 ms ease-out rule | This is an allowed exception for a component with that personality. It is not the default. |
| Hysteresis: apple says about 10 px; Flutter's `kTouchSlop` is 18 lp **[F]** | Use Flutter's slop. Don't stack a second threshold on top of it. |

---

## 1. The gate: should it animate at all?

Every animation must pass four questions, in order. **[S:find, emil, std]**

**1. Frequency.**

| How often it's seen | Decision |
|---|---|
| 100+ times/day | No animation. Ever. |
| Tens of times/day | Remove it, or keep only near-imperceptible motion |
| Occasional (modals, drawers, toasts) | Standard animation |
| Rare or first-time | Delight is allowed |

Keyboard-initiated actions are disqualified outright. On iPhone, the equivalents are very frequent taps: tab switches and mode re-taps.

**2. Purpose.** It must be one of: feedback, spatial consistency, state indication, preventing a jarring change, explanation (onboarding and marketing only), or delight (rare tier only). "It looks cool" is not a purpose.

**3. Speed.** It must fit the budget: UI under 300 ms. If it only works as a slow, showy animation, it fails.

**4. Function.** Data the user is reading or acting on does not move for style. That covers the lyrics text, the Log rows and the Recap numbers once they've landed.

**Order of fixes when something is wrong [S:std]:** delete, then reduce, then fix easing, then fix origin, then make interruptible, then move to GPU-only properties, then asymmetric timing, then polish, then accessibility and cohesion. "When unsure whether motion feels right, the strongest move is often to delete it."

### Frequency map for wavlength [P, applying the skill table]

| Surface | Tier | Verdict |
|---|---|---|
| Lyric line advancing (hundreds per night, driven by the music, text the user reads) | 100+ but system-driven | **Minimal only.** Change the ink color (~150 ms). Re-center the scroll with a critically damped spring. No scale, weight, font-size or haptic on each line. |
| Bottom tab switches (Listen, Party, Log, Recap, Settings) | Tens/day | Instant, or a ≤150 ms fade. No slide. |
| Normal/Party toggle, Next song, Resync presses | Tens/night | Press feedback only (scale 0.97). Sliding thumb 250 ms. |
| Chorus countdown digits | Once a second, about 12 s per chorus | Stepped digit roll ≤200 ms, tabular figures |
| Moment banner | Occasional | Standard toast rules |
| Song switch | Occasional (about every 3–4 min) | Standard continuity transition |
| Tray/sheet (people, settings) | Occasional | Standard. Spring plus gesture physics. |
| "Listening…" / "Finding lyrics…" | Occasional | Skeleton plus a status-label morph |
| First song recognized; Recap; first sign-in | Rare | Delight budget: springs with bounce, generous stagger, longer beats allowed |

---

## 2. Easing blueprint

### Decision tree [S:emil, wad, std, audit]

- Entering **or** exiting → ease-out.
- Otherwise, moving or morphing on screen → ease-in-out.
- Otherwise, a hover or color change → `ease`.
- Otherwise, constant motion (marquee, progress bar, shimmer, hold-fill) → linear.
- Default → ease-out.
- **Never ease-in on UI.** It starts slow, so it delays the exact moment the eye is watching. "ease-out at 200ms *feels* faster than ease-in at 200ms."
- **Built-in easings are too weak.** Use strong custom curves. Flutter's `Curves.easeOut` is `Cubic(0.0, 0.0, 0.58, 1.0)`, the weak CSS ease-out **[F]**. The same goes for `Curves.easeInOut` = `Cubic(0.42, 0, 0.58, 1)`.

### Core curves

| Role | CSS in the skills | Flutter (all are exact equivalents) [F] |
|---|---|---|
| **Enter / exit / default UI** | `cubic-bezier(0.23, 1, 0.32, 1)` | `Cubic(0.23, 1.0, 0.32, 1.0)`, which is `Curves.easeOutQuint` |
| **Move / morph on screen** | `cubic-bezier(0.77, 0, 0.175, 1)` | `Cubic(0.77, 0.0, 0.175, 1.0)`, which is `Curves.easeInOutQuart` |
| **Drawer / sheet (iOS-like, from Ionic)** | `cubic-bezier(0.32, 0.72, 0, 1)` | `Cubic(0.32, 0.72, 0.0, 1.0)` (no built-in) |
| **Color / tint** (the web's "hover") | `ease` | `Cubic(0.25, 0.1, 0.25, 1.0)`, which is `Curves.ease` |
| **Press** | `transform 160ms ease-out` [emil]; `100ms ease-out` [apple] | Enter/exit curve, 100 ms press-in, 160 ms release [P] |
| **Constant motion** | `linear` | `Curves.linear` |

### The full ease-out and ease-in-out ladders from wad (weak to strong)

Every entry maps exactly to a Flutter constant. **[F]**

| Ease-out | Flutter | Ease-in-out | Flutter |
|---|---|---|---|
| quad `(0.25,0.46,0.45,0.94)` | `Curves.easeOutQuad` | quad `(0.455,0.03,0.515,0.955)` | `Curves.easeInOutQuad` |
| cubic `(0.215,0.61,0.355,1)` | `Curves.easeOutCubic` | cubic `(0.645,0.045,0.355,1)` | `Curves.easeInOutCubic` |
| quart `(0.165,0.84,0.44,1)` | `Curves.easeOutQuart` | quart `(0.77,0,0.175,1)` | `Curves.easeInOutQuart` |
| quint `(0.23,1,0.32,1)` | `Curves.easeOutQuint` | quint `(0.86,0,0.07,1)` | `Curves.easeInOutQuint` |
| expo `(0.19,1,0.22,1)` | `Curves.easeOutExpo` | expo `(1,0,0,1)` | `Curves.easeInOutExpo` |
| circ `(0.075,0.82,0.165,1)` | `Curves.easeOutCirc` | circ `(0.785,0.135,0.15,0.86)` | `Curves.easeInOutCirc` |

### Flutter traps with easing (all [F])

1. **`controller.reverse()` plays the curve backwards.** Run an ease-out backwards and the exit becomes an ease-in: it starts slow. The skills want exits to be ease-out too. The fix:
   - Use `CurvedAnimation(parent: c, curve: WavMotion.easeOut, reverseCurve: WavMotion.easeOut.flipped)`.
   - `flipped` is `FlippedCurve(this)`, which has a const constructor.
   - Flutter's own `Hero` does exactly this by default: `reverseCurve ?? curve.flipped`. So do the Cupertino routes (`linearToEaseOut` / `easeInToLinear`).
   - This also covers apple's rule to "mirror the easing on reversible transitions".
2. **`AnimatedSwitcher.switchOutCurve` runs on the reverse path** (the outgoing child's controller goes from 1 to 0). Pass `switchOutCurve: WavMotion.easeOut.flipped`. The default is `Curves.linear`.
3. **`AnimationController` has no curve.** Driving a transition straight from the controller is linear. Always wrap it in a `CurvedAnimation`, or use `.drive(CurveTween(...))`.
4. **`AnimatedOpacity`, `AnimatedScale` and friends default to `Curves.linear`.** Always pass a curve.
5. **`Hero` defaults to `Curves.fastOutSlowIn`.** Shared-element flights are on-screen movement, so pass `curve: WavMotion.easeInOut`.

### The paired-elements rule [S:wad]

Elements that move as a unit use the same curve and the same duration. Examples: modal and overlay, tooltip and arrow, drawer and backdrop.

In Flutter, drive the tray and its scrim from **one** controller or `Animation`. Never give them two separate implicit animations.

**Cohesion exception [S:emil]:** Sonner is slightly slower and uses `ease` instead of ease-out, "to feel elegant". Personality can bend the curve. Consistency across the app is non-negotiable.

---

## 3. Springs

### When to use them [S:emil, wad, apple]

- Drags with momentum.
- Elements that should feel alive (like the Dynamic Island).
- Gestures that can be interrupted or reversed mid-motion.
- Decorative tracking of a value.
- apple: "Reach for springs for anything a user can touch."

### Parameters [S:apple]

- **Damping ratio:** 1.0 means critically damped (no overshoot). Below 1.0 it bounces.
- **Response:** in seconds. It is **not** a duration; the settle time emerges from the physics.
- **Default:** damping 1.0. Use about 0.8 **only when the gesture carried momentum**. "Overshoot on a menu that just faded in feels wrong; overshoot on a card you flicked feels right."
- **Bounce [S:emil, wad]:** keep it subtle, 0.1–0.3. Avoid it in most UI. It suits drag-to-dismiss and playful moments.

### Mapping to Flutter [F]

`SpringDescription.withDurationAndBounce(duration:, bounce:)` exists in 3.47. It is documented as "the same result as SwiftUI's `spring(duration:bounce:)`":
- stiffness = 4π²·m / d²
- damping ratio = 1 − bounce (for bounce > 0)

So **Apple's response is `duration`, and damping ratio r means `bounce = 1 − r`.** You can also use `SpringDescription.withDampingRatio(mass:, stiffness:, ratio:)`.

| Use | Apple (damping / response) | Flutter | k | c |
|---|---|---|---|---|
| Move / reposition (PiP) [S:apple] | 1.0 / 0.4 | `withDurationAndBounce(duration: 400ms, bounce: 0)` | 246.74 | 31.42 |
| Rotation [S:apple] | 0.8 / 0.4 | `(400ms, 0.2)` | 246.74 | 25.13 |
| Drawer / sheet [S:apple] | 0.8 / 0.3 | `(300ms, 0.2)` | 438.65 | 33.51 |
| Default UI [S:apple quick ref] | 1.0 / 0.3–0.4 | `(350ms, 0)` | 322.27 | 35.90 |
| Follow / re-center (lyric scroll) [P] | 1.0 / 0.3 | `(300ms, 0)` | 438.65 | 41.89 |
| emil/Motion `{duration 0.5, bounce 0.2}` | ≈0.8 / 0.5 | `(500ms, 0.2)` | 157.91 | 20.11 |
| emil `{mass 1, stiffness 100, damping 10}`, decorative tracking only | ratio 0.5 (very bouncy), response ≈0.63 s | `SpringDescription(mass: 1, stiffness: 100, damping: 10)` | 100 | 10 |

Caveats:
- `animateWith(SpringSimulation(...))` uses your spring. `AnimationController.fling()` uses its own default spring: stiffness 500, ratio 1.0, which is about response 0.28 s. **[F]**
- Motion's `duration` for springs is not exactly SwiftUI's perceptual duration. Treat the emil row as approximate and feel-check it on a device.

### How to drive a spring in Flutter [F]

- **Start it:** `controller.animateWith(SpringSimulation(spring, controller.value, target, controller.velocity))`. Passing `controller.velocity` carries momentum through a retarget, which is apple's "blend velocity, don't hard-cut".
- **Use an unbounded controller for bounce.** A bounded `AnimationController` (0..1) clamps its value, so an overshooting spring gets clipped. Use `AnimationController.unbounded(vsync: this)`, or set lower and upper bounds with room to spare.
- **Match the velocity units.** `SpringSimulation` velocity is in the simulation's own units per second. If the controller runs 0..1 over a travel distance of D px, then `velocity = gestureVelocityPxPerS / D`. This is apple's "relative velocity = gestureVelocity / (target − current)" idea. If the controller is in pixels, pass px/s directly.
- **Split 2D motion into two springs.** Use separate X and Y controllers. A single spring on a 2D distance desyncs when the two velocities differ. [S:apple]
- **Spring-as-`Curve`** (for implicit widgets) is fine for one-shot transitions. It loses the velocity advantage, because implicit widgets restart from zero velocity. Map normalised t onto about **1.5× the spring's duration** of simulated time, and give the widget that same duration. Otherwise time gets warped. At 1.5× the residual is below 0.1% for bounce ≤ 0.3. [P]
- **Decorative value-following** (emil's `useSpring` idea): for an audio-reactive ring, don't bind the visual straight to the raw mic amplitude ("feels artificial"). Retarget a spring toward it each frame. Only because it is decorative. [S:emil, applied P]

---

## 4. Duration rules

### Per-element budgets

| Element | emil / std / audit | wad |
|---|---|---|
| Button press feedback | 100–160 ms | micro-interactions 100–150 ms |
| Tooltips, small popovers | 125–200 ms | standard UI 150–250 ms |
| Dropdowns, selects | 150–250 ms | ″ |
| Modals, drawers | 200–500 ms | 200–300 ms |
| Marketing / explanatory | can be longer | can be longer |

### Rules [S:emil, wad, std]

- UI animations stay **under 300 ms**. Anything slower on a UI element needs a stated reason, or it is a finding.
- Larger elements animate more slowly than smaller ones. Duration scales with distance travelled.
- **Exits are about 20% faster than entrances** [wad]. "Same enter/exit transition speed → make exit faster" [emil].
- **Perceived performance:**
  - A 180 ms select feels more responsive than a 400 ms one.
  - A faster-spinning spinner makes loading feel faster, with the same real load time.
  - After the first tooltip, open the rest instantly: skip the delay and the animation.
- **Asymmetric timing.** "Slow where the user is deciding, fast where the system is responding." Hold-to-delete fills over 2 s linear while pressed and snaps back in 200 ms ease-out on release. Symmetric timing on a press-and-release or hold is a finding.
- **Frequency rule.** 100+/day gets none. "Raycast has no open/close animation." Use your own product every day to find which animations become annoying.
- **Stagger is decorative.** Never block interaction while it plays.
- **Springs** are judged by perceptual response (0.3–0.4 s), not settle time.

### Flutter notes

- Platform navigation is exempt. `CupertinoPageRoute` and `CupertinoSheetRoute.transitionDuration` are 500 ms by design **[F]**, and they are the native feel.
- The in-app tray may use up to 400 ms on tap-open. [P]

---

## 5. Enter and exit specifics

**Scale.** Never animate from `scale(0)`. "Nothing in the real world appears from nothing"; think of a deflated balloon.
- Enter from 0.95, or anywhere in **0.9–0.97**, always together with opacity 0 → 1. [S:emil, std]
- Tooltips and small popovers: 0.97. [S:emil]
- Press: 0.97, subtle range 0.95–0.98.
- Flutter: `ScaleTransition(scale: Tween(begin: 0.96, end: 1.0).animate(curved), alignment: ...)` wrapped in a `FadeTransition`.
- A bare `FadeTransition` entrance with no initial transform is an escalation trigger. [S:std]

**Transform origin, which is `alignment` in Flutter.** [S:emil, apple, vocab]
- Popovers, menus and tooltips scale from their **trigger**. Compute `Alignment` from the trigger's centre relative to the popover's rect: `Alignment((tx - cx) / (w/2), (ty - cy) / (h/2))`.
- **Modals are exempt.** They stay at `Alignment.center`.
- Relevant places: the Party mode picker, the long-press menus on Log rows, and Moment chips.

**Translating by the element's own size.** `translateY(100%)` becomes `FractionalTranslation(translation: Offset(0, 1))` or `SlideTransition`. Offsets there are fractions of the child's own size **[F]**. Prefer these over hard-coded pixels. [S:emil]

**Stagger and entrance offset.**
- Items rise from `translateY(8px)` with opacity 0, over 300 ms ease-out. [S:emil]
- Gap between items: **30–80 ms** (emil's example uses 50 ms).
- Flutter: one controller for the whole group, with `Interval(i*gap/total, (i*gap+d)/total, curve: easeOut)` per item.
- Cap the staggered items at about 6; the rest enter with the last one. [P]
- Never block taps while the stagger plays.

**Blur.**
- Mask an imperfect crossfade with `filter: blur(2px)` during the transition. It blends the two states into one perceived object. [S:emil]
- Keep blur under 20 px ("expensive, especially in Safari").
- Flutter: `ImageFiltered(imageFilter: ImageFilter.blur(sigmaX: 2, sigmaY: 2))`. CSS `blur(Npx)` takes the standard deviation, so it maps to σ = N.
- **Blur on exit:** content that leaves fades, blurs about 2 and moves slightly, all together.
- **Materialize, don't just fade** [S:apple]. Glass surfaces animate blur radius and scale together on enter and exit.

**Symmetric paths** [S:apple, find]. Enter and exit along the same path. A toast that enters from the top leaves through the top. A panel that slides in from the right is dismissed to the right.

**Direction-aware transitions** [S:vocab]. Moving forward slides one way and going back slides the other. Use this for the Recap story pages.

**Entering without JS state** (`@starting-style` on the web). In Flutter:
- Start a controller in `initState` and call `forward()`.
- Or use `TweenAnimationBuilder` with the begin values set.
- Or use `AnimatedSwitcher` with a `ValueKey`.

**Opacity plus height** (Family-style drawers and lists, accordions) [S:emil, find]. It is "trial and error, no formula". It is sanctioned for accordions and collapses.
- Flutter: `SizeTransition` plus `FadeTransition` from one controller.
- Starting point [P]: on enter, fade over `Interval(0.3, 1.0)`; on exit, fade over `Interval(0.0, 0.5)`.

---

## 6. Interruptibility, the most important principle [S:apple]

"The thought and the gesture happen in parallel." A user must be able to grab anything mid-flight and reverse it. A closing tray that is grabbed again follows the finger. It does not finish closing first.

### Web mechanism to Flutter [F]

| Web | Flutter equivalent | Behavior |
|---|---|---|
| CSS transition (retargets) | Implicit widgets (`AnimatedFoo`, `TweenAnimationBuilder`), and `controller.forward()`/`reverse()` from the current value | Starts from the **current value**, because `tween.begin = tween.evaluate(_animation)`. Implicit widgets then restart with the full duration and curve via `forward(from: 0)`. Velocity is **not** carried over. Good enough for toggles, highlight changes and the banner. |
| `@keyframes` (restart from zero) | `controller.forward(from: 0)`, `TweenSequence` on toggles, `repeat()`, resetting the value to the start before animating | Restarts from zero, which is an escalation trigger on anything triggered rapidly |
| Spring (keeps velocity) | `controller.animateWith(SpringSimulation(spring, controller.value, target, controller.velocity))` | Retargets from the live value **and** its velocity. Required for gestures. |

### Rules

- **Never lock out input during a transition.** No `if (controller.isAnimating) return;` on user input. No `AbsorbPointer`/`IgnorePointer` toggled while the tray animates. [S:apple]
- **Always animate from the on-screen value, never the target.** In Flutter, `controller.value` *is* the on-screen value. Never snap it to a logical value before starting the new animation.
- **When a gesture reverses, blend the velocity.** Swapping one animation for another at a reversal creates a "brick wall". Use the spring retarget above.
- **Use `ScrollController.animateTo` with care.** It retargets from the current offset with zero velocity, so each new call is a small brick wall. The lyric panel retargets every line, so it should run its own unbounded controller with a spring and call `position.jumpTo` on each tick. [P]
- **`AnimatedSwitcher` under rapid changes** stacks several outgoing children. That is fine for 1 Hz digits. For anything that changes faster than its own duration, retarget one controller instead.

---

## 7. Gestures, drag, sheets [S:apple, emil]

**Respond on touch-down, commit on touch-up.** Feedback must be continuous during the gesture, never only at the end.
- Flutter trap [F]: `TapGestureRecognizer.onTapDown` is delayed by `kPressTimeout` (100 ms) when it competes with a scrollable. That is Flutter's version of the web's tap delay.
- For instant press visuals use `Listener(onPointerDown:)`. Clear the pressed state on `onPointerCancel`/`onPointerUp`, and when a scroll wins the gesture arena.
- **Only pay for double-tap where double-tap exists.** Adding `onDoubleTap` delays `onTap` by up to `kDoubleTapTimeout` (300 ms). **[F]**

**1:1 tracking.**
- Content stays under the finger and **respects the grab offset**: store the `localPosition` at the start and never snap to the element's centre.
- Flutter's gesture arena already keeps tracking after the finger leaves the bounds, which is the web's pointer capture.
- Keep a short position and time history. `VelocityTracker` does this for you, via `DragEndDetails.velocity.pixelsPerSecond`.

**Hysteresis.** Apple says about 10 px before committing to a direction. Flutter's drag recognizers already wait `kTouchSlop` (18 lp) **[F]**. Detect all plausible gestures from the first move and cancel the losers. Avoid recognizers that report only a final state.

**Multi-touch protection.** Ignore extra fingers once a drag starts, or a finger change makes the element jump. [S:emil]
- Flutter [F]: `MultitouchDragStrategy` defaults to `averageBoundaryPointers` on Apple platforms (`latestPointer` elsewhere).
- For custom drags, latch the first pointer id in a `Listener` and ignore the others (`if (_dragging) return;`).

**Velocity dismissal.** "Don't require dragging past a threshold. A quick flick should be enough." [S:emil]
- Sonner's rule: `abs(distance) / elapsedMs > 0.11` (px per ms, averaged over the drag) → dismiss.
- **Decide by the velocity's sign, not position**, at release. [S:apple]
- Flutter reference points [F]: `kMinFlingVelocity` 50 px/s; Material bottom sheet 700 px/s with a close threshold of 0.5; `CupertinoSheetRoute` 2 screen heights/s; Cupertino back-swipe 1 screen width/s.
- Proposed for wavlength [P]:
  1. If the release velocity is at least 700 px/s, or the average velocity is above 0.11 px/ms, the sign decides.
  2. Otherwise, project where the drag would come to rest and snap to the nearest point.
  3. Dismiss if the projected position is past 50% of the travel.

**Momentum projection** (apple's code). `project(v) = (v/1000) · d / (1 − d)`, with d = 0.998 (scroll-like) or 0.99 (snappier). That gives about 0.499·v and 0.099·v.
- Flutter equivalent [F]: `FrictionSimulation(0.135, x, v).finalX`, because 0.998¹⁰⁰⁰ ≈ 0.135. Flutter's own `BouncingScrollSimulation` uses 0.135.
- For d = 0.99, the drag coefficient is 0.99¹⁰⁰⁰ ≈ 4.3e-5.
- Pick the snap target from the projection, then hand the velocity to the spring.

**Rubber-banding.** A soft boundary instead of a hard stop: `f(x) = (x · dim · 0.55) / (dim + 0.55 · |x|)`. [S:apple]
- Scroll views: `BouncingScrollPhysics`, the iOS default, already does this.
- Trays and the banner: apply the formula to the drag past the bound. Example: pulling a tray up past its full height.
- "Friction instead of hard stops." [S:emil]

**Hint in the direction of the gesture.** The in-between frames should point at the outcome. Control Center modules "grow up and out toward your finger". [S:apple]

**Hit targets.** At least 44 × 44 (`kMinInteractiveDimensionCupertino = 44.0`) **[F]**. Grow the hit area without changing the layout. Allow cancel-by-dragging-away with about 10 px of hysteresis.

**Test gestures on a real device**, never only in the simulator.

---

## 8. Press feedback and hold

- **Any pressable element** gets `scale(0.97)` (subtle range 0.95–0.98). "Confirms the interface heard the user." `scale` shrinks the children too, which is intended.
  - Flutter: `AnimatedScale(scale: pressed ? 0.97 : 1, duration: pressed ? 100ms : 160ms, curve: easeOut, alignment: Alignment.center)`. It is implicit, so it is interruptible.
  - Proposed [P]: 100 ms in (apple), 160 ms out (emil).
- **Hover** has no equivalent on iPhone. The web gate `(hover: hover) and (pointer: fine)` means you add no hover motion. On iPad with a pointer, gate `MouseRegion` effects on `PointerDeviceKind.mouse`/`trackpad`. To avoid hover flicker, animate a child, not the hit area.
- **Hold to confirm.** A colored overlay revealed with a clip over **2 s linear** while pressed, snapping back in **200 ms ease-out** on release, plus the 0.97 press scale. [S:emil, find]
  - Flutter: `ClipRect(child: Align(alignment: Alignment.centerLeft, widthFactor: t, child: overlay))`, or a `CustomClipper`.
  - Use it for destructive actions such as "End party" and "Delete Moment". [P]
- **Morphing button** for state indication, such as Resync becoming "Synced ✓". Crossfade the label with blur 2 over 200 ms, keep the button's size fixed, and apply the press scale. [S:emil, applied P]

---

## 9. Reduced motion and accessibility

**Reduce Motion** [F]: iOS "Reduce Motion" arrives as `MediaQuery.disableAnimationsOf(context)`. Use `maybeDisableAnimationsOf` for a null-safe read.

Rule [S:emil, apple, std, audit]: gentler, **not zero**.
- Replace slides, springs, parallax, scale and overshoot with short opacity crossfades (about 200 ms) or static states.
- Keep the opacity and color changes that aid comprehension: lyric ink changes, the skeleton-to-content fade, state labels.
- A "reduced-motion implementation that nukes all feedback" is itself an audit finding.

**Reduce Transparency** [F]: Flutter's `MediaQueryData` has **no** flag for it. Bridge `UIAccessibility.isReduceTransparencyEnabled` and `reduceTransparencyStatusDidChangeNotification` through a platform channel (for example, in `AppDelegate.swift`). When it is on, make the glass solid: full background opacity, no `BackdropFilter`. [S:apple]

**Increase Contrast** [F]: `MediaQuery.highContrastOf(context)`. Use near-solid backgrounds and a defined, contrasting border.

**Bold Text** [F]: `MediaQuery.boldTextOf(context)`. Bump the weights.

**Avoid** [S:apple]:
- Full-viewport moving backgrounds.
- Slow looping oscillations near 0.2 Hz (one cycle every 5 s). This matters for the mic "listening" pulse; drive it from real amplitude instead.
- Abrupt brightness jumps. Ease them.
- Large moving objects at full opacity. Make them semi-transparent while travelling; fade big surfaces out during a large reposition and back in once settled.

**Video Moments** [S:wad]: under Reduce Motion, show a play button instead of autoplaying.

**Dynamic Type** [S:apple]: respect `MediaQuery.textScalerOf`. Spacing and layout scale with the text; don't lock layouts to fixed pixel heights around text.

---

## 10. Performance

**Only animate transform and opacity** [S:all]. The Flutter translation [F, P]:

| Web | Flutter |
|---|---|
| Composited, cheap | `Transform`, `SlideTransition`, `ScaleTransition`, `RotationTransition`, `FadeTransition`, `AnimatedOpacity` (builds a `FadeTransition`, so no rebuild per frame), `AnimatedScale`, `AnimatedSlide`, `ColoredBox` color tween on small leaves |
| Layout every frame (avoid on large trees) | `AnimatedContainer` width/height/padding/margin, `AnimatedPadding`, `AnimatedSize`, `AnimatedAlign`, `AnimatedPositioned`, `SizeTransition`, and `AnimatedDefaultTextStyle` when `fontSize`/`height`/`letterSpacing`/`fontWeight` change (the text reflows) |

- **Allowed layout exception** (by analogy with the picker spec's `width` exception) [S:proto]: small, isolated leaves with no layout dependents, such as a 28 px pill thumb or a short accordion.
- **`transition: all` → `AnimatedContainer` animating many properties at once, or a whole-app `AnimatedTheme` lerp.** Animate exactly the properties you mean.
- **A CSS variable on a parent causing a recalc storm → rebuilding a large subtree every frame.** Examples: `setState` at 60 Hz high in the tree, a `ChangeNotifier` ticking the whole screen, an `AnimatedBuilder` without its `child:` parameter. The fixes:
  - Pass the static subtree as `AnimatedBuilder(child: ...)`.
  - Listen narrowly: `Selector`, `ValueListenableBuilder`, `ListenableBuilder`.
  - Keep tick-driven state (the lyric position ticker, the countdown) in its own `ValueNotifier` that only the lyric and countdown widgets watch.
- **`RepaintBoundary`** goes around anything that repaints continuously: the lyrics panel, the mic ring, the shimmer area, the countdown. Verify with `debugRepaintRainbowEnabled`. List items get boundaries by default (`addRepaintBoundaries: true`).
- **Framer Motion "shorthand runs on the main thread" and "CSS beats JS under load" → in Flutter, every animation ticks on the UI isolate.** Heavy Dart work during a transition drops frames. Examples: JSON and lyrics parsing, Firestore snapshot mapping, TFLite classification. Move them to `Isolate.run`/`compute`, or schedule them after the transition. Use `SnapshotWidget` to scale down complex subtrees as a picture during a transition.
- **Blur is expensive.** Keep σ ≤ 20 [S:emil, wad]. Every `BackdropFilter` and `ImageFiltered` costs a saveLayer. Share backdrops with `BackdropGroup` plus `BackdropFilter.grouped` **[F]**. Don't animate blur on a large, busy subtree.
- **Offscreen tabs.** In an `IndexedStack`-style shell, tickers keep running in hidden tabs. Wrap them in `TickerMode(enabled: isActive)`. Dispose shimmer controllers once content has arrived.
- **120 Hz.** `CADisableMinimumFrameDurationOnPhone = true` is already in `ios/Runner/Info.plist`, so ProMotion is unlocked. Budget 8.3 ms per frame. **[F]**
- **Profiling.** Use `flutter run --profile` on a real iPhone, the DevTools performance view, and `showPerformanceOverlay`. Impeller is the iOS renderer, so shader-compilation jank is not the concern it used to be.

---

## 11. Morphing text and numbers

**From the skills** [S:vocab, lib, emil]:
- "**Text morph** — text that animates character by character when it changes, drawing attention to the new value."
- "**Number ticker** — digits rolling or counting up to a value."
- "**Tabular numbers** — fixed-width digits so numbers don't shift around as they change. Essential for tickers, timers, and counters."
- "**Stepped animation** — divided into discrete steps, like a countdown timer."
- "Animating a number by re-rendering text" is a mismatch; the web answer is NumberFlow (numbers) and torph (text).
- Blur masks crossfades.

**The Flutter recipes below are all [P].**

- **Tabular figures, always**, on "CHORUS IN 12s", timestamps, counts and Recap stats: `fontFeatures: [FontFeature.tabularFigures()]`.
- **Odometer / rolling digits:**
  - Split the number into digit slots of fixed width (measure '0' with the tabular style).
  - Animate only the digits that changed. Each slot is `ClipRect` + `Stack` with the old digit sliding out and the new one sliding in by 100% of the slot height (`SlideTransition`), plus a fade.
  - Direction: an increasing value rolls up (the new digit comes from below); a decreasing value, like the countdown, rolls down (the new digit comes from above). Be consistent.
  - About 200 ms with the enter/exit curve, well inside the 1 s tick. Optional blur 2 on the leaving digit.
  - Changing digit count (10 → 9): the slot width animates via `AnimatedSize`, which is allowed because it is a tiny leaf. Its leaving digit fades and blurs.
  - Reduce Motion: a plain crossfade, or an instant swap.
- **Shared-letter morph** (torph-style), for short status labels: "Listening…" → "Finding lyrics…" → "Synced".
  1. Diff the old and new strings with a longest-common-subsequence match on characters.
  2. Lay out each glyph with a `TextPainter` to get x positions.
  3. Shared glyphs **move** to their new x over 200–300 ms with the move curve (on-screen movement).
  4. Removed glyphs fade, blur 2 and scale to 0.96 on the ease-out curve, about 20% faster.
  5. Added glyphs fade in from 0.96 on the ease-out curve.
  - Keep it to strings of about 30 characters or fewer.
  - **Don't use it for song titles.** Two titles share almost no letters. Use a crossfade with blur 2 and an 8 px rise instead.
  - Reduce Motion: crossfade.
- **Lyrics are content the user reads** (Gate question 4).
  - The current line changes **ink color only**, over about 150 ms with the color curve.
  - No `fontSize` or `fontWeight` animation: it reflows every frame, and `FontWeight.lerp` steps through discrete weights on non-variable fonts.
  - The existing listen screen already notes "One size for every line (no reflow as the highlight moves)". Keep that.
  - If the redesign wants a bigger current line (`WavType.lyricNow` 30 vs `lyricNear` 22), reserve the 30 pt layout box and render neighbours with `Transform.scale(scale: 22/30, alignment: Alignment.centerLeft)`. Animate the scale, never the font size.

---

## 12. Skeletons and loading states

**From the skills:**
- "**Skeleton / Shimmer** — a placeholder with a moving sheen shown while content loads." [S:vocab]
- Perceived speed matters as much as real speed. [S:emil]
- Linear for constant motion. [S:emil]
- Show ongoing status (Apple's four feedback kinds: status, completion, warning, error). [S:apple]
- No slow near-0.2 Hz loops. [S:apple]
- Prevent jarring changes. [S:find]

**Everything below is [P].**

- **Skeleton or spinner?**
  - Use a skeleton when the **final layout is known**: the now-playing card (art square plus title and artist bars), lyrics lines, Log rows, the Party people list, Recap cards.
  - Use a status indicator when the wait has no shape yet, or *is* the action. The mic listening for a match shows the live audio-reactive ring plus a "Listening…" label. The card area underneath can hold the card skeleton.
  - If you must use a spinner, keep it fast-spinning (emil).
- **Match the final layout exactly.** Same sizes, radii (`WavRadius` continuous corners), spacing and line pitch, so the swap causes **zero layout shift**.
  - Text bar height ≈ 0.6–0.7 × the font size, placed on the real line pitch (`fontSize × height`).
  - Paragraph bars at ragged widths, for example 90/75/85/60/80%, with the last line shorter.
  - Lyrics skeleton: 5–7 bars. The "current" bar is taller, matching the `lyricNow` size.
- **Shimmer:**
  - One **shared** sweep in screen space across all bones, so it reads as one light source. Use a `ShaderMask`/gradient with a transform keyed to a global clock and each bone's global offset. This is the Flutter cookbook pattern, and the existing `ShimmerScope` does it.
  - Linear, leading → trailing (left to right).
  - **One sweep every 1.2–1.5 s.** The existing skeleton widget uses 1500 ms, which is fine.
  - The bright band is about 35% of the width. Keep it low contrast (`bgHighlight` → `bgHighlightStrong`).
- **Timing:**
  - Don't flash a skeleton for fast loads: show it only if loading exceeds about 200 ms.
  - Once shown, keep it at least about 400 ms, so it doesn't flicker.
  - Skeleton → content: crossfade 200–240 ms ease-out, with the leaving skeleton at blur 2. Content does **not** translate, because the layout matches.
  - Stagger rows 30–40 ms, capped at 6.
- **Reduce Motion:** static bones with no sheen and no pulse. Keep the ≤ 200 ms fade to content.
- **Cost:** one ticker for all bones, a `RepaintBoundary` around the region, `TickerMode` off when offscreen, and dispose on arrival.

---

## 13. Apple-style materials and depth [S:apple, proto]

- **Translucent chrome over content.** Navigation bars, toolbars and trays are translucent layers with content scrolling underneath, not opaque strips.
  - Flutter: `ClipRRect(borderRadius) > BackdropFilter(filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20)) > ColoredBox(surface.withValues(alpha: 0.6–0.82))`.
  - For the web's `saturate(180%)`: `ImageFilter.compose(outer: ColorFilter.matrix(saturation), inner: blur)`.
- **A dark glass recipe from the picker spec** [S:proto], usable for floating pills (mode toggle, Moment banner):
  - background `rgba(10,10,10,0.82)`, `blur(12px) saturate(1.4)`
  - inset hairline `rgba(255,255,255,0.08)`
  - shadows `0 8 24 rgba(0,0,0,.24)` and `0 2 6 rgba(0,0,0,.12)`
  - radius 999
- **Material weight is hierarchy.**
  - Darker, heavier materials separate structural regions. Lighter ones draw attention to interactive elements.
  - **Never stack a light translucent surface on another.**
  - Bigger surfaces read as thicker: stronger blur and a deeper shadow than chips.
  - Shadows are context-aware: heavier over busy or text content, lighter over plain backgrounds.
  - A bright top edge "catches light": a 1 px top border at about white 0.4 on light themes. On dark, use about white 0.08–0.12 [P].
- **Dim to focus, separate to keep flow.**
  - A modal task gets a scrim, and the background is pushed back or down. `CupertinoSheetRoute` scales the parent back **[F]**. Stacked sheets progressively dim and push back each parent.
  - A parallel, non-blocking panel gets translucency and offset **without** a scrim.
- **Vibrancy.** Over glass, don't use flat grey text. Use higher contrast, slightly heavier weight and a small tracking bump. Put color on a solid layer, not the translucent one.
- **Scroll-edge effects, not dividers.** Where lyrics meet floating chrome, fade them with a `ShaderMask` gradient, and only where the chrome actually overlaps. No 1 px border under headers.
- **Materialize.** Glass enters and exits with blur and scale together (for example 0.96 → 1 with blur 8 → 0 [P]), not an opacity-only fade.
- **Accessibility fallbacks.** Reduce Transparency means solid surfaces with no blur. Increase Contrast means near-solid surfaces with a defined border.

---

## 14. Typography [S:apple]

- **Tracking depends on size. Never use one value for all sizes.**
  - Large text: negative, about −0.02em.
  - Body: about 0.
  - Small text: slightly positive.
  - Flutter's `letterSpacing` is in **logical pixels, not em**, so letterSpacing = em × fontSize. For example −0.02em at 34 pt = −0.68.
- **Leading goes the other way.** Tight on large text (about 1.05–1.1), loose on body (about 1.35–1.5). Loosen for tall scripts; tighten for dense UI.
- **Hierarchy comes from weight, size and leading together.** Emphasise with weight; it adds presence without taking space.
- **System font first. It ships optical sizing, tracking tables and legibility tuning.**
  - On iOS, Flutter's typography uses `CupertinoSystemDisplay` (large sizes) and `CupertinoSystemText` (body) **[F]**.
  - For manual optical sizing: Display at 20 pt and above, Text below.
  - With a variable custom font, set `FontVariation('opsz', fontSize)`.
- **Tabular figures** for anything that ticks (section 11).
- **Dynamic Type:** layout scales with the text (section 9).

---

## 15. Haptics, and motion with sound and touch [S:apple]

**Three rules:**
1. **Causality.** The haptic fires on the actual causal event (the toggle flipping, the tray snapping home), and its character matches the action.
2. **Harmony.** The visual and the haptic fire **on the same frame**. Call `HapticFeedback.*` in the same callback that flips the visual state, not after an `await` and not at the end of the animation.
3. **Utility.** Only for meaningful moments. "Over-feedback trains users to ignore all of it."

**Available APIs** [F]: `selectionClick`, `lightImpact`, `mediumImpact`, `heavyImpact`, `successNotification`, `warningNotification`, `errorNotification`, `vibrate`.

**Mapping for wavlength [P]:**

| Event | Haptic |
|---|---|
| First match of the night | `successNotification` |
| Song switch detected | `lightImpact` |
| Karaoke "your line in 1.5 s" | `mediumImpact`. Already implemented: once per assigned line (`listen_view_model.dart:486-498`). |
| Sync-rail detents | `selectionClick` (already done) |
| Tray snaps home, hold-to-confirm completes | `mediumImpact` |
| No match, error | `errorNotification` |
| Each lyric line | **None** |

---

## 16. Recipes for wavlength's key moments [P, built from the rules above]

1. **Mic press.**
   - Scale 0.97 (100 ms in, 160 ms out, ease-out). `lightImpact` on commit (finger up).
   - While listening: a ring driven by the live mic amplitude through a critically damped spring (about 0.15–0.2 s response, decorative). No fixed 5 s loop.
   - Reduce Motion: static ring at opacity 0.6.
2. **"Listening…" → "Finding lyrics…".**
   - Shared-letter label morph, 240 ms.
   - The now-playing card skeleton (art square plus 2 bars) sits in the card's final slot.
   - The lyrics skeleton appears after the 200 ms grace period.
3. **First song recognized** (rare, so delight is allowed).
   - Skeleton → card crossfade (240 ms, skeleton blurred 2).
   - Artwork materializes: scale 0.96 → 1, blur 8 → 0, opacity 0 → 1, on the enter/exit curve (≈ 240–300 ms). A "Found" chip may pop with the lively spring (500 ms, bounce 0.2).
   - `successNotification` on the same frame the card starts.
   - Lyric lines stagger in at 40 ms, rising 8 px, capped at 6 lines.
4. **Song switch** (continuity).
   - The **card never unmounts**. Its content swaps in place.
   - Old title and artist leave upward 8 px with fade and blur 2 in about 180 ms. The new ones rise from 8 px below in 240 ms, on the enter/exit curve.
   - Artwork crossfades over 240 ms, the new one scaling 0.96 → 1.
   - The lyrics panel dims to about 0.4 opacity in 240 ms (not over 1500 ms), then swaps to the skeleton or new lines.
   - `lightImpact`.
5. **Lyric line advance.**
   - Ink color changes over about 150 ms on the color curve.
   - Scroll re-centres with the follow spring (critically damped, response 0.3 s), retargeting with the carried velocity.
   - The sync rail drags 1:1 with instant response (existing behavior).
   - No haptic.
6. **"CHORUS IN 12s".**
   - Appears when the threshold is crossed: 240 ms ease-out, rising 8 px, scaling 0.96 → 1 from its own leading edge (`Alignment.centerLeft`).
   - Digits roll down, about 200 ms each, tabular.
   - At 0 it morphs into "CHORUS", with `mediumImpact` in Party mode only. Exit 180 ms.
7. **Moment banner** (toast rules).
   - Enters from the top edge (`FractionalTranslation` from `Offset(0, -1)`) with a fade, 240 ms ease-out. A slower 400 ms `ease` is acceptable if the banner's personality is "elegant", per Sonner. Exits through the top in about 180 ms.
   - Swipe up to dismiss (average velocity above 0.11 px/ms, or release velocity at least 700 px/s). Rubber-band on a downward pull.
   - Pause the auto-dismiss timer while touched and while the app is backgrounded.
   - New banners retarget the current one; they don't queue a restart.
8. **Normal/Party toggle.** A sliding thumb, 250 ms on the enter/exit curve (the picker's highlight spec) or the move spring. Content below crossfades in about 180 ms.
9. **Tabs.** Instant. At most a 150 ms fade. The icon fill swaps instantly.
10. **Trays and sheets.**
    - Tap open: the drawer curve or the 380 ms, bounce-0 tray spring, ≤ 400 ms.
    - The scrim is driven by the same controller.
    - Drag: 1:1 tracking, rubber-band upward, projection plus velocity sign decide, then the tray-fling spring (0.8 / 0.3 s) carrying the handed-off velocity.
11. **Log.** A new track row is inserted with `AnimatedList` (`SizeTransition` plus `FadeTransition`, 240 ms). Stagger only on the first open (30 ms, capped at 8).
12. **Recap** (rare, explanatory).
    - Longer beats are allowed. 50–80 ms stagger.
    - Stats roll in as number tickers.
    - Story pages use direction-aware transitions, and swiped cards get momentum springs (bounce 0.2).
13. **Video Moments.** Under Reduce Motion, show a play button, no autoplay.

---

## 17. Review checklist, adapted from review-animations

**Stance:** "Default to flagging. Approval is earned." A transition that works but feels sluggish, lands from the wrong origin, fires too often or drops frames is a regression.

### The ten non-negotiable standards (close to verbatim, with Flutter notes)

1. **Justified motion.** Every animation must answer "why does this animate?": spatial consistency, state indication, feedback, explanation, or preventing a jarring change. "It looks cool" on a frequently seen element is a block.
2. **Frequency-appropriate.** Keyboard-initiated and 100+/day actions get **no** animation. Tens/day get reduced motion. Occasional gets standard. Rare or first-time can have delight. (Flutter: tab switches and lyric-line ticks count as high-frequency.)
3. **Responsive easing.** Entering and exiting elements use ease-out or a strong custom curve. `ease-in` on UI is a block. Built-in easings are too weak; expect custom cubic-béziers. (Flutter: `Curves.easeIn*` is banned; `Curves.easeOut`/`easeInOut` count as weak. A missing `reverseCurve: curve.flipped` on a reversed controller is an ease-in exit, so it is a finding.)
4. **Sub-300 ms UI.** Anything slower on a UI element needs a stated reason, or it is a finding.
5. **Origin and physical correctness.** Popovers, dropdowns and tooltips scale from their trigger, not the centre. Never animate from `scale(0)`; start from 0.9–0.97 with opacity. Modals are exempt. (Flutter: the `alignment:` on `ScaleTransition`/`Transform.scale`; `Tween(begin: 0.0)` on scale is a block.)
6. **Interruptibility.** Rapidly triggered or gesture-driven motion must retarget from the current state: CSS transitions or springs, not keyframes. (Flutter: implicit widgets or controller forward/reverse from the current value; `animateWith(SpringSimulation(..., controller.velocity))` for gestures; no `forward(from: 0)` on toggles.)
7. **GPU-only properties.** Animate transform and opacity only. Animating width, height, margin, padding, top or left (or Framer shorthands under load) is a performance finding. (Flutter: the list in section 10.)
8. **Accessibility.** `prefers-reduced-motion` is honored: gentler, not zero; keep opacity and color, drop movement. Hover motion is gated. (Flutter: `MediaQuery.disableAnimationsOf`; hover only for `PointerDeviceKind.mouse`/`trackpad`.)
9. **Asymmetric enter and exit.** Deliberate actions (a press, a hold, a destructive confirm) animate more slowly; system responses snap. Symmetric timing on a press-and-release or hold is a finding.
10. **Cohesion.** Motion matches the component's personality and the rest of the product. Playful can be bouncier; a dashboard stays crisp. Mismatched personality, or a jarring crossfade where a subtle blur would bridge the two states, is a finding. When unsure, delete it.

### Flag these on sight (the escalation triggers, in Flutter terms)

- The `transition: all` equivalent: an `AnimatedContainer` or `AnimatedTheme` animating everything.
- Scale from 0, or a pure-fade entrance with no initial transform (a bare `FadeTransition` or `AnimatedSwitcher` default).
- `Curves.easeIn*`, a missing `reverseCurve`/`switchOutCurve` (which gives an ease-in exit), or a weak built-in curve on a deliberate animation.
- Animation on a 100+/day action.
- UI duration above 300 ms with no stated reason.
- Centre alignment on a trigger-anchored popover.
- `forward(from: 0)`, `TweenSequence` or `repeat()` on toasts, toggles or anything triggered rapidly.
- Animating layout properties.
- Per-frame `setState` or notifier rebuilds of large subtrees, or heavy Dart work on the UI isolate during motion.
- An `AnimatedBuilder` without `child:`, or an inherited widget or theme changing every frame. (The equivalent of the CSS-variable recalc storm.)
- Movement with no `disableAnimations` handling.
- Symmetric press and hold timing.
- An everything-at-once entrance where a 30–80 ms stagger belongs.

### Order of fixes (verbatim)

1. Delete.
2. Reduce.
3. Fix easing.
4. Fix origin and physicality.
5. Make it interruptible.
6. Move it to the GPU.
7. Asymmetric timing.
8. Polish: blur, stagger, entry, springs.
9. Accessibility and cohesion.

### Review output format

**Part 1** is a single `| Before | After | Why |` table, one row per issue, citing `file:line`. Never a "Before:/After:" list.

**Part 2** is the verdict, grouped by tier:
1. Feel-breaking regressions
2. Missed simplifications
3. Performance
4. Interruptibility and timing
5. Origin, physicality and cohesion
6. Accessibility

**Decision:**
- **Block** for any of: a feel-breaking regression, animation on a high-frequency action, scale-from-0 or ease-in on UI, or a non-GPU animation with an easy fix.
- **Approve** only when all hold: no such regressions, nothing that should be deleted, durations and easing within bounds, interruptibility handled, reduced motion respected.

**Audit and plan rules** [S:audit, improve-animations]:
- Severity:
  - HIGH: wrong easing, high-frequency animation, dropped frames, scale 0.
  - MEDIUM: wrong origin, non-interruptible, missing reduced motion.
  - LOW: stagger, blur, token consolidation.
- Five hand-typed near-identical curves or durations is a consolidation finding. Everything comes from the motion tokens.
- Plans must inline exact values and include a feel check.
- "The motion here is already right" is a valid result.

**Opportunity finder output** [S:find]: at most 5–7 suggestions per app, plus a **required** "rejected candidates" list naming the gate question that killed each.

---

## 18. Process, prototyping, libraries

- **Slow motion.** Set `timeDilation = 2.0–5.0` (from `package:flutter/scheduler.dart`); it is the equivalent of the DevTools playback slider.
  - Check: colors crossfade cleanly (no double image), the easing doesn't start or stop abruptly, the alignment is right, and coordinated properties stay in sync.
- **Frame by frame.** Screen-record on the iPhone and step through it in QuickTime.
- **Always test on a real device** for gestures and ProMotion.
- **Look again the next day** with fresh eyes.
- **Design interaction and visuals together.** "An interactive demo is worth a million static designs." [S:apple]
- **Prototype skill** [S:proto]:
  - 3 variants by default (5 at most), each on a **named axis** (layout, density, personality, motion, interaction model). Names like "Quiet" or "Editorial", never "Option A".
  - Every variant fully works, with realistic content, and meets the craft bar.
  - Show one variant at a time, full size, in context. Switching variants is **instant**; only the picker's highlight slides (250 ms, `cubic-bezier(0.23,1,0.32,1)`).
  - Flutter version: a debug-only route plus a floating dark pill using the exact spec in section 13.
  - Delete the prototype after the pick.
- **Libraries** [S:lib]: the list is web-only (motion, NumberFlow, torph, Sonner and so on). "If the task isn't covered, say so." For wavlength [P]: stay on the Flutter SDK. `physics` covers springs and friction, `ShaderMask` covers shimmer, `AnimatedList`/`Hero`/`CupertinoSheetRoute` cover lists, shared elements and sheets, and odometer and morph are small custom widgets. `pubspec.yaml` has no animation packages, and none is needed.

---

## 19. Notes on the in-progress `lib/ui/core/design/` (as read at 22:01)

A parallel effort has already created `motion.dart`, `tokens.dart`, `skeleton.dart`, `tray.dart`, `rolling_number.dart`, `morph_text.dart`, `pressable.dart` and `wav_button.dart`. Its naming (`WavMotion`, `WavSprings`) should be **extended, not duplicated**.

Against the skills:

- **`WavMotion.of` sends every duration to zero under Reduce Motion.** Fades then vanish too, which the audit calls "reduced-motion implementations that nuke all feedback". Split it into movement (→ 0) and fade (≤ 200 ms). `skeleton.dart:163-167`, `tray.dart:288`, `wav_button.dart:84-87` and `morph_text.dart:59` use `of` for crossfades.
- **`WavMotion.blur = 4.0`.** The skills specify **2 px** for crossfade masking. Keep 4–8 for materializing glass only.
- **`SpringCurve` compresses time.**
  - It maps t onto a fixed 0.6 s of simulation, but `tray.dart:283-284` pairs it with a 380 ms duration. That plays 0.6 s of spring in 0.38 s, so the spring runs about 1.6× stiffer than specified.
  - Fix: derive the span from `spring.duration × 1.5` and use that as the widget's duration.
  - Also build curve instances once (`static final`). Implicit widgets rebuild their `CurvedAnimation` whenever `widget.curve != oldWidget.curve`, and a new `SpringCurve` has no `==`.
- **`WavSprings.tray` has bounce 0.08 on a tap-open.** apple: bounce 0 without momentum. Use 0.8 / 0.3 s (bounce 0.2) **after a drag release** only.
- **`wav_button.dart:90` scales from `Tween(begin: 0.8)`.** The skill floor is 0.9–0.97. Use 0.96 (`enterScale`).
- **Existing screens:**
  - `listen_screen.dart:653-657`: the lyric scroll uses 450 ms `Curves.easeOutCubic`. That is over 300 ms, and `animateTo` retargets with zero velocity each line. Use the follow spring.
  - `listen_screen.dart:830-834`: `AnimatedOpacity` over 1500 ms with a linear default curve. Use about 240 ms on the enter/exit curve.
  - `listen_screen.dart:943-945`: `AnimatedDefaultTextStyle` over 300 ms with the weak `Curves.easeOut`. It is only a color change, so use about 150 ms with the color curve and pass the curve explicitly.

---

## 20. Flutter motion tokens: proposed `lib/ui/core/design/motion.dart`

This keeps the existing names (`micro`, `fast`, `base`, `slow`, `moment`, `easeOut`, `easeOutSoft`, `easeInOut`, `pressScale`, `enterScale`, `blur`, `stagger`, `of`, `reduced`, `WavSprings.tray`, `move`, `lively`, `SpringCurve`) and adds what the skills require.

```dart
import 'package:flutter/animation.dart';
import 'package:flutter/physics.dart';
import 'package:flutter/services.dart' show HapticFeedback;
import 'package:flutter/widgets.dart';

/// Motion tokens. Every animation picks from these — no hand-typed curves.
abstract final class WavMotion {
  // ── Durations ─────────────────────────────────────────────────────────
  /// 100+/night actions (tab switch, mode re-tap): no animation.
  static const instant = Duration.zero;
  /// Press-in (Apple :active 100 ms).
  static const press = Duration(milliseconds: 100);
  /// Tiny state flips; lyric ink change ≈ this.
  static const micro = Duration(milliseconds: 120);
  /// Press release (Emil 160 ms).
  static const release = Duration(milliseconds: 160);
  /// Small things: chips, labels, tooltips (125–200).
  static const fast = Duration(milliseconds: 180);
  /// Default component transition: cards, content swaps, banner enter (150–250).
  static const base = Duration(milliseconds: 240);
  /// CEILING for UI motion.
  static const slow = Duration(milliseconds: 300);
  /// Modal tray opened by tap (modals/drawers 200–500; ours ≤ 400).
  static const sheet = Duration(milliseconds: 400);
  /// Rare moments only: first match, recap reveal.
  static const moment = Duration(milliseconds: 450);
  /// Hold-to-confirm fill (linear); release snaps back with [fast]+[easeOut].
  static const hold = Duration(seconds: 2);
  /// Odometer digit roll (inside a 1 s tick).
  static const digitRoll = Duration(milliseconds: 200);
  /// What movement becomes under Reduce Motion: an opacity crossfade this long.
  static const reducedFade = Duration(milliseconds: 200);
  /// Between staggered siblings (30–80). Never blocks input.
  static const stagger = Duration(milliseconds: 40);
  static const staggerMaxItems = 6;
  /// Skeleton: one linear leading→trailing sweep.
  static const shimmerPeriod = Duration(milliseconds: 1500);
  /// Skeleton: don't show for loads faster than this; once shown, hold ≥ min.
  static const skeletonGrace = Duration(milliseconds: 200);
  static const skeletonMinShow = Duration(milliseconds: 400);

  /// Exits are ~20% faster than entrances.
  static Duration exitOf(Duration enter) => enter * 0.8;

  // ── Curves (all exact matches of the skill cubic-béziers) ────────────
  /// Enter / exit / default UI. CSS (0.23,1,0.32,1) == Curves.easeOutQuint.
  static const easeOut = Cubic(0.23, 1, 0.32, 1);
  /// Use as reverseCurve / AnimatedSwitcher.switchOutCurve so exits are
  /// ease-OUT too (controller.reverse() plays curves backwards).
  static const Curve easeOutReverse = FlippedCurve(easeOut);
  /// Softer ease-out for text/opacity. == Curves.easeOutCubic.
  static const easeOutSoft = Cubic(0.215, 0.61, 0.355, 1);
  /// On-screen move/morph, shared elements (Hero.curve). == Curves.easeInOutQuart.
  static const easeInOut = Cubic(0.77, 0, 0.175, 1);
  /// iOS-like drawer/tray curve (Ionic).
  static const easeDrawer = Cubic(0.32, 0.72, 0, 1);
  /// Color/tint changes (CSS `ease`). == Curves.ease.
  static const easeColor = Cubic(0.25, 0.1, 0.25, 1);
  /// Constant motion only: shimmer, progress, hold-to-confirm fill.
  static const Curve linear = Curves.linear;
  // Banned on UI: Curves.easeIn*, and weak Curves.easeOut / Curves.easeInOut.

  // ── Distances ────────────────────────────────────────────────────────
  static const pressScale = 0.97;   // subtle range 0.95–0.98
  static const enterScale = 0.96;   // 0.9–0.97, always with opacity; never 0
  static const popoverScale = 0.97; // tooltips, small popovers (from trigger)
  static const riseOffset = 8.0;    // stagger / content-swap travel, logical px
  /// Crossfade masking blur (CSS blur(2px) == sigma 2).
  static const blur = 2.0;
  /// Glass surfaces materializing (blur + scale together).
  static const materializeBlur = 8.0;
  static const maxBlur = 20.0;      // hard ceiling

  // ── Reduced motion (gentler, not zero) ───────────────────────────────
  static bool reduced(BuildContext context) =>
      MediaQuery.maybeDisableAnimationsOf(context) ?? false;

  /// MOVEMENT (translate/scale/spring/parallax): zero under Reduce Motion.
  static Duration of(BuildContext context, Duration d) =>
      reduced(context) ? Duration.zero : d;

  /// OPACITY/COLOR: kept, capped at [reducedFade], under Reduce Motion.
  static Duration fadeOf(BuildContext context, Duration d) =>
      reduced(context) && d > reducedFade ? reducedFade : d;
}

/// Springs, in iOS terms: duration == Apple "response", bounce == 1 − damping
/// ratio (SpringDescription.withDurationAndBounce matches SwiftUI).
/// Default bounce 0; bounce only after a gesture carried momentum, or rare delight.
abstract final class WavSprings {
  /// Default UI (Apple 1.0 / 0.35 s). k≈322.3, c≈35.9.
  static final ui = SpringDescription.withDurationAndBounce(
      duration: const Duration(milliseconds: 350));
  /// Reposition, tab indicator, mode thumb (Apple PiP 1.0 / 0.4 s). k≈246.7, c≈31.4.
  static final move = SpringDescription.withDurationAndBounce(
      duration: const Duration(milliseconds: 400));
  /// Lyric scroll re-centre; retargets every line with carried velocity (1.0 / 0.3 s).
  static final follow = SpringDescription.withDurationAndBounce(
      duration: const Duration(milliseconds: 300));
  /// Tray opened by a TAP — no momentum, no overshoot.
  static final tray = SpringDescription.withDurationAndBounce(
      duration: const Duration(milliseconds: 380));
  /// Tray/sheet settling after a DRAG release (Apple drawer 0.8 / 0.3 s). k≈438.7, c≈33.5.
  static final trayFling = SpringDescription.withDurationAndBounce(
      duration: const Duration(milliseconds: 300), bounce: 0.2);
  /// Flicked card / rotation (Apple 0.8 / 0.4 s).
  static final flick = SpringDescription.withDurationAndBounce(
      duration: const Duration(milliseconds: 400), bounce: 0.2);
  /// Rare delight only: first match lands, recap cards (Emil {0.5 s, 0.2}).
  static final lively = SpringDescription.withDurationAndBounce(
      duration: const Duration(milliseconds: 500), bounce: 0.2);
}

/// Drive a controller with a spring from its LIVE value and velocity
/// (interruptible, no brick wall). Use AnimationController.unbounded for
/// springs with bounce — bounded controllers clamp the overshoot.
extension WavSpringDrive on AnimationController {
  TickerFuture springTo(double target, SpringDescription spring,
          {double? velocity}) =>
      animateWith(
          SpringSimulation(spring, value, target, velocity ?? this.velocity));
}

/// A spring as a Curve for one-shot implicit widgets. Pass [settle] as the
/// widget's duration so time isn't warped. (Loses velocity on retarget —
/// use [WavSpringDrive] for anything a finger touches.) Build once, reuse.
class SpringCurve extends Curve {
  SpringCurve(this.spring) : _sim = SpringSimulation(spring, 0, 1, 0);
  final SpringDescription spring;
  final SpringSimulation _sim;

  /// ~1.5× response: residual < 0.1% for bounce ≤ 0.3.
  Duration get settle => spring.duration * 1.5;

  @override
  double transformInternal(double t) =>
      _sim.x(t * settle.inMicroseconds / Duration.microsecondsPerSecond);
}

/// Gesture physics (Apple + Sonner values).
abstract final class WavGesture {
  static const hitTarget = 44.0;          // == kMinInteractiveDimensionCupertino
  static const flickPxPerMs = 0.11;       // Sonner: |distance| / elapsedMs → dismiss
  static const flingPxPerS = 700.0;       // release velocity where SIGN decides
  static const commitFraction = 0.5;      // projected position past half → commit
  static const decelerationRate = 0.998;  // Apple scroll-like (0.99 = snappier)
  static const frictionDrag = 0.135;      // 0.998^1000 → FrictionSimulation drag
  static const rubberBandK = 0.55;

  /// Where a flick comes to rest: (v/1000)·d/(1−d). == FrictionSimulation.finalX.
  static double project(double vPxPerS, [double d = decelerationRate]) =>
      vPxPerS / 1000 * d / (1 - d);

  /// Progressive resistance past a boundary.
  static double rubberband(double overshoot, double dimension,
          [double k = rubberBandK]) =>
      (overshoot * dimension * k) / (dimension + k * overshoot.abs());
}

/// Haptics: causal, same frame as the visual, meaningful moments only.
abstract final class WavHaptics {
  static Future<void> firstMatch() => HapticFeedback.successNotification();
  static Future<void> songSwitch() => HapticFeedback.lightImpact();
  static Future<void> yourLine() => HapticFeedback.mediumImpact();
  static Future<void> snapHome() => HapticFeedback.mediumImpact();
  static Future<void> detent() => HapticFeedback.selectionClick();
  static Future<void> noMatch() => HapticFeedback.errorNotification();
  // Never: per lyric line, per countdown tick, per tab switch.
}
```

**Where the new token values come from:**
- **Skill values:** 0.97, 0.95–0.97, 8 px, 30–80 ms stagger, 2 px blur, blur ≤ 20, ≤ 300 ms, 100/160 ms press, 2 s hold with 200 ms release, 0.11 px/ms, 0.998/0.99, 0.55, the 0.8/0.3, 1.0/0.4 and 0.8/0.4 springs, the four cubic-béziers, 44 pt, and exits about 20% faster.
- **My proposals [P]:** 350 ms default and 300 ms follow spring response, 700 px/s and 0.5 commit, 400 ms sheet, 1500 ms shimmer, 200/400 ms skeleton grace and minimum show, the 6-item stagger cap, 8 blur for materializing, and the haptic mapping.
- **Existing values kept:** 120/180/240/300/450 ms, 0.96, 40 ms, the 380 ms tray, and the 500 ms lively spring (moved from bounce 0.22 to 0.2).